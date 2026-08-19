import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  LuPlus,
  LuHistory,
  LuUserRound,
  LuLogOut,
} from "react-icons/lu";

import logo2 from "../assets/icons/Logo2.png";
import { clearAccessToken, getAccessToken, listSessions } from "../lib/api";

function SideBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  // Chat.jsx fires this after a send completes (the server titles the session
  // then) so the history list picks up fresh titles without a route change.
  useEffect(() => {
    const bump = () => setRefreshTick((t) => t + 1);
    window.addEventListener("najda:sessions-refresh", bump);
    return () => window.removeEventListener("najda:sessions-refresh", bump);
  }, []);

  const activeSessionId = new URLSearchParams(location.search).get("session");

  useEffect(() => {
    let cancelled = false;

    async function loadSessions() {
      if (!getAccessToken()) {
        if (!cancelled) {
          setSessions([]);
          setLoadingSessions(false);
        }
        return;
      }

      try {
        const data = await listSessions();

        if (!cancelled) {
          setSessions(data?.sessions || []);
        }
      } catch {
        if (!cancelled) {
          setSessions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSessions(false);
        }
      }
    }

    loadSessions();

    return () => {
      cancelled = true;
    };
  }, [location.search, refreshTick]);

  return (
    <aside className="flex h-screen w-[270px] flex-col border-r border-gray-100 bg-white px-5 py-6">

      {/* Logo */}
      <div className="mb-8 flex items-center gap-2 px-3">
        <img
          src={logo2}
          alt="CacheAI"
          className="h-8 w-8 object-contain"
        />

        <span className="text-[20px] font-bold tracking-tight text-[#102832]">
          Najda<span className="text-[#27B58A]">AI</span>
        </span>
      </div>

      {/* New Chat */}
      <button
        onClick={() => navigate("/chat")}
        className="
          mb-5
          flex
          w-full
          items-center
          gap-3
          rounded-full
          bg-[#E4F7F1]
          px-4
          py-2.5
          text-[13px]
          font-medium
          text-[#17353D]
          transition-all
          duration-200
          hover:bg-[#D5F1E9]
        "
      >
        <LuPlus
          size={19}
          strokeWidth={1.8}
          className="text-[#167E68]"
        />

        <span>New Chat</span>
      </button>

      {/* Navigation */}
      <nav className="flex flex-col gap-1">

        <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#8FA0A5]">
          Chat History
        </div>

        <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto pr-1">

          {loadingSessions && (
            <p className="px-3 py-2 text-[12px] text-[#8FA0A5]">
              Loading...
            </p>
          )}

          {!loadingSessions && sessions.length === 0 && (
            <p className="px-3 py-2 text-[12px] text-[#8FA0A5]">
              No chats yet
            </p>
          )}

          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => navigate(`/chat?session=${session.id}`)}
              className={`
                flex
                w-full
                items-center
                gap-3
                truncate
                rounded-lg
                px-3
                py-2.5
                text-left
                text-[13px]
                transition-all
                duration-200
                ${
                  String(session.id) === activeSessionId
                    ? "bg-[#EAF8F4] text-[#167E68]"
                    : "text-[#455960] hover:bg-[#F2FAF7] hover:text-[#167E68]"
                }
              `}
            >
              <LuHistory
                size={16}
                className="shrink-0"
              />

              <span className="truncate">
                {session.title || "New Chat"}
              </span>
            </button>
          ))}

        </div>

        <SidebarItem
          icon={<LuUserRound />}
          label="Profile"
          onClick={() => navigate("/profile")}
        />

      </nav>

      {/* Bottom Section */}
      <div className="mt-auto">

        {/* Logout */}
        <button
          onClick={() => {
            clearAccessToken();
            navigate("/login");
          }}
          className="
            mb-7
            flex
            w-full
            items-center
            gap-3
            rounded-lg
            px-3
            py-3
            text-[13px]
            text-[#455960]
            transition-colors
            duration-200
            hover:bg-gray-50
            hover:text-[#167E68]
          "
        >
          <LuLogOut
            size={18}
            strokeWidth={1.7}
          />

          <span>Logout</span>
        </button>

        {/* Emergency Card */}
        <div
          className="
            rounded-[18px]
            border
            border-gray-100
            bg-white
            px-4
            py-5
            shadow-[0_4px_20px_rgba(0,0,0,0.06)]
          "
        >
          <h3 className="text-[13px] font-bold text-[#162D35]">
            Need urgent help?
          </h3>

          <p className="mt-3 text-[11px] leading-[1.7] text-[#5B6B71]">
            If you are experiencing a medical emergency, please call your
            local emergency number.
          </p>
        </div>

      </div>
    </aside>
  );
}


/* Sidebar Item */
function SidebarItem({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="
        flex
        w-full
        items-center
        gap-3
        rounded-lg
        px-3
        py-3
        text-left
        text-[13px]
        text-[#455960]
        transition-all
        duration-200
        hover:bg-[#F2FAF7]
        hover:text-[#167E68]
      "
    >
      <span className="text-[18px]">
        {icon}
      </span>

      <span>{label}</span>
    </button>
  );
}

export default SideBar;
