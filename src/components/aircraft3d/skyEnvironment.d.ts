import type * as THREE from "three";

export function createSkyEnvironment(
  renderer: THREE.WebGLRenderer,
  theme: "light" | "dark",
  sunPosition: [number, number, number],
): THREE.Texture;
