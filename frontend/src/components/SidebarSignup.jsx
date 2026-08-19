import logo2 from "../assets/icons/Logo2.png";

import {
  LuShieldCheck,
  LuUserRound,
  LuHeartPulse,
} from "react-icons/lu";

function SidebarSignUp() {
  return (
    <aside className="hidden min-h-screen w-[38%] flex-col bg-[#F3FBF8] px-12 py-10 lg:flex">

      {/* Logo */}
      <div className="flex items-center gap-2">
        <img
          src={logo2}
          alt="CacheAI"
          className="h-10 w-10 object-contain"
        />

        <span className="text-[25px] font-bold tracking-tight text-[#102832]">
          Najda<span className="text-[#19A878]">AI</span>
        </span>
      </div>


      {/* Main Content */}
      <div className="mt-16">

        <h1 className="max-w-[400px] text-[42px] font-bold leading-[1.15] text-[#102832]">
          Create Your
          <br />

          <span className="text-[#19A878]">
            Health
          </span>{" "}
          Profile
        </h1>

        <p className="mt-5 max-w-[380px] text-[17px] leading-7 text-[#53676E]">
          Help us personalize your experience and provide
          you with accurate medical support.
        </p>

      </div>


      {/* Illustration */}
      <div className="mt-10 flex justify-center">
        <div className="relative flex h-[230px] w-[280px] items-center justify-center">

          {/* Background Circle */}
          <div className="absolute h-[210px] w-[210px] rounded-full bg-[#E3F6F0]" />

          {/* Medical Card */}
          <div
            className="
              relative
              z-10
              flex
              h-[175px]
              w-[135px]
              flex-col
              items-center
              rounded-[20px]
              border
              border-white
              bg-white
              p-4
              shadow-[0_10px_30px_rgba(25,168,120,0.10)]
            "
          >

            {/* Avatar */}
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#DDF4ED]">
              <LuUserRound
                size={25}
                className="text-[#19A878]"
              />
            </div>

            {/* Lines */}
            <div className="mt-4 h-2 w-20 rounded-full bg-[#E2F1ED]" />
            <div className="mt-2 h-2 w-24 rounded-full bg-[#EDF5F3]" />

            <div className="mt-4 h-10 w-full rounded-lg bg-[#E8F8F3]">
              <div className="flex h-full items-center justify-center">
                <LuHeartPulse
                  size={25}
                  className="text-[#35C19B]"
                />
              </div>
            </div>

          </div>


          {/* Shield */}
          <div
            className="
              absolute
              bottom-5
              right-7
              z-20
              flex
              h-14
              w-14
              items-center
              justify-center
              rounded-2xl
              bg-[#19A878]
              shadow-[0_8px_20px_rgba(25,168,120,0.25)]
            "
          >
            <LuShieldCheck
              size={30}
              className="text-white"
            />
          </div>

        </div>
      </div>


      {/* Features */}
      <div className="mt-auto space-y-6">

        {/* Feature 1 */}
        <div className="flex items-start gap-4">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <LuShieldCheck
              size={20}
              className="text-[#19A878]"
            />
          </div>

          <div>
            <h3 className="text-[14px] font-bold text-[#18323A]">
              Your Data is Safe
            </h3>

            <p className="mt-1 max-w-[270px] text-[12px] leading-5 text-[#61747A]">
              We use industry-standard encryption to protect
              your information.
            </p>
          </div>

        </div>


        {/* Feature 2 */}
        <div className="flex items-start gap-4">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <LuUserRound
              size={20}
              className="text-[#19A878]"
            />
          </div>

          <div>
            <h3 className="text-[14px] font-bold text-[#18323A]">
              Personalized Care
            </h3>

            <p className="mt-1 max-w-[270px] text-[12px] leading-5 text-[#61747A]">
              Get medical support tailored to your health
              profile.
            </p>
          </div>

        </div>


        {/* Feature 3 */}
        <div className="flex items-start gap-4">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <LuHeartPulse
              size={20}
              className="text-[#19A878]"
            />
          </div>

          <div>
            <h3 className="text-[14px] font-bold text-[#18323A]">
              Better Assistance
            </h3>

            <p className="mt-1 max-w-[270px] text-[12px] leading-5 text-[#61747A]">
              Help our AI assistant understand you better
              for accurate answers.
            </p>
          </div>

        </div>

      </div>

    </aside>
  );
}

export default SidebarSignUp;