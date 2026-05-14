"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Custom cursor — 24px accent circle that lags 8 frames behind the real cursor.
 * Expands to 80px with mix-blend-mode on interactive elements.
 * Morphs to a text bar on inputs/textareas.
 * Hidden on touch devices.
 */
export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef({ x: -100, y: -100 });
  const targetRef = useRef({ x: -100, y: -100 });
  const visibleRef = useRef(false);
  const rafRef = useRef(0);

  const lerp = useCallback((a: number, b: number, t: number) => a + (b - a) * t, []);

  useEffect(() => {
    // Don't mount on touch devices
    const isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return;

    const cursor = cursorRef.current;
    if (!cursor) return;

    const onMouseMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY };

      if (!visibleRef.current) {
        visibleRef.current = true;
        cursor.classList.add("visible");
        // Snap to first position immediately
        posRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const onMouseLeave = () => {
      visibleRef.current = false;
      cursor.classList.remove("visible");
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const tag = target.tagName.toLowerCase();
      const isInteractive =
        tag === "button" ||
        tag === "a" ||
        target.closest("button") !== null ||
        target.closest("a") !== null ||
        target.getAttribute("role") === "button" ||
        target.closest("[role='button']") !== null;

      const isTextInput =
        tag === "textarea" ||
        tag === "input" ||
        target.getAttribute("contenteditable") === "true";

      if (isTextInput) {
        cursor.classList.add("text-mode");
        cursor.classList.remove("hovering");
      } else if (isInteractive) {
        cursor.classList.add("hovering");
        cursor.classList.remove("text-mode");
      } else {
        cursor.classList.remove("hovering", "text-mode");
      }
    };

    // Animation loop — cursor lags behind with lerp (60fps)
    const animate = () => {
      const lerpFactor = 0.15; // ~8 frame lag
      posRef.current.x = lerp(posRef.current.x, targetRef.current.x, lerpFactor);
      posRef.current.y = lerp(posRef.current.y, targetRef.current.y, lerpFactor);

      cursor.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px) translate(-50%, -50%)`;

      rafRef.current = requestAnimationFrame(animate);
    };

    document.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseover", onMouseOver, { passive: true });
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseover", onMouseOver);
      cancelAnimationFrame(rafRef.current);
    };
  }, [lerp]);

  return <div ref={cursorRef} className="custom-cursor" aria-hidden="true" />;
}
