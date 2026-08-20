import { useCallback, useEffect, useRef, useState } from "react";

// onnxruntime's wasm loader is ES-imported at runtime — /public trips Vite's
// "can't import public files" guard, and the package's exports map doesn't
// expose dist/* for direct import. So the two files are vendored under
// src/assets (copied from node_modules/onnxruntime-web/dist — same version
// as the dependency) and served through Vite's asset pipeline.
import ortWasmMjsUrl from "../assets/vad/ort-wasm-simd-threaded.mjs?url";
import ortWasmUrl from "../assets/vad/ort-wasm-simd-threaded.wasm?url";

import { API_BASE_URL, getAccessToken } from "../lib/api";

/*
 * useLiveVoice — the in-chat live voice engine (root architecture).
 *
 * Two structural decisions replace the old threshold patches:
 *
 * 1. REAL echo cancellation: bot audio is routed through a loopback
 *    RTCPeerConnection and played via an <audio> element. Chromium's
 *    native AEC only references WebRTC/element playback — plain
 *    AudioContext output is invisible to it, which is why the bot used
 *    to hear and answer itself. With the loopback, the echo is
 *    subtracted from the mic signal at the platform level.
 *
 * 2. NEURAL speech gating: Silero VAD (@ricky0123/vad-web) scores every
 *    32ms mic frame. Only frames inside a speech window (with pre-roll
 *    and redemption) are forwarded as real audio; everything else ships
 *    as zero-frames. Ambient noise never reaches Gemini, so no more
 *    phantom turns hallucinated from a fan or a TV — while the stream
 *    cadence Gemini's server VAD needs stays intact (load-bearing:
 *    verified earlier that a paused stream hangs turn detection).
 *
 * Everything else mirrors the proven overlay behavior: auto-reconnect
 * until the user hangs up, transcript context restore across session
 * limits, voice hang-up ("اقفل المكالمة"), barge-in flush.
 */

const OUTPUT_SAMPLE_RATE = 24000;
// Silero v5 frame size at 16kHz — one scored frame every 32ms.
// The gate exists ONLY to kill sustained ambient noise; it must never shave
// real speech (live testing showed half-sentences being dropped with tight
// values). Hysteresis + a long redemption keep whole utterances intact:
const PRE_SPEECH_FRAMES = 12; // ~380ms of onset kept via ring buffer
const REDEMPTION_FRAMES = 30; // ~1s of in-speech grace before closing
const SPEECH_OPEN_THRESHOLD = 0.35; // easy to open…
const SPEECH_HOLD_THRESHOLD = 0.2; // …hard to close (hysteresis)

function wsUrl(sessionId) {
  const base = API_BASE_URL.startsWith("http")
    ? API_BASE_URL.replace(/^http/, "ws")
    : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}${API_BASE_URL}`;
  const session = sessionId ? `&session=${encodeURIComponent(sessionId)}` : "";
  return `${base}/chat/live?token=${encodeURIComponent(getAccessToken() || "")}${session}`;
}

function floatTo16(frame) {
  const pcm = new Int16Array(frame.length);
  for (let i = 0; i < frame.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, frame[i]));
    pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return pcm;
}

export default function useLiveVoice({ onTranscript, onTurnComplete, onStatus }) {
  const [status, setStatus] = useState("idle");

  const wsRef = useRef(null);
  const vadRef = useRef(null);
  const playCtxRef = useRef(null);
  const loopbackDestRef = useRef(null);
  const audioElRef = useRef(null);
  const pcsRef = useRef([]);
  const scheduledRef = useRef(new Set());
  const nextStartTimeRef = useRef(0);
  const zeroFrameRef = useRef(null);

  const activeRef = useRef(false);
  const userEndedRef = useRef(true);
  const reconnectTimerRef = useRef(null);
  const sessionIdRef = useRef(null);

  // Voice hang-up + reconnect context restore need the recent transcript.
  const voiceCommandBufferRef = useRef("");
  const hangUpTimerRef = useRef(null);
  const transcriptLogRef = useRef([]);
  const needsContextRestoreRef = useRef(false);

  // Speech-gate state driven by Silero frame probabilities.
  const inSpeechRef = useRef(false);
  const redemptionRef = useRef(0);
  const preRollRef = useRef([]);

  const statusRef = useRef(onStatus);
  const transcriptRef = useRef(onTranscript);
  const turnCompleteRef = useRef(onTurnComplete);
  useEffect(() => {
    statusRef.current = onStatus;
    transcriptRef.current = onTranscript;
    turnCompleteRef.current = onTurnComplete;
  }, [onStatus, onTranscript, onTurnComplete]);

  const setStatusBoth = useCallback((value) => {
    setStatus(value);
    statusRef.current?.(value);
  }, []);

  const stopPlayback = useCallback(() => {
    scheduledRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        /* already finished */
      }
    });
    scheduledRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const playChunk = useCallback((arrayBuffer) => {
    const context = playCtxRef.current;
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
    // Into the loopback destination — NOT context.destination — so the
    // browser AEC sees (and cancels) everything نجدة says.
    source.connect(loopbackDestRef.current);

    if (nextStartTimeRef.current < context.currentTime) {
      nextStartTimeRef.current = context.currentTime + 0.08;
    }
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;

    scheduledRef.current.add(source);
    source.onended = () => scheduledRef.current.delete(source);
  }, []);

  const teardown = useCallback(() => {
    activeRef.current = false;
    clearTimeout(reconnectTimerRef.current);
    clearTimeout(hangUpTimerRef.current);
    hangUpTimerRef.current = null;

    const socket = wsRef.current;
    wsRef.current = null;
    if (socket) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "end" }));
        }
        socket.close();
      } catch {
        /* socket already gone */
      }
    }

    stopPlayback();

    try {
      vadRef.current?.destroy();
    } catch {
      /* vad already stopped */
    }
    vadRef.current = null;

    pcsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {
        /* already closed */
      }
    });
    pcsRef.current = [];

    if (audioElRef.current) {
      try {
        audioElRef.current.pause();
        audioElRef.current.srcObject = null;
      } catch {
        /* detached */
      }
      audioElRef.current = null;
    }

    playCtxRef.current?.close().catch(() => {});
    playCtxRef.current = null;

    transcriptLogRef.current = [];
    voiceCommandBufferRef.current = "";
    needsContextRestoreRef.current = false;
    inSpeechRef.current = false;
    redemptionRef.current = 0;
    preRollRef.current = [];
  }, [stopPlayback]);

  const hangUp = useCallback(() => {
    userEndedRef.current = true;
    teardown();
    setStatusBoth("ended");
  }, [teardown, setStatusBoth]);

  const hangUpRef = useRef(hangUp);
  useEffect(() => {
    hangUpRef.current = hangUp;
  }, [hangUp]);

  const handleUserTranscriptForCommands = useCallback((text) => {
    if (hangUpTimerRef.current) {
      return;
    }
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
  }, []);

  const sendFrame = useCallback((frame) => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      const pcm = floatTo16(frame);
      socket.send(pcm.buffer);
    }
  }, []);

  const sendZeros = useCallback((length) => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      if (!zeroFrameRef.current || zeroFrameRef.current.byteLength !== length * 2) {
        zeroFrameRef.current = new Int16Array(length).buffer;
      }
      socket.send(zeroFrameRef.current);
    }
  }, []);

  // One Silero-scored frame at a time: forward speech, keep the cadence
  // with zeros otherwise, with pre-roll so word onsets survive.
  const handleVadFrame = useCallback(
    (probabilities, frame) => {
      // Hysteresis: opening needs a clear speech score, but once open, even
      // soft continuation keeps the gate open — Arabic soft syllables and
      // breathy phrase endings must not be clipped.
      const threshold = inSpeechRef.current
        ? SPEECH_HOLD_THRESHOLD
        : SPEECH_OPEN_THRESHOLD;
      const isSpeech = probabilities.isSpeech >= threshold;

      if (isSpeech) {
        if (!inSpeechRef.current) {
          inSpeechRef.current = true;
          preRollRef.current.forEach((buffered) => sendFrame(buffered));
          preRollRef.current = [];
        }
        redemptionRef.current = REDEMPTION_FRAMES;
        sendFrame(frame);
        return;
      }

      if (inSpeechRef.current) {
        redemptionRef.current -= 1;
        if (redemptionRef.current > 0) {
          // Trailing grace: short pauses stay inside the segment.
          sendFrame(frame);
          return;
        }
        inSpeechRef.current = false;
      }

      // Not speech: buffer for pre-roll, ship silence to keep the stream
      // cadence Gemini's turn detection depends on.
      preRollRef.current.push(frame.slice());
      if (preRollRef.current.length > PRE_SPEECH_FRAMES) {
        preRollRef.current.shift();
      }
      sendZeros(frame.length);
    },
    [sendFrame, sendZeros]
  );

  const connectSocket = useCallback(() => {
    if (!activeRef.current || userEndedRef.current) {
      return;
    }

    const socket = new WebSocket(wsUrl(sessionIdRef.current));
    socket.binaryType = "arraybuffer";
    wsRef.current = socket;

    socket.onopen = () => {
      if (!activeRef.current) {
        return;
      }
      setStatusBoth("connected");
      if (needsContextRestoreRef.current) {
        needsContextRestoreRef.current = false;
        const summary = transcriptLogRef.current
          .slice(-16)
          .map((l) => `${l.role === "user" ? "المستخدم" : "نجدة"}: ${l.text}`)
          .join("\n");
        if (summary) {
          try {
            socket.send(JSON.stringify({ type: "context", summary }));
          } catch {
            /* next reconnect retries */
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
        const log = transcriptLogRef.current;
        const last = log[log.length - 1];
        if (last && last.role === payload.role && !last.sealed) {
          last.text += payload.text;
        } else {
          log.push({ role: payload.role, text: payload.text, sealed: false });
          if (log.length > 40) {
            log.shift();
          }
        }
        if (payload.role === "user") {
          handleUserTranscriptForCommands(payload.text);
        }
        transcriptRef.current?.(payload.role, payload.text);
      } else if (payload.type === "interrupted") {
        stopPlayback();
        transcriptLogRef.current.forEach((l) => {
          l.sealed = true;
        });
        turnCompleteRef.current?.();
      } else if (payload.type === "turn_complete") {
        transcriptLogRef.current.forEach((l) => {
          l.sealed = true;
        });
        turnCompleteRef.current?.();
      }
    };

    socket.onerror = () => {};

    socket.onclose = (event) => {
      if (!activeRef.current || userEndedRef.current) {
        return;
      }
      if (event.code === 4401 || event.code === 4404) {
        setStatusBoth("error");
        teardown();
        return;
      }
      stopPlayback();
      needsContextRestoreRef.current = true;
      setStatusBoth("reconnecting");
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(
        () => connectSocketRef.current?.(),
        1000
      );
    };
  }, [handleUserTranscriptForCommands, playChunk, setStatusBoth, stopPlayback, teardown]);

  const connectSocketRef = useRef(null);
  useEffect(() => {
    // Standard latest-ref pattern: reconnect timeouts must call the newest
    // connectSocket without the callback referencing itself at define time.
    // eslint-disable-next-line react-hooks/immutability
    connectSocketRef.current = connectSocket;
  }, [connectSocket]);

  const start = useCallback(
    async (sessionId) => {
      if (activeRef.current) {
        return;
      }
      userEndedRef.current = false;
      activeRef.current = true;
      sessionIdRef.current = sessionId || null;
      transcriptLogRef.current = [];
      setStatusBoth("connecting");

      try {
        // Playback graph + WebRTC loopback (the AEC anchor).
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const playCtx = new Ctx({ sampleRate: OUTPUT_SAMPLE_RATE });
        const loopbackDest = playCtx.createMediaStreamDestination();
        loopbackDestRef.current = loopbackDest;
        playCtxRef.current = playCtx;

        const pc1 = new RTCPeerConnection();
        const pc2 = new RTCPeerConnection();
        pcsRef.current = [pc1, pc2];
        loopbackDest.stream
          .getTracks()
          .forEach((track) => pc1.addTrack(track, loopbackDest.stream));
        pc1.onicecandidate = (e) => e.candidate && pc2.addIceCandidate(e.candidate).catch(() => {});
        pc2.onicecandidate = (e) => e.candidate && pc1.addIceCandidate(e.candidate).catch(() => {});
        const trackReady = new Promise((resolve) => {
          pc2.ontrack = (e) => resolve(e.streams[0]);
        });
        const offer = await pc1.createOffer();
        await pc1.setLocalDescription(offer);
        await pc2.setRemoteDescription(offer);
        const answer = await pc2.createAnswer();
        await pc2.setLocalDescription(answer);
        await pc1.setRemoteDescription(answer);

        const remoteStream = await trackReady;
        const audioEl = new Audio();
        audioEl.autoplay = true;
        audioEl.srcObject = remoteStream;
        audioElRef.current = audioEl;
        await audioEl.play().catch(() => {
          /* will start on first chunk in most browsers */
        });

        // Mic + neural VAD. MicVAD owns getUserMedia (echoCancellation on
        // by default) and feeds us scored 16kHz frames.
        const { MicVAD } = await import("@ricky0123/vad-web");
        const vad = await MicVAD.new({
          // Worklet + onnx model are plain fetches → /public works for them.
          baseAssetPath: "/vad/",
          // Explicit: the library defaults to the legacy model file, which we
          // don't ship — public/vad carries silero_vad_v5.onnx.
          model: "v5",
          // ort's wasm loader is ES-imported → must come through Vite's
          // asset pipeline, not /public (see top-of-file imports).
          ortConfig: (ort) => {
            ort.env.wasm.wasmPaths = {
              mjs: ortWasmMjsUrl,
              wasm: ortWasmUrl,
            };
          },
          positiveSpeechThreshold: SPEECH_THRESHOLD,
          onFrameProcessed: handleVadFrame,
        });
        vadRef.current = vad;
        vad.start();

        connectSocket();
      } catch (err) {
        console.error("live voice start failed:", err);
        teardown();
        userEndedRef.current = true;
        setStatusBoth(
          err?.name === "NotAllowedError" || err?.name === "NotFoundError"
            ? "mic-denied"
            : "error"
        );
      }
    },
    [connectSocket, handleVadFrame, setStatusBoth, teardown]
  );

  useEffect(() => teardown, [teardown]);

  return { status, start, hangUp };
}
