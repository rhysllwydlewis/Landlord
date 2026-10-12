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
    const animations = new Map<Element, Animation>();
    const seen = new WeakSet<Element>();
    let observer: IntersectionObserver | undefined;
    const cancel = () => {
      animations.forEach((animation) => animation.cancel());
      animations.clear();
    };
    const configure = () => {
      observer?.disconnect();
      observer = undefined;
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
            // Interactive sections fade without moving: cancelling on focus
            // must not shift a button between pointer-down and pointer-up.
            const distance = entry.target.querySelector(
              "a, button, input, select, textarea, summary, [tabindex], [contenteditable]",
            )
              ? 0
              : 26;
            const animation = entry.target.animate(
              [
                { opacity: 0, transform: `translateY(${distance}px)` },
                { opacity: 1, transform: "translateY(0)" },
              ],
              { duration: 850, easing: "cubic-bezier(.2,.7,.2,1)" },
            );
            animations.set(entry.target, animation);
            const forget = () => {
              if (animations.get(entry.target) === animation)
                animations.delete(entry.target);
            };
            void animation.finished.then(forget, forget);
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
    const preserveFocus = (event: FocusEvent) => {
      if (!(event.target instanceof Node)) return;
      for (const [element, animation] of animations) {
        if (element.contains(event.target)) {
          animation.cancel();
          animations.delete(element);
        }
      }
    };
    document.addEventListener("focusin", preserveFocus);
    preference.addEventListener("change", configure);
    configure();
    return () => {
      observer?.disconnect();
      observer = undefined;
      cancel();
      preference.removeEventListener("change", configure);
      document.removeEventListener("focusin", preserveFocus);
    };
  }, []);
  return null;
}
