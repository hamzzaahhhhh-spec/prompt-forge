"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LoadingScreenProps = {
  onComplete: () => void;
};

const BRAND = "PromptForge";
const TAGLINE = "Forge masterful prompts";

/**
 * Cinematic loading screen with:
 * 1. Letter-by-letter logo reveal (staggered 3D rotation)
 * 2. Counter 0 → 100%
 * 3. Curtain wipe exit
 */
export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "exiting" | "done">("loading");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const curtainRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef(0);
  const letters = BRAND.split("");

  // Animate progress counter
  useEffect(() => {
    if (phase !== "loading") return;

    const duration = 2200; // 2.2s total loading
    const startTime = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease out cubic for natural feel
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(eased * 100);

      progressRef.current = value;
      setProgress(value);

      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        // Hold at 100% briefly, then exit
        setTimeout(() => setPhase("exiting"), 400);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Curtain wipe exit
  useEffect(() => {
    if (phase !== "exiting") return;

    const curtain = curtainRef.current;
    const container = containerRef.current;
    if (!curtain || !container) return;

    // Fade out content
    container.style.opacity = "0";
    container.style.transform = "scale(0.97)";
    container.style.transition = "opacity 0.5s ease, transform 0.5s ease";

    // Wipe curtain up
    setTimeout(() => {
      curtain.style.transform = "translateY(-100%)";
      curtain.style.transition = "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)";
    }, 300);

    setTimeout(() => {
      setPhase("done");
      onComplete();
    }, 1100);
  }, [phase, onComplete]);

  if (phase === "done") return null;

  return (
    <>
      {/* Main loading content */}
      <div className="loading-screen" ref={containerRef}>
        {/* Subtle gradient background */}
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, rgba(124, 58, 237, 0.08), transparent 60%)",
          }}
        />

        {/* Logo letters */}
        <div className="relative z-10 flex items-baseline justify-center gap-[1px]">
          {letters.map((letter, i) => (
            <span
              key={`${letter}-${i}`}
              className="logo-letter"
              style={{
                animation: `letterReveal 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${i * 0.06}s forwards`,
              }}
            >
              {letter}
            </span>
          ))}
        </div>

        {/* Tagline */}
        <p
          className="relative z-10 mt-6 text-sm tracking-widest uppercase"
          style={{
            color: "var(--text-secondary)",
            opacity: 0,
            animation: "fadeInUp 0.5s ease 0.8s forwards",
          }}
        >
          {TAGLINE}
        </p>

        {/* Progress bar */}
        <div className="relative z-10 mt-10">
          <div className="progress-line">
            <div
              className="progress-fill"
              style={{
                width: `${progress}%`,
                transition: "width 0.1s linear",
              }}
            />
          </div>
          <p className="counter mt-4 text-center tabular-nums">
            {String(progress).padStart(3, "0")}%
          </p>
        </div>

        {/* Credit line */}
        <div
          className="absolute bottom-10 left-0 right-0 text-center"
          style={{
            opacity: 0,
            animation: "fadeInUp 0.5s ease 1.2s forwards",
          }}
        >
          <p className="text-xs tracking-widest uppercase" style={{ color: "var(--text-secondary)" }}>
            A Skyle Project
          </p>
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            By Hamza Malik × Team Skyle
          </p>
        </div>
      </div>

      {/* Curtain overlay for wipe exit */}
      <div ref={curtainRef} className="loading-curtain" />

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes letterReveal {
          0% {
            opacity: 0;
            transform: translateY(40px) rotateX(-90deg);
          }
          100% {
            opacity: 1;
            transform: translateY(0) rotateX(0deg);
          }
        }
        @keyframes fadeInUp {
          0% {
            opacity: 0;
            transform: translateY(12px);
          }
          100% {
            opacity: 0.7;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
