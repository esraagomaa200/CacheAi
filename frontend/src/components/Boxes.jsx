import {
  LuMessageCircleMore,
  LuMic,
  LuShieldCheck,
} from "react-icons/lu";

const features = [
  {
    icon: LuMessageCircleMore,
    title: "AI-Powered Answers",
    description: "Get accurate, evidence-based medical information.",
  },
  {
    icon: LuMic,
    title: "Voice Interaction",
    description: "Talk to NajdaAI using your voice in Arabic or English.",
  },
  {
    icon: LuShieldCheck,
    title: "Private & Secure",
    description: "Your conversations are encrypted and safe.",
  },
];

function Boxes() {
  return (
    <section className="w-full bg-white px-8 py-12">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
        
        {features.map((feature, index) => {
          const Icon = feature.icon;

          return (
            <div
              key={index}
              className="
                flex
                min-h-[175px]
                flex-col
                items-center
                rounded-[22px]
                bg-white
                px-6
                py-6
                text-center
                shadow-[0_4px_20px_rgba(0,0,0,0.12)]
                transition-all
                duration-300
                hover:-translate-y-1
                hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)]
              "
            >
              {/* Icon */}
              <div
                className="
                  mb-4
                  flex
                  h-14
                  w-14
                  items-center
                  justify-center
                  rounded-full
                  bg-[#E8F8F3]
                "
              >
                <Icon
                  size={27}
                  strokeWidth={1.8}
                  className="text-[#079669]"
                />
              </div>

              {/* Title */}
              <h3 className="text-[16px] font-bold text-[#142B34]">
                {feature.title}
              </h3>

              {/* Description */}
              <p className="mt-3 max-w-[250px] text-[13px] leading-5 text-[#53666D]">
                {feature.description}
              </p>
            </div>
          );
        })}

      </div>
    </section>
  );
}

export default Boxes;