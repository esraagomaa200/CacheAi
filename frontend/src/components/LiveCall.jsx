import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { API_BASE_URL, getAccessToken } from "../lib/api";

/*
 * Full-duplex voice call with نجدة.
 *
 * Two audio graphs, deliberately separate because the rates differ and a
 * single AudioContext can only have one sampleRate:
 *   capture  — 16 kHz, mic -> AudioWorklet -> Int16 PCM -> WebSocket
 *   playback — 24 kHz, WebSocket -> Int16 PCM -> scheduled buffer sources
 *
 * Playback is scheduled on a running `nextStartTime` clock rather than
 * played on arrival, so consecutive chunks butt up against each other with
 * no gap. Barge-in ({"type":"interrupted"}) stops every scheduled source
 * and resets that clock — otherwise the interrupted sentence keeps playing
 * out of the queue while the model is already answering something else.
 */

// The mic worklet lives as a string because AudioWorklet.addModule only
// takes a URL — we hand it an object URL over a Blob so there's no extra
// public/ asset to keep in sync with this file.
const CAPTURE_WORKLET_SOURCE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(2048);
    this._offset = 0;
    // Echo gate: browser AEC does not cover AudioContext playback, so while
    // نجدة is speaking his own voice leaks mic-ward and the model answers
    // itself in a loop (observed live). While bot audio plays, quiet frames
    // are zeroed; loud frames (a real barge-in) pass through.
    this._botSpeaking = false;
    this.port.onmessage = (event) => {
      if (event.data && typeof event.data.botSpeaking === 'boolean') {
        this._botSpeaking = event.data.botSpeaking;
      }
    };
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) {
      return true;
    }

    for (let i = 0; i < channel.length; i += 1) {
      this._buffer[this._offset] = channel[i];
      this._offset += 1;

      if (this._offset === this._buffer.length) {
        let gated = false;
        if (this._botSpeaking) {
          let sum = 0;
          for (let j = 0; j < this._buffer.length; j += 1) {
            sum += this._buffer[j] * this._buffer[j];
          }
          const rms = Math.sqrt(sum / this._buffer.length);
          gated = rms < 0.035;
        }

        const pcm = new Int16Array(this._buffer.length);
        if (!gated) {
          for (let j = 0; j < pcm.length; j += 1) {
            const clamped = Math.max(-1, Math.min(1, this._buffer[j]));
            pcm[j] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
          }
        }
        // Gated frames still ship (as silence): Gemini's VAD needs the
        // continuous stream to detect turn boundaries.
        this.port.postMessage(pcm.buffer, [pcm.buffer]);
        this._offset = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor);
`;

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

const STATUS_LABEL_KEYS = {
  connecting: "liveCall.status.connecting",
  connected: "liveCall.status.connected",
  reconnecting: "liveCall.status.reconnecting",
  ended: "liveCall.status.ended",
  error: "liveCall.status.error",
};

function wsUrl() {
  // Absolute base (local dev): http→ws. Relative base ("/api" behind a public
  // tunnel): build against the current origin so the socket rides the same
  // tunnel — wss on https pages, ws otherwise.
  const base = API_BASE_URL.startsWith("http")
    ? API_BASE_URL.replace(/^http/, "ws")
    : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}${API_BASE_URL}`;
  return `${base}/chat/live?token=${encodeURIComponent(getAccessToken() || "")}`;
}

function LiveCall({ onClose }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState("connecting");
  const [errorMessage, setErrorMessage] = useState("");
  const [lines, setLines] = useState([]);

  const wsRef = useRef(null);
  const micContextRef = useRef(null);
  const playContextRef = useRef(null);
  const streamRef = useRef(null);
  const workletUrlRef = useRef(null);
  // Every AudioBufferSourceNode still scheduled or playing, so barge-in can
  // stop all of them at once.
  const scheduledRef = useRef(new Set());
  const nextStartTimeRef = useRef(0);
  const transcriptEndRef = useRef(null);
  // Hang-up runs from the close button, the socket's onclose, and unmount —
  // this keeps it exactly-once.
  const teardownDoneRef = useRef(false);
  // The call ends ONLY when the user ends it (explicit requirement): any
  // other socket close (Gemini session limits, server restart, network
  // blips) auto-reconnects while the mic pipeline stays alive.
  const userEndedRef = useRef(false);
  const reconnectTimerRef = useRef(null);
  // Voice hang-up command support: rolling buffer of the user's recent
  // transcript + a ref to hangUp so appendTranscript (created earlier)
  // can call it without a dependency cycle.
  const voiceCommandBufferRef = useRef("");
  const hangUpTimerRef = useRef(null);
  const hangUpRef = useRef(null);
  // Mirror of `lines` + a reconnect marker: after an auto-reconnect the new
  // Gemini session starts blank, so we replay the transcript as context —
  // otherwise نجدة forgets the whole call and starts over (user report).
  const linesRef = useRef([]);
  const needsContextRestoreRef = useRef(false);
  // Echo-gate plumbing: the worklet needs to know when bot audio is playing.
  const captureNodeRef = useRef(null);

  const postBotSpeaking = useCallback((value) => {
    try {
      captureNodeRef.current?.port.postMessage({ botSpeaking: value });
    } catch {
      /* worklet already gone */
    }
  }, []);

  const stopPlayback = useCallback(() => {
    scheduledRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Already finished — stopping twice throws, and that's fine.
      }
    });
    scheduledRef.current.clear();
    nextStartTimeRef.current = 0;
    postBotSpeaking(false);
  }, [postBotSpeaking]);

  const teardown = useCallback(() => {
    if (teardownDoneRef.current) {
      return;
    }
    teardownDoneRef.current = true;

    const socket = wsRef.current;
    wsRef.current = null;
    if (socket) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "end" }));
        }
        socket.close();
      } catch {
        // Socket already gone.
      }
    }

    stopPlayback();

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    micContextRef.current?.close().catch(() => {});
    micContextRef.current = null;

    playContextRef.current?.close().catch(() => {});
    playContextRef.current = null;

    if (workletUrlRef.current) {
      URL.revokeObjectURL(workletUrlRef.current);
      workletUrlRef.current = null;
    }
  }, [stopPlayback]);

  const appendTranscript = useCallback((role, text) => {
    // Transcriptions arrive as deltas. Append to the open bubble of the same
    // speaker; a role switch or a turn_complete starts a new one.
    setLines((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && !last.sealed) {
        const next = prev.slice(0, -1);
        return [...next, { ...last, text: last.text + text }];
      }
      return [...prev, { id: `${role}-${Date.now()}-${prev.length}`, role, text, sealed: false }];
    });

    // Voice hang-up: "اقفل المكالمة" (and friends) spoken by the USER ends
    // the call — after a short grace so نجدة's goodbye can play.
    if (role === "user" && !hangUpTimerRef.current) {
      const normalized = (voiceCommandBufferRef.current + text)
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/[^؀-ۿ\s]/g, " ");
      voiceCommandBufferRef.current = normalized.slice(-80);
      const wantsHangUp =
        /(اقفل|قفل|انهي|انه)[^.]{0,15}(المكالمه|مكالمه)/.test(normalized) ||
        /(اقفل|انهي)\s*(يا\s*)?نجد[هة]?/.test(normalized) ||
        /خلاص\s*اقفل/.test(normalized);
      if (wantsHangUp) {
        hangUpTimerRef.current = setTimeout(() => hangUpRef.current?.(), 2500);
      }
    }
  }, []);

  const sealTranscript = useCallback(() => {
    setLines((prev) =>
      prev.map((line) => (line.sealed ? line : { ...line, sealed: true }))
    );
  }, []);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  const playChunk = useCallback((arrayBuffer) => {
    const context = playContextRef.current;
    // Odd byte counts can't be PCM16 — dropping beats throwing inside the
    // socket handler and killing the call.
    if (!context || context.state === "closed" || arrayBuffer.byteLength % 2 !== 0) {
      return;
    }

    const pcm = new Int16Array(arrayBuffer);
    const samples = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i += 1) {
      samples[i] = pcm[i] / 32768;
    }

    const buffer = context.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);

    // A small lead the first time (and after any underrun) absorbs network
    // jitter; after that chunks are simply queued back-to-back.
    if (nextStartTimeRef.current < context.currentTime) {
      nextStartTimeRef.current = context.currentTime + 0.08;
    }
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;

    if (scheduledRef.current.size === 0) {
      postBotSpeaking(true);
    }
    scheduledRef.current.add(source);
    source.onended = () => {
      scheduledRef.current.delete(source);
      if (scheduledRef.current.size === 0) {
        postBotSpeaking(false);
      }
    };
  }, [postBotSpeaking]);

  const hangUp = useCallback(() => {
    userEndedRef.current = true;
    clearTimeout(reconnectTimerRef.current);
    clearTimeout(hangUpTimerRef.current);
    teardown();
    setStatus((current) => (current === "error" ? current : "ended"));
  }, [teardown]);

  useEffect(() => {
    hangUpRef.current = hangUp;
  }, [hangUp]);

  useEffect(() => {
    let cancelled = false;
    // Re-arm the once-only guard: under StrictMode the first run's cleanup
    // already fired teardown, and without this reset the real call would
    // have no working hang-up.
    teardownDoneRef.current = false;

    async function start() {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage("liveCall.errors.microphone");
        }
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      try {
        const playContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: OUTPUT_SAMPLE_RATE,
        });
        playContextRef.current = playContext;

        const micContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: INPUT_SAMPLE_RATE,
        });
        micContextRef.current = micContext;

        const blob = new Blob([CAPTURE_WORKLET_SOURCE], {
          type: "application/javascript",
        });
        const moduleUrl = URL.createObjectURL(blob);
        workletUrlRef.current = moduleUrl;
        await micContext.audioWorklet.addModule(moduleUrl);

        if (cancelled) {
          return;
        }

        // Mic pipeline is built ONCE and sends through wsRef, so it keeps
        // feeding whichever socket is currently live across reconnects.
        const micSource = micContext.createMediaStreamSource(stream);
        const captureNode = new AudioWorkletNode(micContext, "pcm-capture");
        captureNodeRef.current = captureNode;
        captureNode.port.onmessage = (event) => {
          const socket = wsRef.current;
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
          }
        };

        // The graph only pulls nodes reachable from destination, so the
        // worklet needs a path there — muted, or the user hears themselves.
        const silentSink = micContext.createGain();
        silentSink.gain.value = 0;
        micSource.connect(captureNode);
        captureNode.connect(silentSink);
        silentSink.connect(micContext.destination);

        function connectSocket() {
          if (cancelled || userEndedRef.current) {
            return;
          }

          const socket = new WebSocket(wsUrl());
          socket.binaryType = "arraybuffer";
          wsRef.current = socket;

          socket.onopen = () => {
            if (!cancelled) {
              setStatus("connected");
            }
            // After a reconnect, replay the transcript into the fresh Gemini
            // session so نجدة continues instead of starting over.
            if (needsContextRestoreRef.current) {
              needsContextRestoreRef.current = false;
              const summary = linesRef.current
                .slice(-16)
                .map((l) => `${l.role === "user" ? "المستخدم" : "نجدة"}: ${l.text}`)
                .join("\n");
              if (summary) {
                try {
                  socket.send(JSON.stringify({ type: "context", summary }));
                } catch {
                  /* socket died instantly — the next reconnect retries */
                }
              }
            }
          };

          socket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
              playChunk(event.data);
              return;
            }

            let payload;
            try {
              payload = JSON.parse(event.data);
            } catch {
              return;
            }

            if (payload.type === "transcript" && payload.text) {
              appendTranscript(payload.role, payload.text);
            } else if (payload.type === "interrupted") {
              stopPlayback();
              sealTranscript();
            } else if (payload.type === "turn_complete") {
              sealTranscript();
            }
            // "error" payloads are not fatal for the UI: the server closes
            // the socket right after, and onclose reconnects.
          };

          // onerror is always followed by onclose — reconnection lives there.
          socket.onerror = () => {};

          socket.onclose = (event) => {
            if (cancelled || userEndedRef.current) {
              return;
            }
            if (event.code === 4401) {
              // Auth is genuinely unrecoverable without a new login.
              setStatus("error");
              setErrorMessage("liveCall.errors.sessionExpired");
              teardown();
              return;
            }
            // Session limit / server restart / network blip: the user didn't
            // hang up, so the call doesn't end — reopen a fresh session.
            stopPlayback();
            sealTranscript();
            needsContextRestoreRef.current = true;
            setStatus("reconnecting");
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = setTimeout(connectSocket, 1000);
          };
        }

        connectSocket();
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage("liveCall.errors.audioSetup");
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimerRef.current);
      clearTimeout(hangUpTimerRef.current);
      teardown();
    };
  }, [appendTranscript, playChunk, sealTranscript, stopPlayback, teardown]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const isLive = status === "connected";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="flex max-h-[88vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_18px_60px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📞</span>
            <h2 className="text-[15px] font-bold text-[#172B34]">
              {t("liveCall.title")}
            </h2>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
              status === "error"
                ? "bg-red-50 text-red-600"
                : isLive
                  ? "bg-[#E0F5EF] text-[#12775C]"
                  : "bg-gray-100 text-[#5B7278]"
            }`}
          >
            {isLive && (
              <span className="ms-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#1AA681] align-middle" />
            )}
            {t(STATUS_LABEL_KEYS[status])}
          </span>
        </div>

        {status === "error" && errorMessage && (
          <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-start text-[13px] leading-6 text-red-700">
            {t(errorMessage)}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-3">
            {lines.length === 0 && status !== "error" && (
              <p className="py-8 text-center text-[13px] leading-7 text-[#8FA0A5]">
                {isLive
                  ? t("liveCall.readyPrompt")
                  : t("liveCall.preparing")}
              </p>
            )}

            {lines.map((line) =>
              line.role === "user" ? (
                <div key={line.id} className="flex justify-end">
                  <p
                    dir="auto"
                    className="max-w-[80%] rounded-[16px] rounded-tr-[5px] bg-[#E0F5EF] px-4 py-2.5 text-[13px] leading-6 text-[#17333A]"
                  >
                    {line.text}
                  </p>
                </div>
              ) : (
                <div key={line.id} className="flex justify-start">
                  <p
                    dir="auto"
                    className="max-w-[80%] rounded-[16px] rounded-tl-[5px] border border-gray-100 bg-white px-4 py-2.5 text-[13px] leading-6 text-[#263B42] shadow-[0_3px_14px_rgba(0,0,0,0.04)]"
                  >
                    {line.text}
                  </p>
                </div>
              )
            )}

            <div ref={transcriptEndRef} />
          </div>
        </div>

        <div className="border-t border-gray-100 px-6 py-4">
          {status === "ended" || status === "error" ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full bg-[#1AA681] py-3.5 text-[14px] font-bold text-white transition hover:bg-[#148E70]"
            >
              {t("liveCall.close")}
            </button>
          ) : (
            <button
              type="button"
              onClick={hangUp}
              className="w-full rounded-full bg-red-600 py-3.5 text-[14px] font-bold text-white transition hover:bg-red-700"
            >
              {t("liveCall.end")}
            </button>
          )}

          <p className="mt-3 text-center text-[11px] leading-5 text-[#8FA0A5]">
            {t("liveCall.disclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
}

export default LiveCall;
