"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  canUseWebGL,
  gsap,
  prefersLightweight,
  registerGsap,
  ScrollTrigger,
  useClientValue,
  useGSAP,
  usePrefersReducedMotion,
  useTheme,
} from "@/lib/motion";
import { detectQuality, lowerTier, type QualityTier } from "./quality";
import styles from "./HeroStage.module.css";

const AircraftScene = dynamic(() => import("./AircraftScene"), { ssr: false });

type Props = { children: ReactNode };

registerGsap();

export function HeroStage({ children }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const reduced = usePrefersReducedMotion();
  const theme = useTheme();
  const capable = useClientValue(() => canUseWebGL() && !prefersLightweight(), false);
  const dir = useClientValue<"ltr" | "rtl">(() => (document.documentElement.dir === "rtl" ? "rtl" : "ltr"), "ltr");
  const detectedTier = useClientValue<QualityTier>(detectQuality, "high");
  const [tierOverride, setTierOverride] = useState<QualityTier | null>(null);
  const tier = tierOverride ?? detectedTier;
  const [idle, setIdle] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const want3D = idle && capable && !reduced;
  const onReady = useCallback(() => setReady(true), []);
  const onSlow = useCallback(() => setTierOverride((t) => lowerTier(t ?? detectedTier)), [detectedTier]);

  // Load the 3D scene only after the page is idle, so the poster stays the first paint.
  useEffect(() => {
    const start = () => setIdle(true);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 300);
    return () => clearTimeout(id);
  }, []);

  // Pause rendering when the hero is off screen or the tab is hidden.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && !document.hidden));
    io.observe(el);
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Pin the hero for 1.5 extra screens and turn scroll into camera progress.
  useGSAP(
    () => {
      const section = stageRef.current?.closest("section");
      if (!section || reduced) return;
      const header = document.querySelector("header");
      const offset = () => header?.getBoundingClientRect().height ?? 0;
      const copy = section.querySelector("[data-hero-copy]");

      // Desktop/tablet only: on phones the hero is not full-screen, so it scrolls normally.
      const mm = gsap.matchMedia();
      mm.add("(min-width: 721px)", () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: () => `top top+=${offset()}`,
            end: "+=150%",
            pin: true,
            scrub: true,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              progress.current = self.progress;
            },
          },
        });
        if (copy) tl.to(copy, { yPercent: -18, opacity: 0.25, ease: "none" }, 0);
        return () => {
          progress.current = 0;
        };
      });
      return () => mm.revert();
    },
    { dependencies: [reduced], revertOnUpdate: true },
  );

  useEffect(() => {
    if (ready) ScrollTrigger.refresh();
  }, [ready]);

  return (
    <div ref={stageRef} className={styles.stage} data-3d={want3D && ready ? "on" : "off"}>
      <div className={styles.posterWrap} data-tier={tier}>
        {children}
      </div>
      {want3D && (
        <div className={styles.canvasWrap} aria-hidden="true">
          <AircraftScene
            progress={progress}
            theme={theme}
            dir={dir}
            active={visible}
            tier={tier}
            onReady={onReady}
            onSlow={onSlow}
          />
        </div>
      )}
    </div>
  );
}
