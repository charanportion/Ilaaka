type Feature = {
  num: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  span?: "wide" | "tall" | "default";
};

const FEATURES: Feature[] = [
  {
    num: "F.01",
    title: "Your real neighbourhood, gamified.",
    body: "The map is your streets, not a fictional world. Recognise every road you claim — Banjara Hills, Jubilee Hills, Gachibowli.",
    icon: <NeighbourhoodIcon />,
    span: "wide",
  },
  {
    num: "F.02",
    title: "Friendly rivalry, not chores.",
    body: "No daily streak guilt-trips. Lose your zone? Get a notification. Walk back when you feel like it.",
    icon: <NoChoresIcon />,
  },
  {
    num: "F.03",
    title: "Crews of 10.",
    body: "Form a crew with your building, society or running group. Claim territory together. Cap is 10 for cohesion.",
    icon: <CrewIcon />,
  },
  {
    num: "F.04",
    title: "Privacy by design.",
    body: "Your home is yours. Configure a private radius and your zones there stay invisible to everyone.",
    icon: <PrivacyIcon />,
    span: "wide",
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="relative px-5 sm:px-8 py-24 sm:py-36 bg-canvas-2"
    >
      <div className="mx-auto max-w-[1380px]">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 max-w-5xl">
          <div>
            <p className="eyebrow mb-5">Why people stay</p>
            <h2 className="display-2 text-fg max-w-[18ch] text-balance">
              Built for{" "}
              <span className="wonk text-fg">honest</span> walks.
            </h2>
          </div>
          <p className="max-w-[34ch] text-fg-muted/70 text-[0.98rem] leading-[1.55]">
            Four answers to the four questions every sceptical Indian friend
            asks before installing.
          </p>
        </header>

        <div className="mt-14 sm:mt-20 grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.num} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature: f, index }: { feature: Feature; index: number }) {
  const span =
    f.span === "wide"
      ? "lg:col-span-2"
      : f.span === "tall"
        ? "lg:row-span-2"
        : "";

  return (
    <article
      className={`card-surface group relative p-7 sm:p-9 flex flex-col ${span} min-h-[280px]`}
      style={{
        animationDelay: `${index * 80}ms`,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 52'><polygon points='30,1 58,16 58,38 30,52 2,38 2,16' fill='none' stroke='white' stroke-width='1.5'/></svg>\")",
          backgroundSize: "44px 38px",
        }}
      />

      <div className="flex items-start justify-between gap-4 relative z-10">
        <span
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-fg"
          style={{
            background: "color-mix(in oklab, var(--color-fg) 8%, transparent)",
            border: "1px solid color-mix(in oklab, var(--color-fg) 22%, transparent)",
          }}
        >
          {f.icon}
        </span>
        <span
          className="font-mono text-[10px] tracking-[0.22em] uppercase text-fg-subtle"
        >
          {f.num}
        </span>
      </div>

      <h3
        className="mt-8 sm:mt-10 display-3 text-fg text-balance max-w-[18ch] relative z-10"
      >
        {f.title}
      </h3>
      <p className="mt-4 text-fg-muted/70 text-[0.98rem] leading-[1.55] max-w-[42ch] relative z-10">
        {f.body}
      </p>
    </article>
  );
}

/* ---------- icons ---------- */

function NeighbourhoodIcon() {
  return (
    <svg viewBox="0 0 28 28" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13 L14 4 L25 13 V24 H3 Z" />
      <path d="M10 24 V16 H18 V24" />
      <circle cx="14" cy="11" r="1.4" fill="currentColor" />
    </svg>
  );
}

function NoChoresIcon() {
  return (
    <svg viewBox="0 0 28 28" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="14" cy="14" r="10" />
      <path d="M14 8 V14 L18 16" />
      <path d="M3 6 L8 6" />
      <path d="M20 22 L25 22" />
    </svg>
  );
}

function CrewIcon() {
  return (
    <svg viewBox="0 0 28 28" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="11" r="3.5" />
      <circle cx="19" cy="11" r="3.5" />
      <path d="M3 23 C4.5 18 7 17 9 17 C11 17 13.5 18 15 23" />
      <path d="M13 23 C14.5 18 17 17 19 17 C21 17 23.5 18 25 23" />
    </svg>
  );
}

function PrivacyIcon() {
  return (
    <svg viewBox="0 0 28 28" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3 L23 7 V14 C23 19 19 23 14 25 C9 23 5 19 5 14 V7 Z" />
      <circle cx="14" cy="13" r="2.4" />
      <path d="M14 15.5 V19" />
    </svg>
  );
}
