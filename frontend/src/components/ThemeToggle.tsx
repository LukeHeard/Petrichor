"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "petrichor_theme";
const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      setIsDark(stored === "dark");
    } else {
      setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    // Once mounted, keep following the system theme live, but only until the
    // user makes an explicit choice of their own.
    if (!mounted || localStorage.getItem(STORAGE_KEY)) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mounted]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
  };

  // Avoid rendering with a guessed theme before we know the real one - prevents a flash
  // of the wrong sun/moon icon on load.
  if (!mounted) return null;

  return (
    <button
      className={`theme-toggle-btn${isDark ? " is-dark" : ""}`}
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <svg viewBox="0 0 24 24" fill="none">
        <mask id="theme-toggle-moon-mask">
          <rect x="0" y="0" width="24" height="24" fill="white" />
          <circle className="theme-toggle-cutter" cx="12" cy="12" r="4.6" fill="black" />
        </mask>
        <g className="theme-toggle-rays">
          {RAY_ANGLES.map((deg) => (
            <line
              key={deg}
              x1="12"
              y1="2.5"
              x2="12"
              y2="5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              transform={`rotate(${deg} 12 12)`}
            />
          ))}
        </g>
        <circle className="theme-toggle-body" cx="12" cy="12" r="5" fill="currentColor" mask="url(#theme-toggle-moon-mask)" />
      </svg>
    </button>
  );
}
