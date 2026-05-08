export function Footer() {
  return (
    <footer
      className="relative bg-canvas px-5 sm:px-8 py-10 sm:py-12"
      style={{ borderTop: "1px solid var(--color-rule)" }}
    >
      <div className="mx-auto max-w-[1380px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <span
            className="hex-tile w-5 h-[18px]"
            style={{ ["--hex-color" as never]: "var(--color-fg)" }}
          />
          <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-fg-subtle">
            Built in Hyderabad, 2026
          </p>
        </div>
        <nav className="flex items-center gap-6 sm:gap-8 font-mono text-[12px] tracking-[0.18em] uppercase text-fg-muted/70">
          <a href="/privacy" className="hover:text-fg transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-fg transition-colors">Terms</a>
          <a href="mailto:sricharan.rayala@dotportion.com" className="hover:text-fg transition-colors">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
