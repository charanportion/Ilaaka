"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type Theme = "dark" | "light";

type Ctx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

const STORAGE_KEY = "ilaaka.theme";

/**
 * Reads the same value the inline boot script writes — see
 * `setInitialThemeScript` in app/layout.tsx. By the time React hydrates,
 * the html tag already has `theme-light` or not, and this state matches.
 */
function readInitial(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("theme-light")
    ? "light"
    : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitial);

  const apply = useCallback((next: Theme) => {
    if (typeof document === "undefined") return;
    if (next === "light") {
      document.documentElement.classList.add("theme-light");
    } else {
      document.documentElement.classList.remove("theme-light");
    }
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore — storage may be blocked (private mode, etc.) */
    }
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      apply(next);
    },
    [apply],
  );

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  /* If the user hasn't explicitly chosen a theme, keep tracking system
     preference changes (e.g. they toggle macOS appearance at sunset). */
  useEffect(() => {
    const stored = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    if (stored === "light" || stored === "dark") return; // explicit choice; respect it
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) => {
      const next: Theme = e.matches ? "light" : "dark";
      setThemeState(next);
      apply(next);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [apply]);

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

/**
 * Inline script that runs before React hydration. Reads localStorage or
 * `prefers-color-scheme`, applies `theme-light` to <html> if needed.
 * Avoids a flash of dark-then-light on first paint for light-mode users.
 *
 * Embed via `<script dangerouslySetInnerHTML={{ __html: setInitialThemeScript }} />`
 * inside <head>.
 */
export const setInitialThemeScript = `
(function(){
  try {
    var k = '${STORAGE_KEY}';
    var v = localStorage.getItem(k);
    var sys = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    var t = (v === 'light' || v === 'dark') ? v : sys;
    if (t === 'light') document.documentElement.classList.add('theme-light');
    document.documentElement.style.colorScheme = t;
  } catch (e) {}
})();
`;
