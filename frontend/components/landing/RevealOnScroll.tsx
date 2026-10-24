"use client";

import React, { useEffect, useRef, useState } from "react";

interface RevealOnScrollProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  durationMs?: number;
  yOffset?: number;
  scaleFrom?: number;
  threshold?: number;
  replay?: boolean;
}

export function RevealOnScroll({
  children,
  className = "",
  delayMs = 0,
  durationMs = 650,
  yOffset = 22,
  scaleFrom = 0.985,
  threshold = 0.1,
  replay = true,
}: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Respect system reduced-motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const onMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mediaQuery.addEventListener("change", onMotionChange);

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
        } else if (replay) {
          // Re-arm animation when user scrolls away so returning triggers smooth reveal
          setIsIntersecting(false);
        }
      },
      {
        threshold,
        rootMargin: "0px 0px -30px 0px",
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", onMotionChange);
    };
  }, [threshold, replay]);

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const isVisible = isIntersecting;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? "translate3d(0, 0, 0) scale(1)"
          : `translate3d(0, ${yOffset}px, 0) scale(${scaleFrom})`,
        transitionProperty: "opacity, transform",
        transitionDuration: `${durationMs}ms`,
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        transitionDelay: `${isVisible ? delayMs : 0}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
