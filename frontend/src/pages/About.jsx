import { useTranslation } from "react-i18next";

const AboutHero = () => {
  const { t } = useTranslation();

  return (
    <section className="w-full px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-r from-[#f4fffb] via-white to-[#effbf7] border border-[#e4f3ee]">
        <div className="grid min-h-[320px] grid-cols-1 items-center lg:grid-cols-2">

          {/* Left Content */}
          <div className="px-6 py-10 md:px-12 lg:py-12">

            {/* About Us Badge */}
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#e5f8f2] px-4 py-2 text-sm font-medium text-[#087f68]">
              <span className="text-base" aria-hidden="true">♧</span>
              {t("about.badge")}
            </div>

            {/* Heading */}
            <h1 className="max-w-xl text-3xl font-bold leading-tight text-[#0c2933] md:text-4xl">
              {t("about.title")}
            </h1>

            {/* Description */}
            <div className="mt-5 max-w-xl space-y-2 text-sm leading-6 text-[#334b53] md:text-base">
              <p>
                {t("about.mission")}
              </p>

              <p>
                {t("about.approach")}
              </p>
            </div>

            {/* Features */}
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-full border border-[#dcefe9] bg-white px-4 py-2 text-xs font-medium text-[#087f68] shadow-sm">
                <span aria-hidden="true">♡</span>
                {t("about.features.accessible")}
              </div>

              <div className="flex items-center gap-2 rounded-full border border-[#dcefe9] bg-white px-4 py-2 text-xs font-medium text-[#087f68] shadow-sm">
                <span aria-hidden="true">♢</span>
                {t("about.features.reliable")}
              </div>

              <div className="flex items-center gap-2 rounded-full border border-[#dcefe9] bg-white px-4 py-2 text-xs font-medium text-[#087f68] shadow-sm">
                <span aria-hidden="true">ϟ</span>
                {t("about.features.aiPowered")}
              </div>

              <div className="flex items-center gap-2 rounded-full border border-[#dcefe9] bg-white px-4 py-2 text-xs font-medium text-[#087f68] shadow-sm">
                <span aria-hidden="true">♧</span>
                {t("about.features.everyone")}
              </div>
            </div>
          </div>

          {/* Right Image */}
          <div className="relative flex h-full min-h-[320px] items-end justify-center px-6 pt-8 lg:px-10">
            
            {/* Background decoration */}
            <div className="absolute right-10 top-10 h-56 w-56 rounded-full bg-[#e4f8f1] blur-2xl" />

            {/* Doctor Image */}
            <div className="relative z-10 h-[300px] w-[280px] overflow-hidden rounded-t-[140px] bg-[#e7f8f2] md:h-[340px] md:w-[320px]">
              <img
                src="/images/about-doctor.png"
                alt={t("about.imageAlt")}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Floating Card */}
            <div className="absolute right-5 top-16 z-20 hidden w-40 rounded-xl border border-[#d8eee7] bg-white/95 p-4 shadow-lg md:block lg:right-10">
              <div
                className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#dff7ef] text-[#10a887]"
                aria-hidden="true"
              >
                ♡
              </div>

              <p className="text-sm font-semibold leading-5 text-[#0b8068]">
                {t("about.card")}
              </p>
            </div>

            {/* Chat bubble */}
            <div
              className="absolute bottom-10 left-5 z-20 hidden h-12 w-12 items-center justify-center rounded-full bg-[#dff7ef] text-xl text-[#0b8068] shadow-md md:flex lg:left-8"
              role="img"
              aria-label={t("about.chatDecoration")}
            >
              💬
            </div>

            {/* Decorative leaves */}
            <div
              className="absolute bottom-8 right-0 text-5xl opacity-30"
              role="img"
              aria-label={t("about.leavesDecoration")}
            >
              🌿
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutHero;
