"use client";
import { useEffect } from "react";
export function HomeMotion() {
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches || !("IntersectionObserver" in window)) return;
    const animations: Animation[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!preference.matches)
            animations.push(
              entry.target.animate(
                [
                  { opacity: 0, transform: "translateY(26px)" },
                  { opacity: 1, transform: "translateY(0)" },
                ],
                { duration: 850, easing: "cubic-bezier(.2,.7,.2,1)" },
              ),
            );
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12 },
    );
    document
      .querySelectorAll(".premium-site [data-reveal]")
      .forEach((element) => observer.observe(element));
    const stop = () => {
      if (preference.matches) {
        animations.forEach((animation) => animation.cancel());
        observer.disconnect();
      }
    };
    preference.addEventListener("change", stop);
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
      preference.removeEventListener("change", stop);
    };
  }, []);
  return null;
}
