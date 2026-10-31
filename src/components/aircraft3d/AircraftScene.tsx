"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { Theme } from "@/lib/motion";
import { QUALITY, type QualityTier } from "./quality";
import anchors from "./aircraftAnchors.json";
import { cameraTarget, orbitPosition } from "./orbit";
import config from "./sceneConfig.json";
import { buildCloudTexture, buildHaloTexture } from "./sceneTextures";
import { createSkyEnvironment } from "./skyEnvironment.js";

type Dir = "ltr" | "rtl";
type Props = {
  progress: RefObject<number>;
  theme: Theme;
  dir: Dir;
  active: boolean;
  tier: QualityTier;
  onReady: () => void;
  onSlow: () => void;
};

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const CABIN_GLOW = "#ffcf8a";

type Light = { position: number[]; color: string; kind: string };

/** Navigation lights as soft additive halos: subtle by day, glowing at night. */
function NavLights({ night }: { night: boolean }) {
  const halo = useMemo(() => buildHaloTexture(), []);
  useEffect(() => () => halo.dispose(), [halo]);
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const lights = anchors.lights as Light[];

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const base = night ? 0.55 : 0.22;
    lights.forEach((light, i) => {
      const s = sprites.current[i];
      if (!s) return;
      let k = 1;
      if (light.kind === "strobe") {
        const p = t % 1.4; // double flash
        k = p < 0.05 || (p > 0.14 && p < 0.19) ? 1 : 0;
      } else if (light.kind === "beacon") {
        k = Math.pow(Math.max(0, Math.sin(t * 3.2)), 6);
      }
      (s.material as THREE.SpriteMaterial).opacity = (night ? 1 : 0.5) * k;
      s.scale.setScalar(base * (light.kind === "strobe" ? 1.6 : 1) * (0.6 + 0.4 * k));
    });
  });

  return (
    <>
      {lights.map((light, i) => (
        <sprite
          key={i}
          ref={(el) => {
            sprites.current[i] = el;
          }}
          position={light.position as [number, number, number]}
        >
          <spriteMaterial map={halo} color={light.color} blending={THREE.AdditiveBlending} transparent depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </>
  );
}

type LoadedModel = {
  scene: THREE.Group;
  fans: THREE.Object3D[];
  cabin: THREE.MeshStandardMaterial[];
  meshes: THREE.Mesh[];
};

/** The GoodFly airliner GLB (built by scripts/aircraft/build.ts). */
function Airliner({ url, night, dir, progress, shadows, onLoaded }: {
  url: string;
  night: boolean;
  dir: Dir;
  progress: RefObject<number>;
  shadows: boolean;
  onLoaded: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  // State holds only what is rendered; the parts the frame loop changes live in a ref.
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const parts = useRef<LoadedModel | null>(null);
  const applied = useRef<{ model: LoadedModel | null; night: boolean | null; shadows: boolean | null }>({
    model: null,
    night: null,
    shadows: null,
  });
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const ready = scene !== null;

  useEffect(() => {
    let cancelled = false;
    const anisotropy = Math.min(8, maxAnisotropy);
    new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .loadAsync(url)
      .then((gltf) => {
        if (cancelled) return;
        const root = gltf.scene;
        const meshes: THREE.Mesh[] = [];
        const cabin: THREE.MeshStandardMaterial[] = [];
        root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          meshes.push(mesh);
          const mat = mesh.material as THREE.MeshStandardMaterial;
          // The aircraft is mostly seen at steep angles: anisotropic filtering keeps the livery crisp.
          for (const tex of [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.emissiveMap]) {
            if (tex) tex.anisotropy = anisotropy;
          }
          if (mat.emissiveMap) cabin.push(mat);
        });
        const fans = anchors.fans.map((name) => root.getObjectByName(name)).filter((o): o is THREE.Object3D => Boolean(o));
        parts.current = { scene: root, fans, cabin, meshes };
        setScene(root);
      });
    return () => {
      cancelled = true;
    };
  }, [url, maxAnisotropy]);

  useEffect(() => {
    if (!ready) return;
    // Two frames after the model is in the scene, the canvas can fade in over the poster.
    const id = requestAnimationFrame(() => requestAnimationFrame(onLoaded));
    return () => cancelAnimationFrame(id);
  }, [ready, onLoaded]);

  useFrame(({ clock }, dt) => {
    const model = parts.current;
    if (model) {
      // Theme and quality changes are applied here (scene objects are mutated in the frame loop, not in effects).
      const a = applied.current;
      if (a.model !== model || a.night !== night) {
        const intensity = night ? config.lighting.dark.cabinGlow : config.lighting.light.cabinGlow;
        for (const mat of model.cabin) mat.setValues({ emissive: intensity > 0 ? CABIN_GLOW : "#000000", emissiveIntensity: intensity });
      }
      if (a.model !== model || a.shadows !== shadows) {
        for (const mesh of model.meshes) Object.assign(mesh, { castShadow: shadows, receiveShadow: shadows });
      }
      applied.current = { model, night, shadows };
      for (const fan of model.fans) fan.rotateX(dt * 4.5);
    }

    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const p = smooth(clamp01(progress.current ?? 0));
    const { from, forward, climb } = config.camera.departure;
    const leave = smooth(clamp01((p - from) / (1 - from)));
    // Idle float, a gentle bank towards the camera mid-scroll, then a calm departure.
    const bankSign = dir === "rtl" ? -1 : 1;
    g.position.set(forward * leave, Math.sin(t * 0.5) * 0.05 + climb * leave, 0);
    g.rotation.x = Math.sin(t * 0.35) * 0.012 + bankSign * Math.sin(Math.min(p / from, 1) * Math.PI) * 0.08;
    g.rotation.z = Math.sin(t * 0.27) * 0.006 + leave * 0.06;
  });

  if (!scene) return null;
  return (
    <group rotation={[0, dir === "rtl" ? Math.PI : 0, 0]}>
      <group ref={group}>
        <primitive object={scene} />
        <NavLights night={night} />
      </group>
    </group>
  );
}

// Fixed seed so the cloud layout is identical on every visit.
const PUFFS = (() => {
  let s = 11;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 22 }, (_, i) => {
    const far = i % 3 === 0;
    return {
      x: rand() * 90 - 45,
      y: far ? -1.6 - rand() * 1.2 : -3.2 - rand() * 2.2,
      z: far ? -26 - rand() * 14 : -12 + rand() * 16,
      w: far ? 15 + rand() * 10 : 8 + rand() * 8,
      variant: i % 3,
      speed: far ? 0.35 : 0.9 + rand() * 0.5,
    };
  });
})();

/** Soft cloud deck drifting past the aircraft; it rises gently as the aircraft departs. */
function Clouds({ night, dir, count, progress }: { night: boolean; dir: Dir; count: number; progress: RefObject<number> }) {
  const textures = useMemo(() => [buildCloudTexture(3), buildCloudTexture(17), buildCloudTexture(41)], []);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);
  const deck = useRef<THREE.Group>(null);
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const sign = dir === "rtl" ? -1 : 1;
  const puffs = PUFFS.slice(0, count);

  useFrame((_, dt) => {
    const p = clamp01(progress.current ?? 0);
    if (deck.current) deck.current.position.y = smooth(clamp01((p - 0.7) / 0.3)) * 1.6;
    puffs.forEach((puff, i) => {
      const s = sprites.current[i];
      if (!s) return;
      s.position.x -= sign * puff.speed * dt;
      if (s.position.x < -48) s.position.x += 96;
      if (s.position.x > 48) s.position.x -= 96;
    });
  });

  return (
    <group ref={deck}>
      {puffs.map((puff, i) => (
        <sprite
          key={i}
          ref={(el) => {
            sprites.current[i] = el;
          }}
          position={[puff.x, puff.y, puff.z]}
          scale={[puff.w, puff.w * 0.5, 1]}
        >
          <spriteMaterial
            map={textures[puff.variant]}
            color={night ? "#6f88bd" : "#ffffff"}
            opacity={(night ? 0.15 : 0.9) * (puff.z < -20 ? 0.6 : 1)}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  );
}

/** Sky reflections (gradient, horizon and sun) so paint, chrome and glass read photographically. */
function Environment({ theme, intensity, sun }: { theme: Theme; intensity: number; sun: [number, number, number] }) {
  const gl = useThree((s) => s.gl);
  const [sx, sy, sz] = sun;
  const env = useMemo(() => createSkyEnvironment(gl, theme, [sx, sy, sz]), [gl, theme, sx, sy, sz]);
  useEffect(() => () => env.dispose(), [env]);
  useFrame(({ scene }) => {
    scene.environmentIntensity = intensity;
  });
  return <primitive object={env} attach="environment" />;
}

// Scratch values reused every frame (no per-frame allocation).
const target = new THREE.Vector3();
const look = new THREE.Vector3();
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

/** Scroll-driven orbit with ~1 s smoothing, plus a light pointer parallax on desktop. */
function CameraRig({ progress, dir }: { progress: RefObject<number>; dir: Dir }) {
  const currentLook = useRef<THREE.Vector3 | null>(null);
  const sign = dir === "rtl" ? -1 : 1;

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      pointer.x = pointer.y = 0;
    };
  }, []);

  useFrame(({ camera, size }, dt) => {
    const p = clamp01(progress.current ?? 0);
    // Framing is tuned for a wide stage; narrower stages move the camera back so the aircraft fits.
    const fit = Math.min(2.6, Math.max(1, config.camera.aspectTuned / Math.max(0.4, size.width / size.height)));
    const k = 1 - Math.exp(-dt * 3);
    pointer.sx += (pointer.x - pointer.sx) * k;
    pointer.sy += (pointer.y - pointer.sy) * k;
    orbitPosition(p, sign, target).multiplyScalar(fit);
    target.x += pointer.sx * 0.45;
    target.y -= pointer.sy * 0.3;
    look.copy(cameraTarget).setX(cameraTarget.x * sign);
    if (!currentLook.current) {
      currentLook.current = look.clone();
      camera.position.copy(target);
    }
    camera.position.lerp(target, k);
    currentLook.current.lerp(look, k);
    camera.lookAt(currentLook.current);
  });
  return null;
}

/** Steps quality down when the frame rate stays low (measured over 2.5 s windows). */
function FrameGuard({ onSlow }: { onSlow: () => void }) {
  const acc = useRef({ time: 0, frames: 0, warmup: 2 });
  useFrame((_, dt) => {
    const a = acc.current;
    if (a.warmup > 0) {
      a.warmup -= dt;
      return;
    }
    a.time += dt;
    a.frames += 1;
    if (a.time >= 2.5) {
      if (a.frames / a.time < 40) onSlow();
      a.time = 0;
      a.frames = 0;
    }
  });
  return null;
}

export default function AircraftScene({ progress, theme, dir, active, tier, onReady, onSlow }: Props) {
  const quality = QUALITY[tier];
  const night = theme === "dark";
  const l = night ? config.lighting.dark : config.lighting.light;
  const shadows = quality.shadowMapSize > 0;
  const S = config.shadows;

  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={quality.dpr}
      shadows={shadows ? "soft" : false}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMappingExposure: l.exposure }}
      camera={{ fov: config.camera.fov, near: 0.1, far: 160 }}
    >
      <Environment theme={theme} intensity={l.environment} sun={l.sun.position as [number, number, number]} />
      <hemisphereLight args={[l.hemisphere.sky, l.hemisphere.ground, l.hemisphere.intensity]} />
      <directionalLight
        position={l.sun.position as [number, number, number]}
        intensity={l.sun.intensity}
        color={l.sun.color}
        castShadow={shadows}
        shadow-mapSize={[quality.shadowMapSize || 512, quality.shadowMapSize || 512]}
        shadow-bias={S.bias}
        shadow-normalBias={S.normalBias}
        shadow-camera-left={-S.bounds}
        shadow-camera-right={S.bounds}
        shadow-camera-top={S.bounds}
        shadow-camera-bottom={-S.bounds}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      <directionalLight position={l.fill.position as [number, number, number]} intensity={l.fill.intensity} color={l.fill.color} />
      <Clouds night={night} dir={dir} count={quality.clouds} progress={progress} />
      <Airliner url={quality.model} night={night} dir={dir} progress={progress} shadows={shadows} onLoaded={onReady} />
      <CameraRig progress={progress} dir={dir} />
      {tier !== "low" && <FrameGuard onSlow={onSlow} />}
    </Canvas>
  );
}
