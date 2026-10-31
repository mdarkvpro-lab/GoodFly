"use client";

import { useRef, type ReactNode } from "react";
import { gsap, registerGsap, useGSAP, usePrefersReducedMotion } from "@/lib/motion";

registerGsap();

type Props = { children: ReactNode; className?: string; as?: "div" | "ul" };

/** Children rise 24px and fade in once, 60ms apart, when they enter the screen. */
export function Reveal({ children, className, as = "div" }: Props) {
  const ref = useRef<HTMLDivElement & HTMLUListElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reduced || !ref.current) return;
      gsap.from(ref.current.children, {
        y: 24,
        opacity: 0,
        duration: 0.7,
        ease: "expo.out",
        stagger: 0.06,
        scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
      });
    },
    { scope: ref, dependencies: [reduced], revertOnUpdate: true },
  );

  const Tag = as;
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
