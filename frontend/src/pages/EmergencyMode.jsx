import { useNavigate } from "react-router-dom";

import {
  LuTriangleAlert,
  LuArrowRight,
  LuShieldCheck,
} from "react-icons/lu";

import logo2 from "../assets/icons/Logo2.png";

function EmergencyMode() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8FCFA]">

      {/* Header */}
      <header className="flex h-[72px] items-center justify-between border-b border-[#E5EEEB] bg-white px-8">

        {/* Logo */}
        <div className="flex items-center gap-2">

          <img
            src={logo2}
            alt="NajdaAI"
            className="h-10 w-10 object-contain"
          />

          <span className="text-xl font-bold text-[#18323A]">
            Najda<span className="text-[#19A878]">AI</span>
          </span>

        </div>

        {/* Emergency Badge */}
        <div className="flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">

          <LuTriangleAlert size={17} />

          <span>Emergency Mode</span>

        </div>

      </header>


      {/* Content */}
      <main className="flex min-h-[calc(100vh-72px)] items-center justify-center px-6 py-12">

        <div className="w-full max-w-[620px] text-center">

          {/* Emergency Icon */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50">

            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">

              <LuTriangleAlert
                size={32}
                strokeWidth={2}
                className="text-red-500"
              />

            </div>

          </div>


          {/* Heading */}
          <h1 className="mt-7 text-4xl font-bold tracking-tight text-[#18323A]">
            Emergency Assistance
          </h1>


          {/* Description */}
          <p className="mx-auto mt-4 max-w-[520px] text-base leading-7 text-[#66787E]">
            Tell us what's happening right now. NajdaAI will help
            you understand your symptoms and guide you through
            the next steps.
          </p>


          {/* Warning Card */}
          <div className="mt-8 flex gap-4 rounded-2xl border border-red-100 bg-red-50/70 p-5 text-left">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">

              <LuTriangleAlert
                size={20}
                className="text-red-500"
              />

            </div>

            <div>

              <h2 className="text-sm font-bold text-[#8F3030]">
                Important
              </h2>

              <p className="mt-1 text-sm leading-6 text-[#7B5555]">
                If you are experiencing a life-threatening emergency,
                contact your local emergency service immediately.
              </p>

            </div>

          </div>


          {/* What Happens Next */}
          <div className="mt-6 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">

            <NextStep
              number="1"
              text="Describe your symptoms in the chat, by typing or voice."
            />

            <NextStep
              number="2"
              text="If your symptoms look high-risk, a 60-second safety check starts."
            />

            <NextStep
              number="3"
              text="No response in time notifies your registered emergency contact."
            />

          </div>


          {/* Start Emergency Chat */}
          <button
            onClick={() => navigate("/chat?mode=emergency")}
            className="
              group
              mt-8
              inline-flex
              items-center
              justify-center
              gap-3
              rounded-xl
              bg-[#D94B4B]
              px-8
              py-4
              text-[15px]
              font-semibold
              text-white
              shadow-sm
              transition-all
              duration-300
              hover:-translate-y-0.5
              hover:bg-[#C83F3F]
              hover:shadow-lg
            "
          >

            Start Emergency Chat

            <LuArrowRight
              size={19}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />

          </button>


          {/* No Account Required */}
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-[#7A898E]">

            <LuShieldCheck
              size={15}
              className="text-[#19A878]"
            />

            <span>No account required</span>

          </div>

        </div>

      </main>

    </div>
  );
}

/* Next Step */
function NextStep({ number, text }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[#E5EEEB] bg-white px-3.5 py-3">

      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EAF8F4] text-[10px] font-bold text-[#19A878]">
        {number}
      </span>

      <p className="text-[12px] leading-5 text-[#5B6B71]">
        {text}
      </p>

    </div>
  );
}

export default EmergencyMode;