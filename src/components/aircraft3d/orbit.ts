import * as THREE from "three";
import config from "./sceneConfig.json";

const DEG = Math.PI / 180;
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * Camera position on the scroll orbit (p = 0…1), relative to the aircraft.
 * Azimuth is measured from the nose (+x) towards the right wing (+z); `sign` = −1 mirrors it for RTL.
 */
export function orbitPosition(p: number, sign: 1 | -1, out: THREE.Vector3): THREE.Vector3 {
  const keys = config.camera.orbit;
  let i = 1;
  while (i < keys.length - 1 && p > keys[i].p) i++;
  const a = keys[i - 1];
  const b = keys[i];
  const t = ease(Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p))));
  const az = (a.azimuth + (b.azimuth - a.azimuth) * t) * DEG;
  const el = (a.elevation + (b.elevation - a.elevation) * t) * DEG;
  const r = a.radius + (b.radius - a.radius) * t;
  return out.set(sign * r * Math.cos(el) * Math.cos(az), r * Math.sin(el), r * Math.cos(el) * Math.sin(az));
}

export const cameraTarget = new THREE.Vector3(...(config.camera.target as [number, number, number]));
