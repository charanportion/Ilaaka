/**
 * Three illustrated install steps shown alongside the auto-download.
 * Pure server component — no interactivity, no client JS.
 */
export function InstallSteps() {
  const steps: Array<{ n: string; title: string; body: string; icon: React.ReactNode }> = [
    {
      n: "01",
      title: "Open the file",
      body: "Tap the download notification, or find ilaaka.apk in your Downloads.",
      icon: <DownloadIcon />,
    },
    {
      n: "02",
      title: "Allow the install",
      body: "Android may ask permission to install apps from your browser the first time. Tap Allow.",
      icon: <ShieldIcon />,
    },
    {
      n: "03",
      title: "Open Ilaaka",
      body: "Tap Install, then Open. Sign in and start claiming your neighbourhood.",
      icon: <BoltIcon />,
    },
  ];

  return (
    <ol className="grid gap-4 sm:grid-cols-3">
      {steps.map((s) => (
        <li
          key={s.n}
          className="card-surface p-5 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-fg-subtle">
              Step {s.n}
            </span>
            <span
              aria-hidden
              className="w-9 h-9 rounded-full grid place-items-center text-fg"
              style={{ borderWidth: 1, borderColor: "var(--color-rule)" }}
            >
              {s.icon}
            </span>
          </div>
          <h3 className="font-serif text-[1.2rem] leading-tight text-fg">
            {s.title}
          </h3>
          <p className="text-fg-muted/80 text-[0.92rem] leading-relaxed">
            {s.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4 V16" />
      <path d="M6 11 L12 17 L18 11" />
      <path d="M5 21 H19" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z" />
      <path d="M9 12 L11 14 L15 10" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 3 L4 14 H11 L10 21 L20 9 H13 Z" />
    </svg>
  );
}
