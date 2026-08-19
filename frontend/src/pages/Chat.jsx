import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  LuEllipsis,
  LuCheckCheck,
  LuSend,
  LuMic,
  LuMicOff,
  LuTriangleAlert,
} from "react-icons/lu";

import logo2 from "../assets/icons/Logo2.png";
import SideBar from "../components/SideBar";
import {
  getAccessToken,
  createSession,
  getMessages,
  sendMessage,
  respondEvent,
  escalateEvent,
} from "../lib/api";
import { getApiErrorKey } from "../i18n/api-error";
import { getFormattingLocale } from "../i18n/language";

const RISK_LABELS = {
  low: "chat.risk.low",
  moderate: "chat.risk.moderate",
  high: "chat.risk.high",
  emergency: "chat.risk.emergency",
};

const SpeechRecognitionCtor =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

function formatTime(dateString, language) {
  const date = dateString ? new Date(dateString) : new Date();

  return new Intl.DateTimeFormat(getFormattingLocale(language), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function riskBadgeClass(level) {
  if (level === "high" || level === "emergency") {
    return "bg-red-100 text-red-700";
  }

  if (level === "moderate") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-emerald-100 text-emerald-700";
}

function Chat() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const sessionParam = searchParams.get("session");
  const mode = searchParams.get("mode");
  const isEmergencyMode = mode === "emergency";

  const [sessionId, setSessionId] = useState(
    sessionParam ? Number(sessionParam) : null
  );
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState("");

  const [emergencyEvent, setEmergencyEvent] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [contact, setContact] = useState(null);
  const [escalating, setEscalating] = useState(false);

  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const bottomRef = useRef(null);
  const emergencyInitDone = useRef(false);
  // Session ids created by our own send flow: the load effect must not refetch
  // them, or the fetched copies race with the ones handleSend appends.
  const selfCreatedSession = useRef(null);

  const speechSupported = Boolean(SpeechRecognitionCtor);

  /* ================================================= */
  /* AUTH GUARD */
  /* ================================================= */

  useEffect(() => {
    if (!getAccessToken()) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  /* ================================================= */
  /* LOAD / CREATE SESSION */
  /* ================================================= */

  useEffect(() => {
    if (!getAccessToken()) {
      return undefined;
    }

    let cancelled = false;

    async function loadSession(id) {
      // Loading any session from the server transfers ownership away from the
      // send flow — otherwise navigating back to a self-created session would
      // hit the guard above and show another session's stale messages.
      selfCreatedSession.current = null;
      setSessionId(id);
      setInitializing(true);
      setError("");
      // Leaving a live emergency session must kill its event state, or the
      // hidden countdown keeps running and can escalate the old event while
      // the user is viewing another chat.
      setEmergencyEvent(null);
      setContact(null);

      try {
        const data = await getMessages(id);

        if (!cancelled) {
          setMessages(data?.messages || []);
        }
      } catch (err) {
        console.error("Failed to load chat messages:", err);
        if (!cancelled) {
          setError(getApiErrorKey(err instanceof Error ? err.message : ""));
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    }

    async function startEmergencySession() {
      setInitializing(true);
      setError("");

      try {
        const data = await createSession("emergency");
        const newId = data?.session?.id ?? data?.id;
        selfCreatedSession.current = newId;

        // Applied unconditionally: emergencyInitDone guarantees this runs once,
        // but under StrictMode the run that started the request is already
        // "cancelled" by the time it resolves, while the second run skips the
        // guard — so gating these updates on `cancelled` drops them entirely.
        setSessionId(newId);
        setEmergencyEvent(data?.emergency_event || null);
        setMessages([]);
        setSearchParams(
          { mode: "emergency", session: String(newId) },
          { replace: true }
        );
      } catch (err) {
        console.error("Failed to start emergency chat:", err);
        setError(getApiErrorKey(err instanceof Error ? err.message : ""));
      } finally {
        setInitializing(false);
      }
    }

    function resetToFreshChat() {
      // Release send-flow ownership too, or revisiting the previous session
      // from the sidebar hits the guard above and renders an empty thread.
      selfCreatedSession.current = null;
      setSessionId(null);
      setMessages([]);
      setEmergencyEvent(null);
      setContact(null);
      setInitializing(false);
    }

    if (sessionParam) {
      if (selfCreatedSession.current === Number(sessionParam)) {
        // Our own create/send flow already owns this session's messages — skip
        // the refetch, but clear the loading state the cancelled run left set.
        setInitializing(false);
        return undefined;
      }
      loadSession(Number(sessionParam));
    } else if (isEmergencyMode && !emergencyInitDone.current) {
      emergencyInitDone.current = true;
      startEmergencySession();
    } else if (!isEmergencyMode) {
      resetToFreshChat();
    }

    return () => {
      cancelled = true;
    };
  }, [sessionParam, isEmergencyMode, setSearchParams]);

  /* ================================================= */
  /* AUTO-SCROLL */
  /* ================================================= */

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  /* ================================================= */
  /* EMERGENCY COUNTDOWN */
  /* ================================================= */

  useEffect(() => {
    function syncCountdown() {
      if (emergencyEvent?.escalation_status === "alert_pending") {
        setCountdown(emergencyEvent.timer_seconds || 60);
      } else {
        setCountdown(null);
      }
    }

    syncCountdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emergencyEvent?.escalation_status, emergencyEvent?.id]);

  async function handleAutoEscalate() {
    if (!emergencyEvent?.id || escalating) {
      return;
    }

    setEscalating(true);

    try {
      const data = await escalateEvent(emergencyEvent.id);
      setEmergencyEvent(
        data?.event || { ...emergencyEvent, escalation_status: "escalated" }
      );
      setContact(data?.emergency_contact || null);
      setCountdown(null);
    } catch (err) {
      console.error("Failed to escalate emergency event:", err);
      const message = err.message || "";
      if (message.includes("already")) {
        // 409: the event reached a terminal state elsewhere (another tab,
        // an earlier successful call) — adopt it and stop retrying.
        setEmergencyEvent({ ...emergencyEvent, escalation_status: "escalated" });
        setCountdown(null);
      } else {
        // Escalation is safety-critical: keep the event alert_pending and
        // auto-retry in 5s instead of silently freezing the countdown.
        setError(getApiErrorKey(message));
        setCountdown(5);
      }
    } finally {
      setEscalating(false);
    }
  }

  useEffect(() => {
    if (countdown === null) {
      return undefined;
    }

    if (countdown <= 0) {
      queueMicrotask(() => handleAutoEscalate());
      return undefined;
    }

    const timer = setTimeout(() => {
      setCountdown((current) => (current === null ? null : current - 1));
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  async function handleRespond() {
    if (!emergencyEvent?.id) {
      return;
    }

    setEscalating(true);

    try {
      const data = await respondEvent(emergencyEvent.id);
      setEmergencyEvent(data);
      setCountdown(null);
    } catch (err) {
      console.error("Failed to record emergency response:", err);
      setError(getApiErrorKey(err instanceof Error ? err.message : ""));
    } finally {
      setEscalating(false);
    }
  }

  /* ================================================= */
  /* SEND MESSAGE */
  /* ================================================= */

  async function handleSend() {
    const content = input.trim();

    if (!content || sending || initializing) {
      return;
    }

    setInput("");
    setError("");

    const tempId = `temp-${Date.now()}`;
    const optimisticUser = {
      id: tempId,
      sender: "user",
      content,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);

    let activeSessionId = sessionId;

    try {
      if (!activeSessionId) {
        const data = await createSession(
          isEmergencyMode ? "emergency" : "normal"
        );
        activeSessionId = data?.session?.id ?? data?.id;
        selfCreatedSession.current = activeSessionId;
        setSessionId(activeSessionId);

        if (data?.emergency_event) {
          setEmergencyEvent(data.emergency_event);
        }

        setSearchParams(
          isEmergencyMode
            ? { mode: "emergency", session: String(activeSessionId) }
            : { session: String(activeSessionId) },
          { replace: true }
        );
      }

      const res = await sendMessage(activeSessionId, content);

      setMessages((prev) => {
        const withoutTemp = prev.filter((msg) => msg.id !== tempId);
        const fresh = [res.user_message, res.assistant_message].filter(
          (msg) => msg && !withoutTemp.some((p) => p.id === msg.id)
        );
        return [...withoutTemp, ...fresh];
      });

      if (res.emergency_event) {
        setEmergencyEvent(res.emergency_event);
      }

      // The server auto-titles the session from the first message AFTER this
      // request — nudge the sidebar to refetch, or it shows "New Chat" forever.
      window.dispatchEvent(new Event("najda:sessions-refresh"));
    } catch (err) {
      console.error("Failed to send chat message:", err);
      setError(getApiErrorKey(err instanceof Error ? err.message : ""));
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      setInput(content);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  /* ================================================= */
  /* VOICE INPUT */
  /* ================================================= */

  function toggleListening() {
    if (!speechSupported) {
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "ar-EG";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }

      setInput(transcript);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  /* ================================================= */
  /* DERIVED STATE */
  /* ================================================= */

  const lastAssistantRisk = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].sender === "assistant" && messages[i].risk_level) {
        return messages[i].risk_level;
      }
    }

    return emergencyEvent?.risk_level || null;
  }, [messages, emergencyEvent]);

  const showRiskBanner =
    isEmergencyMode &&
    (lastAssistantRisk === "high" || lastAssistantRisk === "emergency");

  if (!getAccessToken()) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[#FAFCFB]">
      {/* Sidebar */}
      <SideBar />

      {/* Chat Area */}
      <main className="flex min-h-screen flex-1 flex-col bg-white">
        {/* Emergency Strip */}
        {isEmergencyMode && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-7 py-2.5">
            <span className="text-[13px] font-bold text-red-700">
              🚨 {t("chat.emergencyMode")}
            </span>

            {emergencyEvent?.risk_level && (
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${riskBadgeClass(
                  emergencyEvent.risk_level
                )}`}
              >
                {RISK_LABELS[emergencyEvent.risk_level]
                  ? t(RISK_LABELS[emergencyEvent.risk_level])
                  : emergencyEvent.risk_level}
              </span>
            )}
          </div>
        )}

        <header className="flex h-[72px] items-center justify-between border-b border-gray-100 px-7">
          <h1 className="text-[15px] font-bold text-[#172B34]">
            {isEmergencyMode
              ? t("chat.emergencyTitle")
              : sessionId
                ? t("chat.title")
                : t("chat.newTitle")}
          </h1>

          <button
            className="rounded-full p-2 text-[#233B43] transition hover:bg-gray-50"
            aria-label={t("chat.moreOptions")}
          >
            <LuEllipsis size={22} />
          </button>
        </header>

        {/* Countdown / Escalated card */}
        {isEmergencyMode &&
          emergencyEvent?.escalation_status === "alert_pending" && (
            <div className="mx-5 mt-4 flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-center">
              <p className="text-[14px] font-semibold text-red-700">
                {t("chat.safetyPrompt")}
              </p>

              <span
                className="text-3xl font-bold text-red-600"
                aria-label={t("chat.countdown", {
                  count: countdown ?? emergencyEvent.timer_seconds ?? 60,
                })}
              >
                {countdown ?? emergencyEvent.timer_seconds ?? 60}
              </span>

              <button
                onClick={handleRespond}
                disabled={escalating}
                className="rounded-full bg-[#1AA681] px-8 py-3 text-[14px] font-bold text-white transition hover:bg-[#148E70] disabled:opacity-60"
              >
                {t("chat.imOkay")}
              </button>
            </div>
          )}

        {isEmergencyMode && emergencyEvent?.escalation_status === "escalated" && (
          <div className="mx-5 mt-4 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-4">
            <span className="text-2xl" aria-hidden="true">📞</span>

            <p className="text-[13px] font-medium text-red-700">
              {contact ? (
                <>
                  {t("chat.notifyingContact")} {" "}
                  <span dir="auto">{contact.name}</span>
                  {" — "}
                  <span dir="ltr">{contact.phone}</span>
                </>
              ) : (
                t("chat.notifyingNoContact")
              )}
            </p>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-5 py-7">
          <div className="mx-auto flex max-w-[850px] flex-col gap-5">
            {initializing && (
              <p className="text-center text-[13px] text-[#8FA0A5]">
                {t("chat.loading")}
              </p>
            )}

            {!initializing && messages.length === 0 && (
              <p className="text-center text-[13px] text-[#8FA0A5]">
                {t("chat.empty")}
              </p>
            )}

            {messages.map((msg) => {
              const isUser = msg.sender === "user";

              if (isUser) {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[65%] rounded-[16px] rounded-tr-[5px] bg-[#E0F5EF] px-5 py-4">
                      <p
                        dir="auto"
                        className="text-right text-[14px] leading-7 text-[#17333A]"
                      >
                        {msg.content}
                      </p>

                      <div className="mt-1.5 flex items-center justify-end gap-1">
                        <span className="text-[10px] text-[#6D8181]">
                          {formatTime(msg.created_at, i18n.language)}
                        </span>

                        <LuCheckCheck size={14} className="text-[#1AA681]" />
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="flex items-start gap-3">
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E7F8F3]">
                    <img
                      src={logo2}
                      alt={t("chat.assistantLogoAlt")}
                      className="h-7 w-7 object-contain"
                    />
                  </div>

                  <div className="flex max-w-[72%] flex-col gap-1.5">
                    <div className="rounded-[16px] rounded-tl-[5px] border border-gray-100 bg-white px-5 py-4 shadow-[0_4px_18px_rgba(0,0,0,0.04)]">
                      <p
                        dir="auto"
                        className="text-right text-[14px] leading-7 text-[#263B42]"
                      >
                        {msg.content}
                      </p>

                      <div className="mt-3 text-left text-[10px] text-[#718187]">
                        {formatTime(msg.created_at, i18n.language)}
                      </div>
                    </div>

                    {Array.isArray(msg.sources) && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((src, i) =>
                          src.url ? (
                            <a
                              key={`${msg.id}-src-${i}`}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full border border-gray-100 bg-[#F5FAF9] px-3 py-1 text-[11px] text-[#40545B] transition hover:border-[#A9DFD0] hover:bg-[#F2FBF8]"
                            >
                              <span className="sr-only">{t("chat.source")}: </span>
                              <span dir="auto">📚 {src.org} — {src.title}</span>
                            </a>
                          ) : (
                            <span
                              key={`${msg.id}-src-${i}`}
                              className="rounded-full border border-gray-100 bg-[#F5FAF9] px-3 py-1 text-[11px] text-[#40545B]"
                            >
                              <span className="sr-only">{t("chat.source")}: </span>
                              <span dir="auto">📚 {src.org} — {src.title}</span>
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E7F8F3]">
                  <img
                    src={logo2}
                    alt={t("chat.assistantLogoAlt")}
                    className="h-7 w-7 object-contain"
                  />
                </div>

                <div className="flex items-center gap-1.5 rounded-[16px] rounded-tl-[5px] border border-gray-100 bg-white px-5 py-4 shadow-[0_4px_18px_rgba(0,0,0,0.04)]">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[#9FB4B9]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[#9FB4B9] delay-150" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[#9FB4B9] delay-300" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {error && (
          <div className="mx-auto w-full max-w-[850px] px-5 pb-1 text-[12px] text-red-600">
            {t(error)}
          </div>
        )}

        {showRiskBanner && (
          <div className="mx-auto mb-1 flex w-full max-w-[850px] items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-[13px] font-medium text-red-700">
            <LuTriangleAlert size={18} className="shrink-0" />
            <span>
              {t("chat.riskWarning", {
                level: RISK_LABELS[lastAssistantRisk]
                  ? t(RISK_LABELS[lastAssistantRisk])
                  : lastAssistantRisk,
              })}
            </span>
          </div>
        )}

        {/* Message Input */}
        <div className="border-t border-gray-100 bg-white px-5 py-5">
          <div className="mx-auto max-w-[850px]">
            <div className="flex items-center gap-3 rounded-[14px] border border-[#54C9AB] bg-white px-4 py-2 shadow-[0_3px_15px_rgba(0,0,0,0.03)]">
              <input
                type="text"
                dir="auto"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("chat.messagePlaceholder")}
                className="flex-1 bg-transparent px-1 py-2 text-[13px] text-[#243A42] outline-none placeholder:text-[#89979C]"
              />

              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  title={listening ? t("chat.stopVoice") : t("chat.startVoice")}
                  aria-label={listening ? t("chat.stopVoice") : t("chat.startVoice")}
                  className={`
                    flex
                    h-8
                    w-8
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    transition-all
                    duration-200
                    ${
                      listening
                        ? "bg-red-50 text-red-500"
                        : "text-[#5B7278] hover:bg-gray-50"
                    }
                  `}
                >
                  {listening ? <LuMicOff size={16} /> : <LuMic size={16} />}
                </button>
              )}

              <button
                type="button"
                onClick={handleSend}
                disabled={sending || initializing || !input.trim()}
                aria-label={t("chat.sendMessage")}
                className="
                  flex
                  h-8
                  w-8
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-[#1AA681]
                  text-white
                  transition-all
                  duration-200
                  hover:bg-[#148E70]
                  hover:scale-105
                  disabled:opacity-50
                  disabled:hover:scale-100
                "
              >
                <LuSend size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Chat;
