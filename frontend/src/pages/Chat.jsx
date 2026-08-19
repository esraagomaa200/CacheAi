import {
  LuEllipsis,
  LuCheckCheck,
  LuSend,
} from "react-icons/lu";


import logo2 from "../assets/icons/Logo2.png";
import SideBar from "../components/SideBar";
function Chat() {
  return (
    <div className="flex min-h-screen bg-[#FAFCFB]">

      {/* Sidebar */}
      <SideBar />

      {/* Chat Area */}
      <main className="flex min-h-screen flex-1 flex-col bg-white">

      <header className="flex h-[72px] items-center justify-between border-b border-gray-100 px-7">
        <h1 className="text-[15px] font-bold text-[#172B34]">
          New Chat
        </h1>

        <button className="rounded-full p-2 text-[#233B43] transition hover:bg-gray-50">
          <LuEllipsis size={22} />
        </button>
      </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-5 py-7">

          <div className="mx-auto flex max-w-[850px] flex-col gap-5">

            {/* User Message */}
            <div className="flex justify-end">
              <div className="max-w-[65%] rounded-[16px] rounded-tr-[5px] bg-[#E0F5EF] px-5 py-4">

                <p
                  dir="rtl"
                  className="text-right text-[14px] leading-7 text-[#17333A]"
                >
                  مرحباً عندي صداع وحابب من امبارح
                  <br />
                  وكمان تعبي في الجسم، ممكن تساعدني؟
                </p>

                <div className="mt-1.5 flex items-center justify-end gap-1">
                  <span className="text-[10px] text-[#6D8181]">
                    10:30 AM
                  </span>

                  <LuCheckCheck
                    size={14}
                    className="text-[#1AA681]"
                  />
                </div>

              </div>
            </div>


            {/* AI Message */}
            <div className="flex items-start gap-3">

              {/* AI Avatar */}
              <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E7F8F3]">
                <img
                  src={logo2}
                  alt="CacheAI"
                  className="h-7 w-7 object-contain"
                />
              </div>


              {/* Message */}
              <div className="max-w-[72%] rounded-[16px] rounded-tl-[5px] border border-gray-100 bg-white px-5 py-4 shadow-[0_4px_18px_rgba(0,0,0,0.04)]">

                <p
                  dir="rtl"
                  className="text-right text-[14px] leading-7 text-[#263B42]"
                >
                  مرحباً! أنا هنا لمساعدتك.
                  <br />
                  بناءً على الأعراض التي ذكرتها (صداع، حرارة، تعب في الجسم)،
                  قد تكون هذه أعراض شائعة للإنفلونزا أو فيروسية.
                  لكن لتقييم أدق، هل تعاني من أي من الأعراض التالية؟
                </p>


                {/* Symptoms */}
                <ul
                  dir="rtl"
                  className="mt-3 list-disc space-y-1 pr-5 text-right text-[14px] leading-6 text-[#263B42]"
                >
                  <li>سعال أو التهاب في الحلق؟</li>
                  <li>ضيق في التنفس؟</li>
                  <li>فقدان حاسة الشم أو التذوق؟</li>
                  <li>ألم في الصدر؟</li>
                </ul>


                <div className="mt-3 text-left text-[10px] text-[#718187]">
                  10:31 AM
                </div>

              </div>
            </div>


            {/* Suggested Questions */}
            <div className="flex flex-wrap justify-center gap-3 pt-1">

              <button className="rounded-full border border-gray-100 bg-white px-5 py-2.5 text-[12px] font-medium text-[#40545B] shadow-[0_3px_12px_rgba(0,0,0,0.05)] transition hover:border-[#A9DFD0] hover:bg-[#F2FBF8]">
                نعم، عندي سعال
              </button>

              <button className="rounded-full border border-gray-100 bg-white px-5 py-2.5 text-[12px] font-medium text-[#40545B] shadow-[0_3px_12px_rgba(0,0,0,0.05)] transition hover:border-[#A9DFD0] hover:bg-[#F2FBF8]">
                لا، فقط الأعراض المذكورة
              </button>

              <button className="rounded-full border border-gray-100 bg-white px-5 py-2.5 text-[12px] font-medium text-[#40545B] shadow-[0_3px_12px_rgba(0,0,0,0.05)] transition hover:border-[#A9DFD0] hover:bg-[#F2FBF8]">
                عندي ألم في الحلق فقط
              </button>

            </div>

          </div>
        </div>


        {/* Message Input */}
        <div className="border-t border-gray-100 bg-white px-5 py-5">

          <div className="mx-auto max-w-[850px]">

            <div className="flex items-center gap-3 rounded-[14px] border border-[#54C9AB] bg-white px-4 py-2 shadow-[0_3px_15px_rgba(0,0,0,0.03)]">

              <input
                type="text"
                placeholder="Type your message..."
                className="flex-1 bg-transparent px-1 py-2 text-[13px] text-[#243A42] outline-none placeholder:text-[#89979C]"
              />

              <button
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
                "
              >
                <LuSend
                  size={16}
                  strokeWidth={2}
                />
              </button>

            </div>

          </div>

        </div>

      </main>
    </div>
  );
}

export default Chat;