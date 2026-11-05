"use client";
/**
 * Procedural 3D hero: a slowly flowing form finished in deep-blue metallic paint under a clear
 * coat, lit by studio light strips — the reflections you see on a freshly detailed panel. No
 * model or licence needed. Loaded lazily (ssr: false) by HeroStage when no car.glb is present.
 *
 * Same guard rails as the model hero: DPR clamp, renders only while on screen, FPS guard,
 * error boundary, context-loss fallback, shaders compiled async before the cross-fade.
 */
import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

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

// Ashima/stegu 3D simplex noise (MIT).
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float flow(vec3 p){
  return snoise(p*0.62+vec3(uTime*0.16,0.0,uTime*0.1))*0.2+snoise(p*1.3-vec3(0.0,uTime*0.14,0.0))*0.035;
}
vec3 displaced(vec3 p,vec3 n){return p+n*flow(p);}
`;

function usePaintMaterial() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const material = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#163a78"),
      metalness: 0.7,
      roughness: 0.16,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      iridescence: 0.25,
      iridescenceIOR: 1.4,
      envMapIntensity: 2.2,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\nuniform float uTime;\n${NOISE}`)
        .replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
          // Recompute the normal of the displaced surface from two nearby displaced points.
          vec3 dn = normalize(normal);
          vec3 dt = normalize(cross(dn, abs(dn.y) > 0.99 ? vec3(1.0,0.0,0.0) : vec3(0.0,1.0,0.0)));
          vec3 db = normalize(cross(dn, dt));
          float e = 0.012;
          vec3 dp0 = displaced(position, dn);
          vec3 dp1 = displaced(position + dt*e, normalize(position + dt*e));
          vec3 dp2 = displaced(position + db*e, normalize(position + db*e));
          objectNormal = normalize(cross(dp1 - dp0, dp2 - dp0));`,
        )
        .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed = dp0;");
    };
    return m;
  }, [uniforms]);
  useEffect(() => () => material.dispose(), [material]);
  /** Advances the flow clock and returns the new time in seconds. */
  const advance = useCallback(
    (delta: number) => {
      // three.js uniforms are mutable by design: the shader reads them every frame.
      // eslint-disable-next-line react-hooks/immutability
      uniforms.uTime.value += Math.min(delta, 0.05);
      return uniforms.uTime.value;
    },
    [uniforms],
  );
  return { material, advance };
}

function PaintForm({ mobile }: { mobile: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { material, advance } = usePaintMaterial();
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1.35, mobile ? 40 : 64), [mobile]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const pointer = useRef({ x: 0, y: 0 });
  const scroll = useRef(0);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state, delta) => {
    const t = advance(delta);
    // Scroll progress through the first screen (read in the frame loop, no scroll listener).
    const target = Math.min(1.5, window.scrollY / Math.max(1, window.innerHeight));
    scroll.current = THREE.MathUtils.damp(scroll.current, target, 5, delta);
    const g = group.current;
    if (!g) return;
    const s = scroll.current;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, t * 0.12 + pointer.current.x * 0.35 + s * 1.6, 4, delta);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, pointer.current.y * 0.2 + s * 0.5, 4, delta);
    g.position.y = (mobile ? -0.2 : 0) - s * 0.6;
    g.position.z = -s * 1.4;
    // Sweep the studio lights across the paint as you scroll.
    (state.scene as THREE.Scene & { environmentRotation: THREE.Euler }).environmentRotation.set(0, s * Math.PI * 0.9 + t * 0.05, 0);
  });

  return (
    <group ref={group} position={mobile ? [0, -0.2, 0] : [2.05, 0.05, 0]} scale={mobile ? 0.86 : 0.8}>
      <mesh geometry={geometry} material={material} />
    </group>
  );
}

function FpsGuard({ onSlow }: { onSlow: () => void }) {
  const frames = useRef<number[]>([]);
  const tripped = useRef(false);
  useFrame((_, delta) => {
    if (tripped.current || frames.current.length >= 90) return;
    frames.current.push(delta);
    if (frames.current.length === 90) {
      const avg = frames.current.slice(20).reduce((a, b) => a + b, 0) / 70;
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
    const r = gl as THREE.WebGLRenderer & { compileAsync?: (s: THREE.Object3D, c: THREE.Camera) => Promise<unknown> };
    (r.compileAsync ? r.compileAsync(scene, camera) : Promise.resolve()).then(() => requestAnimationFrame(onReady));
  }, [gl, scene, camera, onReady]);
  return null;
}

export default function PaintCanvas() {
  const wrapper = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const mobile = useMemo(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches, []);

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
      className="absolute inset-0 transition-opacity duration-[1400ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
      style={{ opacity: ready ? 1 : 0 }}
    >
      <CanvasBoundary onError={() => setDisabled(true)}>
        <Canvas
          dpr={[1, mobile ? 1.5 : 1.75]}
          frameloop={visible ? "always" : "never"}
          camera={{ fov: 30, near: 0.1, far: 50, position: [0, 0, 7] }}
          gl={{ antialias: !mobile, powerPreference: "high-performance", alpha: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.1;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.domElement.addEventListener("webglcontextlost", () => setDisabled(true));
          }}
        >
          <Suspense fallback={null}>
            {/* Studio light tunnel, baked once into the environment map. */}
            <Environment resolution={256} frames={1}>
              <Lightformer form="rect" intensity={5} position={[0, 4, -3]} rotation-x={Math.PI / 2.4} scale={[12, 0.6, 1]} color="#f2f8ff" />
              <Lightformer form="rect" intensity={3} position={[0, 2.2, -4]} scale={[12, 0.25, 1]} color="#ffffff" />
              <Lightformer form="rect" intensity={2.4} position={[-5, 1, 0]} rotation-y={Math.PI / 2} scale={[10, 0.5, 1]} color="#cfe6ff" />
              <Lightformer form="rect" intensity={2.4} position={[5, -0.5, 0]} rotation-y={-Math.PI / 2} scale={[10, 0.35, 1]} color="#8cc4ff" />
              <Lightformer form="ring" intensity={1.6} position={[2, 3, 5]} scale={2.4} color="#4da3ff" />
              <Lightformer form="rect" intensity={1.2} position={[0, -4, 1]} rotation-x={-Math.PI / 2} scale={[8, 3, 1]} color="#2b8cff" />
            </Environment>
            <PaintForm mobile={mobile} />
            <Ready onReady={() => setReady(true)} />
            <FpsGuard onSlow={() => setDisabled(true)} />
          </Suspense>
        </Canvas>
      </CanvasBoundary>
    </div>
  );
}
