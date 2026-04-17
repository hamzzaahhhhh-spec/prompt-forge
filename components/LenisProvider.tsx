"use client";

import { useEffect } from "react";
import Lenis from "lenis";

type LenisProviderProps = {
  children: React.ReactNode;
};

export function LenisProvider({ children }: LenisProviderProps) {
  useEffect(() => {
    // Disable Lenis on touch devices entirely — native scroll is smoother and
    // syncTouch causes double-scroll conflicts and lag on iOS/Android.
    const isTouchDevice =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0);

    if (isTouchDevice) {
      return;
    }

    const lenis = new Lenis({
      lerp: 0.1,        // lower lerp = more responsive feel
      smoothWheel: true,
      duration: 1.1,
    });

    let frame = 0;

    const raf = (time: number) => {
      lenis.raf(time);
      frame = window.requestAnimationFrame(raf);
    };

    frame = window.requestAnimationFrame(raf);

    return () => {
      window.cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
