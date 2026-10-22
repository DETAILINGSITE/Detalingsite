"use client";
/**
 * 3D hero (docs/PLAN.md §7). Loaded lazily with ssr:false by HeroStage.
 * - DPR clamped: ≤1.5 on mobile, ≤2 on desktop
 * - frameloop="demand": renders only when scroll progress changes
 * - IntersectionObserver: no rendering while the hero is off-screen
 * - FPS guard: if the first frames are too slow, fall back to the poster
 * - Error boundary: any WebGL/model failure leaves the poster in place
 * - Resources disposed on unmount
 */
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

const MODEL_URL = "/models/car.glb";

class CanvasBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(err: unknown) {
    console.warn("[hero-3d] disabled:", err);
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Scroll progress of the hero (0 at top → 1 when its pinned distance is scrolled). */
function useHeroProgress() {
  const progress = useRef(0);
  const invalidateRef = useRef<() => void>(() => {});
  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-hero]");
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const distance = Math.max(1, el.offsetHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, -rect.top / distance));
      if (Math.abs(p - progress.current) > 0.0005) {
        progress.current = p;
        invalidateRef.current();
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return { progress, invalidateRef };
}

function Car({ progress, mobile }: { progress: { current: number }; mobile: boolean }) {
  const gl = useThree((s) => s.gl);
  const ktx2 = useMemo(() => new KTX2Loader().setTranscoderPath("/basis/").detectSupport(gl), [gl]);
  const { scene } = useGLTF(MODEL_URL, false, true, (loader) => {
    (loader as unknown as { setKTX2Loader: (l: KTX2Loader) => void }).setKTX2Loader(ktx2);
  });
  const group = useRef<THREE.Group>(null);
  const smooth = useRef(0);

  // Normalise any model to a consistent size and sit it on the floor.
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const scale = 4.2 / Math.max(size.x, size.z, 0.001);
    clone.scale.setScalar(scale);
    const scaled = new THREE.Box3().setFromObject(clone);
    const center = scaled.getCenter(new THREE.Vector3());
    clone.position.sub(new THREE.Vector3(center.x, scaled.min.y, center.z));
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = false;
    });
    return clone;
  }, [scene]);

  useEffect(
    () => () => {
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          Object.values(m as unknown as Record<string, unknown>).forEach((v) => {
            if (v instanceof THREE.Texture) v.dispose();
          });
          m.dispose();
        });
      });
      ktx2.dispose();
    },
    [model, ktx2],
  );

  useFrame((state, delta) => {
    // Ease toward the scroll target so wheel steps feel smooth; keep requesting
    // frames only while still moving (frameloop="demand").
    const target = progress.current;
    smooth.current = THREE.MathUtils.damp(smooth.current, target, 6, delta);
    const p = smooth.current;
    if (group.current) group.current.rotation.y = -0.6 + p * (mobile ? 1.6 : 3.5);
    const angle = 0.35 + p * (mobile ? 0.4 : 0.9);
    const radius = mobile ? 8.4 : 7.2 - p * 1.2;
    state.camera.position.set(Math.sin(angle) * radius, 1.6 + p * 0.6, Math.cos(angle) * radius);
    state.camera.lookAt(0, 0.6, 0);
    // Light sweep: rotate the baked studio environment so highlights travel across the paint.
    (state.scene as THREE.Scene & { environmentRotation: THREE.Euler }).environmentRotation.set(0, p * Math.PI * 1.6, 0);
    if (Math.abs(target - p) > 0.0005) state.invalidate();
  });

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

function FpsGuard({ onSlow }: { onSlow: () => void }) {
  const frames = useRef<number[]>([]);
  const tripped = useRef(false);
  useFrame((_, delta) => {
    if (tripped.current || frames.current.length >= 60) return;
    frames.current.push(delta);
    if (frames.current.length === 60) {
      const avg = frames.current.slice(10).reduce((a, b) => a + b, 0) / 50;
      if (avg > 0.05) {
        tripped.current = true;
        onSlow();
      }
    }
  });
  return null;
}

function Ready({ onReady }: { onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    // Compile shaders off the main thread where supported (no long task on first frame).
    const r = gl as THREE.WebGLRenderer & { compileAsync?: (s: THREE.Object3D, c: THREE.Camera) => Promise<unknown> };
    (r.compileAsync ? r.compileAsync(scene, camera) : Promise.resolve()).then(() => requestAnimationFrame(onReady));
  }, [gl, scene, camera, onReady]);
  return null;
}

export default function HeroCanvas() {
  const wrapper = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const mobile = useMemo(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches, []);
  const { progress, invalidateRef } = useHeroProgress();

  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.hero3d = disabled ? "off:failed" : ready ? "on" : "loading";
  }, [ready, disabled]);

  if (disabled) return null;

  return (
    <div
      ref={wrapper}
      aria-hidden="true"
      data-testid="hero-canvas"
      className="absolute inset-0 transition-opacity duration-700"
      style={{ opacity: ready ? 1 : 0 }}
    >
      <CanvasBoundary onError={() => setDisabled(true)}>
        <Canvas
          dpr={[1, mobile ? 1.5 : 2]}
          frameloop={visible ? "demand" : "never"}
          camera={{ fov: 32, near: 0.1, far: 60, position: [3, 1.6, 7] }}
          gl={{ antialias: !mobile, powerPreference: "high-performance", alpha: true }}
          onCreated={({ gl, invalidate }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            invalidateRef.current = invalidate;
            gl.domElement.addEventListener("webglcontextlost", () => setDisabled(true));
            (window as unknown as { __hero3d?: unknown }).__hero3d = gl;
          }}
        >
          <Suspense fallback={null}>
            <Environment resolution={256} frames={1}>
              <Lightformer form="rect" intensity={4} position={[0, 5, -2]} scale={[10, 1.2, 1]} color="#fff6e0" />
              <Lightformer form="rect" intensity={2} position={[-5, 2, 1]} rotation-y={Math.PI / 2} scale={[8, 1, 1]} />
              <Lightformer form="rect" intensity={2} position={[5, 1.5, 1]} rotation-y={-Math.PI / 2} scale={[8, 0.6, 1]} />
              <Lightformer form="ring" intensity={1.5} position={[0, 3, 6]} scale={3} color="#f0dfae" />
            </Environment>
            <Car progress={progress} mobile={mobile} />
            <mesh rotation-x={-Math.PI / 2} position-y={-0.001}>
              <circleGeometry args={[6, 48]} />
              <meshStandardMaterial color="#0b0c0e" roughness={0.35} metalness={0.2} />
            </mesh>
            <Ready onReady={() => setReady(true)} />
            <FpsGuard onSlow={() => setDisabled(true)} />
          </Suspense>
        </Canvas>
      </CanvasBoundary>
    </div>
  );
}
