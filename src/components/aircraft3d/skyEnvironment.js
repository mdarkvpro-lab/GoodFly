// Shared by the site (AircraftScene.tsx) and the poster renderer (scripts/aircraft/poster.html),
// so the live scene and the still images reflect exactly the same sky. Plain JS on purpose.
import * as THREE from "three";

const SKIES = {
  light: { zenith: "#5b8fd8", horizon: "#eef3f9", ground: "#9aa3ae", sun: "#fff1dc", strength: 40, size: 600 },
  dark: { zenith: "#050b18", horizon: "#1c2b4d", ground: "#03060c", sun: "#cfdcff", strength: 6, size: 900 },
};

/**
 * Gradient sky with a sun (or moon) highlight, pre-filtered for physically based reflections.
 * @param {THREE.WebGLRenderer} renderer
 * @param {"light" | "dark"} theme
 * @param {[number, number, number]} sunPosition direction of the key light
 * @returns {THREE.Texture}
 */
export function createSkyEnvironment(renderer, theme, sunPosition) {
  const sky = SKIES[theme];
  const scene = new THREE.Scene();
  const geometry = new THREE.SphereGeometry(50, 64, 32);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(sky.zenith) },
      horizon: { value: new THREE.Color(sky.horizon) },
      ground: { value: new THREE.Color(sky.ground) },
      sunColor: { value: new THREE.Color(sky.sun) },
      sunDir: { value: new THREE.Vector3(...sunPosition).normalize() },
      sunSize: { value: sky.size },
      sunStrength: { value: sky.strength },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith, horizon, ground, sunColor, sunDir;
      uniform float sunSize, sunStrength;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = d.y > 0.0 ? mix(horizon, zenith, pow(d.y, 0.55)) : mix(horizon, ground, pow(-d.y, 0.4));
        float s = max(dot(d, sunDir), 0.0);
        c += sunColor * (pow(s, sunSize) * sunStrength + pow(s, 12.0) * 0.35);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(geometry, material));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.015);
  pmrem.dispose();
  geometry.dispose();
  material.dispose();
  return target.texture;
}
