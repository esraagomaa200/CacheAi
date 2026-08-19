import {
  LuPlus,
  LuHistory,
  LuBookmark,
  LuBell,
  LuUserRound,
  LuSettings,
  LuLogOut,
} from "react-icons/lu";

import logo2 from "../assets/icons/Logo2.png";

function SideBar() {
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

        <SidebarItem
          icon={<LuHistory />}
          label="Chat History"
        />

        <SidebarItem
          icon={<LuBookmark />}
          label="Saved"
        />

        <SidebarItem
          icon={<LuBell />}
          label="Reminders"
        />

        <SidebarItem
          icon={<LuUserRound />}
          label="Profile"
        />

        <SidebarItem
          icon={<LuSettings />}
          label="Settings"
        />

      </nav>

      {/* Bottom Section */}
      <div className="mt-auto">

        {/* Logout */}
        <button
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
function SidebarItem({ icon, label }) {
  return (
    <button
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