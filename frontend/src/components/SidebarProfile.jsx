import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { clearAccessToken } from "../lib/api";

import {
  LuHouse,
  LuMessageSquare,
  LuUserRound,
  LuShieldAlert,
  LuHistory,
  LuLogOut,
  LuChevronRight,
} from "react-icons/lu";

import logo2 from "../assets/icons/Logo2.png";
import AppearanceControls from "./AppearanceControls";

const NAV_ITEMS = [
  { id: "home", translationKey: "navigation.home", path: "/", icon: LuHouse },
  { id: "chat", translationKey: "navigation.chat", path: "/chat", icon: LuMessageSquare },
  { id: "profile", translationKey: "navigation.profile", path: "/profile", icon: LuUserRound },
  {
    id: "emergency-history",
    translationKey: "navigation.emergencyHistory",
    path: "/emergency-history",
    icon: LuHistory,
  },
];

function SidebarProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <aside className="flex min-h-screen w-[255px] shrink-0 flex-col border-r border-[#E8EEEC] bg-white px-3 py-5">

      {/* Logo */}
      <div className="flex items-center gap-2 px-3">

        <img
          src={logo2}
          alt={t("auth.logoAlt")}
          className="h-9 w-9 object-contain"
        />

        <span className="text-[20px] font-bold tracking-tight text-[#18323A]">
          Najda<span className="text-[#19A878]">AI</span>
        </span>

      </div>

      <AppearanceControls className="mt-6 w-full" />


      {/* Navigation */}
      <nav className="mt-5 flex flex-col gap-1.5">

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => `
                group
                flex
                h-[43px]
                items-center
                gap-4
                rounded-xl
                px-3
                text-[13px]
                font-medium
                transition-all
                duration-200

                ${
                  isActive
                    ? "bg-[#EAF8F4] text-[#087D5C]"
                    : "text-[#53636B] hover:bg-[#F5FAF8] hover:text-[#18323A]"
                }
              `}
            >

              {({ isActive }) => (
                <>
                  <Icon
                    size={19}
                    strokeWidth={1.7}
                    className={
                      isActive
                        ? "text-[#19A878]"
                        : "text-[#667780] group-hover:text-[#19A878]"
                    }
                  />

                  <span>
                    {t(item.translationKey)}
                  </span>
                </>
              )}

            </NavLink>
          );
        })}

      </nav>


      {/* Bottom Area */}
<div className="mt-1">

  {/* Logout */}
  <button
    onClick={() => {
      clearAccessToken();
      navigate("/login");
    }}
    className="
      mt-1
      flex
      w-full
      items-center
      gap-4
      rounded-xl
      px-3
      py-2.5
      text-[13px]
      font-medium
      text-[#53636B]
      transition-all
      duration-200
      hover:bg-[#F5FAF8]
      hover:text-[#18323A]
    "
  >

    <LuLogOut
      size={19}
      strokeWidth={1.7}
    />

    <span>
      {t("navigation.logout")}
    </span>

  </button>

    {/* Emergency */}
  <button
    onClick={() => navigate("/emergency")}
    className="
      group
      mt-3
      flex
      w-full
      items-center
      gap-3
      rounded-xl
      border
      border-red-200
      bg-[#FFF8F8]
      px-3
      py-3
      text-left
      transition-all
      duration-200
      hover:border-red-300
      hover:bg-red-50
    "
  >

    {/* Icon */}
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FDE5E5]">
      <LuShieldAlert
        size={18}
        strokeWidth={1.8}
        className="text-[#D94B4B]"
      />
    </div>

    {/* Text */}
    <div className="min-w-0 flex-1">
      <p className="text-[12px] font-bold text-[#C43D3D]">
        {t("navigation.emergencyMode")}
      </p>

      <p className="mt-0.5 text-[10px] text-[#8C6A6A]">
        {t("navigation.immediateAssistance")}
      </p>
    </div>

    <LuChevronRight
      size={16}
      className="shrink-0 text-[#D94B4B] transition-transform duration-200 group-hover:translate-x-0.5"
    />

  </button>

</div>

    </aside>
  );
}

export default SidebarProfile;
