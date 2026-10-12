"use client";
import { useEffect } from "react";
export function HomeMotion() {
  useEffect(() => {
    if (
      !("IntersectionObserver" in window) ||
      typeof Element.prototype.animate !== "function"
    )
      return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Set<Animation>();
    const seen = new WeakSet<Element>();
    let observer: IntersectionObserver | undefined;
    const cancel = () => {
      animations.forEach((animation) => animation.cancel());
      animations.clear();
    };
    const configure = () => {
      observer?.disconnect();
      if (preference.matches) {
        cancel();
        return;
      }
      const current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (
              observer !== current ||
              !entry.isIntersecting ||
              seen.has(entry.target)
            )
              continue;
            current.unobserve(entry.target);
            seen.add(entry.target);
            // Do not move or briefly hide a control the keyboard user is using.
            if (
              preference.matches ||
              entry.target.contains(document.activeElement)
            )
              continue;
            const animation = entry.target.animate(
              [
                { opacity: 0, transform: "translateY(26px)" },
                { opacity: 1, transform: "translateY(0)" },
              ],
              { duration: 850, easing: "cubic-bezier(.2,.7,.2,1)" },
            );
            animations.add(animation);
            void animation.finished.then(
              () => animations.delete(animation),
              () => animations.delete(animation),
            );
          }
        },
        { threshold: 0.12 },
      );
      observer = current;
      document
        .querySelectorAll(".premium-site [data-reveal]")
        .forEach((element) => {
          if (!seen.has(element)) current.observe(element);
        });
    };
    preference.addEventListener("change", configure);
    configure();
    return () => {
      observer?.disconnect();
      cancel();
      preference.removeEventListener("change", configure);
    };
  }, []);
  return null;
}
