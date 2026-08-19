import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import logo2 from "../assets/icons/Logo2.png";
import {
  apiFetch,
  clearAccessToken,
  getAccessToken,
} from "../lib/api";
import AppearanceControls from "./AppearanceControls";

function Header() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const dropdownRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      if (!getAccessToken()) {
        return;
      }

      try {
        const currentUser = await apiFetch("/auth/me");

        if (isMounted) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Failed to load current user:", error);

        if (isMounted) {
          setUser(null);
        }
      }
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        isOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const handleEditProfile = () => {
    setIsOpen(false);
    navigate("/edit-profile");
  };

  const handleLogout = () => {
    clearAccessToken();
    setUser(null);
    setIsOpen(false);
    navigate("/");
  };

  const userName = user?.name || user?.email?.split("@")[0] || t("common.user");
  const userEmail = user?.email || t("common.noActiveAccount");

  return (
    <header className="w-full border-b border-gray-100 bg-white">
      <div className="mx-auto flex h-[72px] items-center justify-between px-8 lg:px-12">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <img
            src={logo2}
            alt="CacheAI Logo"
            className="h-11 w-11 object-contain"
          />

          <span className="text-[27px] font-bold tracking-[-0.8px] text-[#0B2028]">
            Najda<span className="text-[#27B58A]">AI</span>
          </span>
        </div>

        {/* Navigation */}
        <nav className="hidden items-center gap-9 md:flex">
          <Link
            to="/"
            className="text-[14px] font-medium text-[#172B34] transition-colors duration-200 hover:text-[#27B58A]"
          >
            {t("navigation.home")}
          </Link>
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-5">
          <AppearanceControls compact />

          {/* Profile dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              aria-label={t("common.openUserMenu")}
              aria-expanded={isOpen}
              aria-haspopup="menu"
              onClick={() => setIsOpen((previous) => !previous)}
              className="flex items-center gap-2 rounded-full transition-all duration-200 hover:opacity-70"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#DDE5E5] bg-white">
                <UserRound
                  size={19}
                  strokeWidth={1.7}
                  className="text-[#19323A]"
                />
              </div>

              <ChevronDown
                size={16}
                strokeWidth={2}
                className={`text-[#19323A] transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isOpen && (
              <div
                role="menu"
                className="absolute right-0 top-14 z-50 w-[270px] overflow-hidden rounded-xl border border-[#DDE5E5] bg-white shadow-[0_12px_35px_rgba(11,32,40,0.14)]"
              >
                <div className="border-b border-[#EDF1F0] px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E5F6F0]">
                      <UserRound size={18} className="text-[#15966B]" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[#19323A]">
                        {userName}
                      </p>
                      <p className="truncate text-[12px] text-[#718087]">
                        {userEmail}
                      </p>
                    </div>
                  </div>
                </div>

                {user ? (
                  <div className="p-2">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleEditProfile}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-[#19323A] transition-colors hover:bg-[#F1FAF7] hover:text-[#15966B]"
                    >
                      <Settings size={17} />
                      {t("common.editProfile")}
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-[#C24141] transition-colors hover:bg-red-50"
                    >
                      <LogOut size={17} />
                      {t("common.logout")}
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-3 text-[12px] leading-5 text-[#718087]">
                    {t("common.noActiveAccount")}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;

