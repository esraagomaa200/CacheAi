import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import {
  Brain,
  HeartPulse,
  Wind,
  HelpCircle,
  Clock,
  ShieldAlert,
  Inbox,
  RefreshCw,
  Loader2,
  ExternalLink,
} from "lucide-react";

import SidebarProfile from "../components/SidebarProfile";
import { getAccessToken, listEmergencyEvents } from "../lib/api";

/* ========================================================= */
/* STATIC LOOKUPS                                             */
/* ========================================================= */

const CONDITION_META = {
  stroke: { label: "جلطة دماغية", icon: Brain },
  chest_heart: { label: "قلب وصدر", icon: HeartPulse },
  breathing: { label: "تنفس", icon: Wind },
  unknown: { label: "غير محدد", icon: HelpCircle },
};

const RISK_META = {
  low: { label: "منخفض", bg: "bg-[#E5F6F0]", text: "text-[#15966B]" },
  moderate: { label: "متوسط", bg: "bg-amber-50", text: "text-amber-600" },
  high: { label: "مرتفع", bg: "bg-orange-50", text: "text-orange-600" },
  emergency: { label: "طارئ", bg: "bg-red-50", text: "text-red-600" },
};

const STATUS_META = {
  monitoring: { label: "تحت المراقبة", bg: "bg-[#EAF4FB]", text: "text-[#2A72A8]" },
  alert_pending: { label: "في انتظار الرد", bg: "bg-amber-50", text: "text-amber-600" },
  resolved: { label: "تم الاطمئنان", bg: "bg-[#E5F6F0]", text: "text-[#15966B]" },
  escalated: { label: "تم إبلاغ جهة الاتصال", bg: "bg-red-50", text: "text-red-600" },
};

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/* ========================================================= */
/* PAGE                                                        */
/* ========================================================= */

function EmergencyHistory() {
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getAccessToken()) {
      navigate("/login");
      return;
    }

    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await listEmergencyEvents();

      setEvents(Array.isArray(data?.events) ? data.events : []);
    } catch (err) {
      console.error("Failed to load emergency history:", err);

      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  /* ================================================= */
  /* LOADING */
  /* ================================================= */

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#F8FAFB]">
        <SidebarProfile />

        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">

            <div
              className="
                mx-auto
                mb-3
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-full
                bg-[#EAF8F4]
              "
            >
              <Loader2
                size={22}
                className="animate-spin text-[#19A878]"
              />
            </div>

            <p className="text-[15px] font-medium text-[#526572]">
              Loading emergency history...
            </p>

          </div>
        </main>
      </div>
    );
  }

  /* ================================================= */
  /* ERROR */
  /* ================================================= */

  if (error) {
    return (
      <div className="flex min-h-screen bg-[#F8FAFB]">
        <SidebarProfile />

        <main className="flex flex-1 items-center justify-center px-6">
          <div className="text-center">

            <div
              className="
                mx-auto
                mb-3
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-full
                bg-red-50
              "
            >
              <ShieldAlert
                size={24}
                className="text-red-500"
              />
            </div>

            <p className="text-[15px] font-medium text-[#526572]">
              {error}
            </p>

            <button
              onClick={fetchEvents}
              className="
                mt-4
                inline-flex
                items-center
                gap-2
                rounded-lg
                bg-[#19A878]
                px-4
                py-2
                text-sm
                font-medium
                text-white
                hover:bg-[#168F68]
              "
            >
              <RefreshCw size={15} />
              Try Again
            </button>

          </div>
        </main>
      </div>
    );
  }

  /* ================================================= */
  /* CONTENT */
  /* ================================================= */

  return (
    <div className="flex min-h-screen bg-[#F8FAFB]">

      {/* ================= SIDEBAR ================= */}

      <SidebarProfile />


      {/* ================= MAIN ================= */}

      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-7 lg:px-8 xl:px-10">

        <div className="mx-auto w-full max-w-7xl">

          {/* ================= HEADER ================= */}

          <div className="mb-7">

            <h1 className="text-[27px] font-bold text-[#182B3A]">
              Emergency Event History
            </h1>

            <p className="mt-1 text-[16px] text-[#64748B]">
              A record of every emergency assessment and how it was resolved.
            </p>

          </div>


          {/* ================= LIST / EMPTY ================= */}

          {events.length === 0 ? (
            <EmptyState navigate={navigate} />
          ) : (
            <div className="flex flex-col gap-4">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}

        </div>

      </main>

    </div>
  );
}


/* ========================================================= */
/* EMPTY STATE */
/* ========================================================= */

function EmptyState({ navigate }) {
  return (
    <div
      className="
        flex
        flex-col
        items-center
        justify-center
        rounded-2xl
        border
        border-[#E2E8E7]
        bg-white
        px-6
        py-16
        text-center
      "
    >

      <div
        className="
          mb-4
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-full
          bg-[#EAF8F4]
        "
      >
        <Inbox
          size={26}
          className="text-[#19A878]"
        />
      </div>

      <h2 className="text-[17px] font-semibold text-[#182B3A]" dir="auto">
        لا يوجد سجل طوارئ بعد
      </h2>

      <p
        className="mt-2 max-w-[380px] text-[14px] leading-6 text-[#64748B]"
        dir="auto"
      >
        كل حالة طوارئ يتم تقييمها هتظهر هنا. لو حاسس بأعراض تستدعي القلق،
        ابدأ تقييم طوارئ دلوقتي.
      </p>

      <button
        onClick={() => navigate("/emergency")}
        className="
          mt-5
          inline-flex
          items-center
          gap-2
          rounded-xl
          bg-[#D94B4B]
          px-5
          py-3
          text-[14px]
          font-semibold
          text-white
          transition
          hover:bg-[#C83F3F]
        "
        dir="auto"
      >
        <ShieldAlert size={16} />
        بدء تقييم طوارئ
      </button>

    </div>
  );
}


/* ========================================================= */
/* EVENT CARD */
/* ========================================================= */

function EventCard({ event }) {
  const condition = CONDITION_META[event.condition] || CONDITION_META.unknown;
  const risk = RISK_META[event.risk_level] || RISK_META.low;
  const status = STATUS_META[event.escalation_status] || STATUS_META.monitoring;

  const ConditionIcon = condition.icon;

  return (
    <div
      className="
        rounded-2xl
        border
        border-[#E2E8E7]
        bg-white
        p-5
        transition
        hover:border-[#BFE8DD]
      "
    >

      <div className="flex flex-wrap items-start justify-between gap-4">

        <div className="flex items-start gap-3">

          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${risk.bg}`}
          >
            <ConditionIcon
              size={20}
              className={risk.text}
            />
          </div>

          <div>

            <p
              className="text-[15px] font-semibold text-[#182B3A]"
              dir="auto"
            >
              {condition.label}
            </p>

            <div className="mt-1 flex items-center gap-1.5 text-[13px] text-[#64748B]">
              <Clock size={13} />
              <span>{formatDateTime(event.started_at)}</span>
            </div>

          </div>

        </div>

        <span
          className={`rounded-full px-3 py-1 text-[12px] font-semibold ${risk.bg} ${risk.text}`}
          dir="auto"
        >
          {risk.label}
        </span>

      </div>


      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF1F0] pt-4">

        <span
          className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium ${status.bg} ${status.text}`}
          dir="auto"
        >
          {status.label}
        </span>

        {event.chat_session_id ? (
          <Link
            to={`/chat?session=${event.chat_session_id}`}
            className="
              inline-flex
              items-center
              gap-1.5
              text-[13px]
              font-medium
              text-[#19A878]
              hover:text-[#168F68]
            "
            dir="auto"
          >
            عرض المحادثة
            <ExternalLink size={13} />
          </Link>
        ) : null}

      </div>

    </div>
  );
}

export default EmergencyHistory;
