import { UserRound, ChevronDown } from "lucide-react";
import logo2 from "../assets/icons/Logo2.png";

function Header() {
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
          <a
            href="#home"
            className="text-[14px] font-medium text-[#172B34] transition-colors duration-200 hover:text-[#27B58A]"
          >
            Home
          </a>

          <a
            href="#how-it-works"
            className="text-[14px] font-medium text-[#172B34] transition-colors duration-200 hover:text-[#27B58A]"
          >
            How It Works
          </a>

          <a
            href="#about"
            className="text-[14px] font-medium text-[#172B34] transition-colors duration-200 hover:text-[#27B58A]"
          >
            About Us
          </a>

          <a
            href="#contact"
            className="text-[14px] font-medium text-[#172B34] transition-colors duration-200 hover:text-[#27B58A]"
          >
            Contact
          </a>
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-5">

          {/* Get Started */}
          <button
            className="
              rounded-[14px]
              bg-[#15966B]
              px-6
              py-3
              text-[14px]
              font-semibold
              text-white
              shadow-sm
              transition-all
              duration-300
              hover:-translate-y-0.5
              hover:bg-[#0A5755]
              hover:shadow-md
              active:translate-y-0
            "
          >
            Get Started
          </button>

          {/* Profile */}
          <button
            className="
              flex
              items-center
              gap-2
              rounded-full
              transition-all
              duration-200
              hover:opacity-70
            "
          >
            <div
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-full
                border
                border-[#DDE5E5]
                bg-white
              "
            >
              <UserRound
                size={19}
                strokeWidth={1.7}
                className="text-[#19323A]"
              />
            </div>

            <ChevronDown
              size={16}
              strokeWidth={2}
              className="text-[#19323A]"
            />
          </button>

        </div>
      </div>
    </header>
  );
}

export default Header;