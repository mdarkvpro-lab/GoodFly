import styles from "./Hero.module.css";

/**
 * The GoodFly sun-over-sea emblem (from the logo), drawn in SVG and gently animated:
 * waves drift at three speeds and a small plane crosses on a dotted route.
 * Pure CSS/SVG animation — no JavaScript; reduced motion shows a still version.
 */

const CX = 300;
const CY = 300;
const R = 232;
const HORIZON = 316;

// Sun bands from the top of the disc down to the horizon (like the logo), thinner towards the sea.
const BANDS: [number, number][] = [
  [64, 44],
  [116, 36],
  [160, 31],
  [199, 26],
  [233, 22],
  [263, 18],
  [289, 14],
];

/** A sine-wave band: wavy top edge at `y`, filled down below the disc. Two periods wide so it can loop. */
function wavePath(y: number, amp: number, period: number, phase = 0): string {
  const x0 = CX - R - 10;
  const width = (R * 2 + 20) * 2;
  let d = `M ${x0} 640 L ${x0} ${y}`;
  for (let x = 0; x <= width; x += 8) {
    d += ` L ${(x0 + x).toFixed(1)} ${(y + amp * Math.sin(((x + phase) / period) * Math.PI * 2)).toFixed(1)}`;
  }
  return `${d} L ${x0 + width} 640 Z`;
}

const WAVE_PERIOD = (R * 2 + 20) / 2; // two waves per disc width, so a shift of one disc width loops seamlessly
const PLANE = "M18 0 L5 -2 L-5 -15 L-9.5 -15 L-4 -2 L-12 -2 L-16 -7.5 L-19 -7.5 L-16.5 0 L-19 7.5 L-16 7.5 L-12 2 L-4 2 L-9.5 15 L-5 15 L5 2 Z";
const ROUTE = "M 18 478 C 150 270, 330 118, 588 150";

export function HeroEmblem() {
  return (
    <div className={styles.emblem} aria-hidden="true">
      <svg viewBox="0 0 600 600" className={styles.emblemSvg} focusable="false">
        <defs>
          <clipPath id="gf-disc">
            <circle cx={CX} cy={CY} r={R} />
          </clipPath>
          <linearGradient id="gf-sun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff45a" />
            <stop offset="1" stopColor="#f8d400" />
          </linearGradient>
          <radialGradient id="gf-glow">
            <stop offset="0" stopColor="#f8f808" stopOpacity="0.38" />
            <stop offset="0.55" stopColor="#f8f808" stopOpacity="0.12" />
            <stop offset="1" stopColor="#f8f808" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle className={styles.glow} cx={CX} cy={CY} r={298} fill="url(#gf-glow)" />

        <g clipPath="url(#gf-disc)">
          {BANDS.map(([y, h]) => (
            <rect key={y} x={CX - R} y={y} width={R * 2} height={h} fill="url(#gf-sun)" />
          ))}
          <g className={`${styles.wave} ${styles.waveSlow}`}>
            <path d={wavePath(HORIZON, 9, WAVE_PERIOD)} fill="#7fd3ff" />
          </g>
          <g className={`${styles.wave} ${styles.waveMid}`}>
            <path d={wavePath(HORIZON + 36, 11, WAVE_PERIOD, 60)} fill="#2ea0ff" />
          </g>
          <g className={`${styles.wave} ${styles.waveFast}`}>
            <path d={wavePath(HORIZON + 78, 12, WAVE_PERIOD, 130)} fill="#0858f8" />
          </g>
          <g className={`${styles.wave} ${styles.waveMid}`}>
            <path
              d={wavePath(HORIZON + 122, 10, WAVE_PERIOD, 30)}
              fill="#0a46c8"
            />
          </g>
        </g>

        {/* Dotted flight route and the plane that flies along it */}
        <path id="gf-route" className={styles.route} d={ROUTE} />
        <g className={styles.planeMoving}>
          <path className={styles.planeShape} d={PLANE} transform="scale(1.5)" />
          <animateMotion dur="14s" repeatCount="indefinite" rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.55 1">
            <mpath href="#gf-route" />
          </animateMotion>
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.88;1" dur="14s" repeatCount="indefinite" />
        </g>
        <g className={styles.planeStill} transform="translate(468 128) rotate(-12)">
          <path className={styles.planeShape} d={PLANE} transform="scale(1.5)" />
        </g>
      </svg>
    </div>
  );
}
