"use client";

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { SectionId } from "../data";

// Shared 0 (day) .. 1 (night) value, smoothly animated by <Sky/>.
const nightT = { v: 0 };

const rand = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = THREE.MathUtils.lerp;

type V3 = [number, number, number];

const VIEWS: Record<"home" | SectionId, { pos: V3; look: V3 }> = {
  home: { pos: [0, 4.4, 21], look: [0, 2, 0] },
  resume: { pos: [4.5, 4, 15], look: [4.2, 2.2, 0] },
  links: { pos: [8, 2.4, 11], look: [4.8, 1.4, 0.5] },
  experience: { pos: [-3, 6.5, 15], look: [2.6, 1.8, 0] },
  projects: { pos: [10, 3.2, 12], look: [4.6, 2.4, -1] },
};

const C = {
  skyTopDay: new THREE.Color("#5aa7ee"),
  skyHorDay: new THREE.Color("#d3eafa"),
  skyTopNight: new THREE.Color("#050a22"),
  skyHorNight: new THREE.Color("#1f3d72"),
  waterDay: new THREE.Color("#3f9fd4"),
  waterNight: new THREE.Color("#4a7aa8"),
  hemiSkyDay: new THREE.Color("#cfe6ff"),
  hemiSkyNight: new THREE.Color("#a9bce6"),
  hemiGroundDay: new THREE.Color("#e8d5a8"),
  hemiGroundNight: new THREE.Color("#4a5f8f"),
  sunLight: new THREE.Color("#fff4dc"),
  moonLight: new THREE.Color("#c9d6ff"),
};

function CameraRig({ section }: { section: SectionId | null }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(...VIEWS.home.look));
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, dt) => {
    const v = VIEWS[section ?? "home"];
    const k = 1 - Math.pow(0.04, Math.min(dt, 0.05));
    tmp.set(v.pos[0], v.pos[1] + Math.sin(clock.elapsedTime * 0.4) * 0.12, v.pos[2]);
    camera.position.lerp(tmp, k);
    look.current.lerp(tmp.set(...v.look), k);
    camera.lookAt(look.current);
  });
  return null;
}

function Sky({ night }: { night: boolean }) {
  const { scene } = useThree();
  const sun = useRef<THREE.Group>(null);
  const moon = useRef<THREE.Group>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const starMat = useRef<THREE.PointsMaterial>(null);
  const dome = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } }), []);

  const stars = useMemo(() => {
    const arr = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const th = rand(i) * Math.PI * 2;
      const ph = Math.acos(rand(i + 1000) * 0.85 + 0.12);
      arr.set([150 * Math.sin(ph) * Math.cos(th), 150 * Math.cos(ph), 150 * Math.sin(ph) * Math.sin(th)], i * 3);
    }
    return arr;
  }, []);

  useFrame(({ clock }, dt) => {
    const clockT = clock.elapsedTime;
    nightT.v += ((night ? 1 : 0) - nightT.v) * Math.min(1, dt * 1.6);
    const t = nightT.v;
    const s = smooth(1 - t);
    const m = smooth(t);
    sun.current?.position.set(lerp(70, 46, s), lerp(-24, 26, s), -125);
    moon.current?.position.set(lerp(-70, -46, m), lerp(-24, 24, m), -125);

    uniforms.top.value.lerpColors(C.skyTopDay, C.skyTopNight, t);
    uniforms.bot.value.lerpColors(C.skyHorDay, C.skyHorNight, t);
    (scene.fog as THREE.Fog | null)?.color.copy(uniforms.bot.value);

    if (light.current) {
      light.current.position.set(lerp(14, -14, t), lerp(20, 18, t), 14);
      light.current.intensity = lerp(2.4, 1.2, t);
      light.current.color.lerpColors(C.sunLight, C.moonLight, t);
    }
    if (hemi.current) {
      hemi.current.intensity = lerp(1.0, 0.95, t);
      hemi.current.color.lerpColors(C.hemiSkyDay, C.hemiSkyNight, t);
      hemi.current.groundColor.lerpColors(C.hemiGroundDay, C.hemiGroundNight, t);
    }
    if (starMat.current) {
      starMat.current.opacity = Math.max(0, (t - 0.35) / 0.65) * (0.8 + 0.2 * Math.sin(clockT * 2.5));
      starMat.current.size = 1.8 + Math.sin(clockT * 1.7) * 0.4;
    }
    if (dome.current) dome.current.uniformsNeedUpdate = true;
  });

  return (
    <>
      <fog attach="fog" args={["#d3eafa", 70, 230]} />
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={light}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-far={80}
      />
      <mesh>
        <sphereGeometry args={[180, 24, 16]} />
        <shaderMaterial
          ref={dome}
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
          uniforms={uniforms}
          vertexShader={`varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
          fragmentShader={`uniform vec3 top; uniform vec3 bot; varying float h;
            void main(){ vec3 c = mix(bot, top, smoothstep(0.0, 0.55, h)); gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
            }`}
        />
      </mesh>
      <group ref={sun}>
        <mesh>
          <sphereGeometry args={[6, 20, 20]} />
          <meshBasicMaterial color="#fff2a8" fog={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[10, 20, 20]} />
          <meshBasicMaterial color="#ffe08a" transparent opacity={0.25} fog={false} depthWrite={false} />
        </mesh>
      </group>
      <group ref={moon}>
        <mesh>
          <sphereGeometry args={[5, 20, 20]} />
          <meshBasicMaterial color="#eef2ff" fog={false} />
        </mesh>
        <mesh position={[1.4, 1, 4.5]}>
          <sphereGeometry args={[1, 10, 10]} />
          <meshBasicMaterial color="#cbd5ee" fog={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[9, 20, 20]} />
          <meshBasicMaterial color="#8fa8ff" transparent opacity={0.2} fog={false} depthWrite={false} />
        </mesh>
      </group>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars, 3]} />
        </bufferGeometry>
        <pointsMaterial ref={starMat} color="#ffffff" size={2.2} transparent opacity={0} fog={false} sizeAttenuation={false} />
      </points>
    </>
  );
}

function Water() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const pos = mesh.current?.geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(
        i,
        Math.sin(x * 0.35 + t * 1.3) * 0.09 + Math.sin(y * 0.5 - t * 1.1) * 0.08 + Math.sin((x + y) * 0.8 + t * 1.9) * 0.04,
      );
    }
    pos.needsUpdate = true;
    mat.current?.color.lerpColors(C.waterDay, C.waterNight, nightT.v);
    if (mat.current) mat.current.emissiveIntensity = nightT.v * 0.15;
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[400, 400, 160, 160]} />
      <meshStandardMaterial ref={mat} flatShading roughness={0.85} metalness={0} emissive="#0c2a5e" />
    </mesh>
  );
}

// Foam rings that wash in toward the shore, so small waves lap the island.
const FOAM_DAY = new THREE.Color("#ffffff");
const FOAM_NIGHT = new THREE.Color("#a9bbdc");

function Foam() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      const p = (clock.elapsedTime * 0.2 + i / 3) % 1;
      const s = lerp(1.3, 1, p);
      m.scale.set(s, s, 1);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.pow(Math.sin(Math.PI * p), 1.5) * 0.65;
      mat.color.lerpColors(FOAM_DAY, FOAM_NIGHT, nightT.v);
    });
  });
  return (
    <group scale={[1, 1, 0.78]} position={[0, 0.17, 0]}>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[7.3, 7.85, 9, 1, -Math.PI / 2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function Palm({ position, scale = 1, lean = 0.25, rot = 0 }: { position: V3; scale?: number; lean?: number; rot?: number }) {
  return (
    <group position={position} scale={scale} rotation={[0, rot, 0]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[lean * i * 0.55, 0.35 + i * 0.7, 0]} rotation={[0, 0, -lean * 0.35]} castShadow>
          <cylinderGeometry args={[0.27 - i * 0.03, 0.32 - i * 0.03, 0.78, 6]} />
          <meshStandardMaterial color={i % 2 ? "#7d4b3a" : "#92604a"} flatShading />
        </mesh>
      ))}
      <group position={[lean * 1.75, 3.1, 0]}>
        {Array.from({ length: 7 }, (_, i) => (
          <group key={i} rotation={[0, (i * Math.PI * 2) / 7, 0]}>
            <mesh position={[0.95, -0.1, 0]} rotation={[0, 0, -Math.PI / 2 - 0.4]} scale={[1, 1, 0.28]} castShadow>
              <coneGeometry args={[0.5, 2.3, 4]} />
              <meshStandardMaterial color={i % 2 ? "#5cb85c" : "#7ed36a"} flatShading />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

const girlW = { v: 0 };

function Hut() {
  const door = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame((_, dt) => {
    glow.current.forEach((m) => m && (m.emissiveIntensity = nightT.v * 2.2));
    if (door.current) {
      const open = girlW.v > 0.55 && girlW.v < 0.985;
      door.current.rotation.y = lerp(door.current.rotation.y, open ? -1.7 : 0, Math.min(1, dt * 6));
    }
  });
  const win = (i: number) => (
    <meshStandardMaterial
      ref={(m) => {
        if (m) glow.current[i] = m;
      }}
      color="#ffe9b0"
      emissive="#ffb347"
      emissiveIntensity={0}
    />
  );
  return (
    <group position={[-0.6, 0.45, -0.4]}>
      {[[-1, -0.9], [1, -0.9], [-1, 0.9], [1, 0.9]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.35, z]} castShadow>
          <cylinderGeometry args={[0.12, 0.14, 0.9, 6]} />
          <meshStandardMaterial color="#7a5230" flatShading />
        </mesh>
      ))}
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.8, 0.12, 2.4]} />
        <meshStandardMaterial color="#8a5a33" flatShading />
      </mesh>
      <mesh position={[0, 1.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 2.0, 2.1]} />
        <meshStandardMaterial color="#e0a65e" flatShading />
      </mesh>
      <mesh position={[0, 3.35, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.25, 1, 1.05]} castShadow>
        <coneGeometry args={[2.1, 1.5, 4]} />
        <meshStandardMaterial color="#62b24f" flatShading />
      </mesh>
      <mesh position={[-0.55, 1.45, 1.055]}>
        <boxGeometry args={[0.7, 1.3, 0.02]} />
        <meshStandardMaterial color="#1a0f08" />
      </mesh>
      <group ref={door} position={[-0.9, 1.75, 1.08]}>
        <mesh position={[0.35, 0, 0]} castShadow>
          <boxGeometry args={[0.7, 1.3, 0.05]} />
          {win(0)}
        </mesh>
      </group>
      <mesh position={[0.7, 2.1, 1.06]}>
        <boxGeometry args={[0.6, 0.6, 0.04]} />
        {win(1)}
      </mesh>
      <mesh position={[1.27, 2.1, 0]}>
        <boxGeometry args={[0.04, 0.6, 0.6]} />
        {win(2)}
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.55, 0.15 + i * 0.22, 1.6 - i * 0.2]} castShadow>
          <boxGeometry args={[0.9, 0.12, 0.35]} />
          <meshStandardMaterial color="#a8743f" flatShading />
        </mesh>
      ))}
    </group>
  );
}

const GIRL_LINES = ["Hi, I'm Riti! 👋", "Check out my projects!", "Open the ☰ menu to explore", "Want my resume? It's in the menu!", "Try the sun/moon button 🌙"];

const SpeechBubble = forwardRef<THREE.Sprite, { text: string }>(function SpeechBubble({ text }, ref) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 160;
    const x = c.getContext("2d")!;
    x.fillStyle = "#ffffff";
    x.strokeStyle = "#1e293b";
    x.lineWidth = 6;
    x.beginPath();
    x.roundRect(8, 8, 496, 108, 30);
    x.moveTo(220, 116);
    x.lineTo(256, 152);
    x.lineTo(268, 116);
    x.fill();
    x.stroke();
    x.fillStyle = "#ffffff";
    x.fillRect(224, 112, 40, 8);
    x.fillStyle = "#0f172a";
    x.font = "bold 36px system-ui, sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(text, 256, 62, 470);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <sprite ref={ref} position={[0, 1.55, 0]} scale={[2.6, 0.81, 1]} renderOrder={10}>
      <spriteMaterial map={tex} transparent opacity={0} depthTest={false} toneMapped={false} fog={false} />
    </sprite>
  );
});

const SEAT: V3 = [-2.85, 0.38, 1.9];
const PATH: V3[] = [SEAT, [-2.2, 0.48, 1.9], [-1.15, 0.48, 1.75], [-1.15, 1.36, 0.6], [-1.15, 1.36, 0.1]];
const PATH_LEN = PATH.slice(1).map((p, i) => Math.hypot(p[0] - PATH[i][0], p[1] - PATH[i][1], p[2] - PATH[i][2]));
const PATH_TOTAL = PATH_LEN.reduce((a, b) => a + b, 0);
const WALK_SECONDS = 6;

function angleLerp(a: number, b: number, k: number) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
}

// Works at a laptop by day; at night walks up the steps and goes inside the hut.
function Girl({ night }: { night: boolean }) {
  const root = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const progress = useRef(0);
  const heading = useRef(-Math.PI / 2);
  const waveUntil = useRef(0);
  const bubble = useRef<THREE.Sprite>(null);
  const [msg, setMsg] = useState(0);
  const clock = useThree((st) => st.clock);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    waveUntil.current = clock.elapsedTime + 3.6;
    setMsg((m) => m + 1);
  };

  useFrame(({ clock }, dt) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const dir = night ? 1 : -1;
    progress.current = Math.min(1, Math.max(0, progress.current + (dir * Math.min(dt, 0.05)) / WALK_SECONDS));
    const w = progress.current;
    girlW.v = w;
    const moving = w > 0.002 && w < 0.998;

    // Position along the path
    let d = w * PATH_TOTAL;
    let seg = 0;
    while (seg < PATH_LEN.length - 1 && d > PATH_LEN[seg]) {
      d -= PATH_LEN[seg];
      seg++;
    }
    const a = PATH[seg];
    const b = PATH[seg + 1];
    const k = Math.min(1, d / PATH_LEN[seg]);
    g.position.set(lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k));
    g.visible = w < 0.995;

    const sit = 1 - Math.min(1, w / 0.05);
    let target = -Math.PI / 2;
    if (moving) {
      const sign = dir === 1 ? 1 : -1;
      target = Math.atan2((b[0] - a[0]) * sign, (b[2] - a[2]) * sign);
      if (sit > 0.5) target = -Math.PI / 2;
    }
    const waving = t < waveUntil.current;
    if (waving && !moving) target = 0;
    heading.current = angleLerp(heading.current, target, Math.min(1, dt * 8));
    g.rotation.y = heading.current;

    const swing = moving ? Math.sin(t * 8) : 0;
    const legSit = -1.45;
    if (legL.current) legL.current.rotation.x = lerp(swing * 0.6, legSit, sit);
    if (legR.current) legR.current.rotation.x = lerp(-swing * 0.6, legSit, sit);
    const typing = sit > 0.95 ? Math.sin(t * 15) * 0.1 : 0;
    if (armL.current) armL.current.rotation.x = lerp(-swing * 0.5, -1.15 + typing, sit);
    if (armR.current) {
      armR.current.rotation.x = lerp(swing * 0.5, -1.15 - typing, sit);
      if (waving) {
        armR.current.rotation.x = -2.7;
        armR.current.rotation.z = Math.sin(t * 12) * 0.5;
      } else armR.current.rotation.z = 0;
    }
    if (bubble.current) {
      const m = bubble.current.material;
      m.opacity = lerp(m.opacity, waving ? 1 : 0, Math.min(1, dt * 10));
    }
    if (head.current) head.current.rotation.x = sit > 0.95 ? Math.sin(t * 0.8) * 0.05 + 0.08 : 0;
    g.position.y += moving ? Math.abs(Math.sin(t * 8)) * 0.03 : 0;
  });

  const skin = "#f2c9a0";
  return (
    <group ref={root} position={SEAT} rotation={[0, -Math.PI / 2, 0]}>
      <mesh
        position={[0, 0.5, 0]}
        onClick={onClick}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <cylinderGeometry args={[0.42, 0.42, 1.3, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <SpeechBubble ref={bubble} text={GIRL_LINES[msg % GIRL_LINES.length]} />
      <group position={[0, 0.42, 0]}>
        <group ref={legL} position={[-0.07, 0, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.05, 0.42, 6]} />
            <meshStandardMaterial color="#334e8a" flatShading />
          </mesh>
          <mesh position={[0, -0.43, 0.03]} castShadow>
            <boxGeometry args={[0.09, 0.05, 0.14]} />
            <meshStandardMaterial color="#3b2a20" flatShading />
          </mesh>
        </group>
        <group ref={legR} position={[0.07, 0, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.05, 0.42, 6]} />
            <meshStandardMaterial color="#334e8a" flatShading />
          </mesh>
          <mesh position={[0, -0.43, 0.03]} castShadow>
            <boxGeometry args={[0.09, 0.05, 0.14]} />
            <meshStandardMaterial color="#3b2a20" flatShading />
          </mesh>
        </group>
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.15, 0.44, 7]} />
          <meshStandardMaterial color="#ec4899" flatShading />
        </mesh>
        <group ref={armL} position={[-0.19, 0.38, 0]}>
          <mesh position={[0, -0.16, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.035, 0.34, 6]} />
            <meshStandardMaterial color={skin} flatShading />
          </mesh>
        </group>
        <group ref={armR} position={[0.19, 0.38, 0]}>
          <mesh position={[0, -0.16, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.035, 0.34, 6]} />
            <meshStandardMaterial color={skin} flatShading />
          </mesh>
        </group>
        <group ref={head} position={[0, 0.62, 0]}>
          <mesh castShadow>
            <icosahedronGeometry args={[0.15, 1]} />
            <meshStandardMaterial color={skin} flatShading />
          </mesh>
          <mesh position={[0, 0.03, -0.035]} castShadow>
            <icosahedronGeometry args={[0.165, 1]} />
            <meshStandardMaterial color="#2b1a14" flatShading />
          </mesh>
          <mesh position={[0, -0.04, -0.22]} rotation={[0.6, 0, 0]} castShadow>
            <coneGeometry args={[0.06, 0.28, 5]} />
            <meshStandardMaterial color="#2b1a14" flatShading />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// Outdoor desk with a laptop where she works during the day.
function Workspace() {
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (screen.current) screen.current.emissiveIntensity = 0.25 + nightT.v * 0.6;
  });
  return (
    <group>
      <group position={[-3.65, 0.45, 1.9]}>
        <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.7, 0.05, 0.9]} />
          <meshStandardMaterial color="#a8743f" flatShading />
        </mesh>
        {[[-0.3, -0.38], [0.3, -0.38], [-0.3, 0.38], [0.3, 0.38]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.3, z]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.6, 5]} />
            <meshStandardMaterial color="#7a5230" flatShading />
          </mesh>
        ))}
        <mesh position={[0.04, 0.665, 0]}>
          <boxGeometry args={[0.34, 0.025, 0.46]} />
          <meshStandardMaterial color="#9aa3ad" flatShading />
        </mesh>
        <mesh position={[-0.12, 0.8, 0]} rotation={[0, 0, 0.3]}>
          <boxGeometry args={[0.025, 0.3, 0.44]} />
          <meshStandardMaterial ref={screen} color="#bfe3ff" emissive="#7cc4ff" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0.1, 0.72, 0.3]}>
          <cylinderGeometry args={[0.04, 0.035, 0.1, 6]} />
          <meshStandardMaterial color="#f97316" flatShading />
        </mesh>
      </group>
      <mesh position={[-2.85, 0.65, 1.9]} castShadow>
        <cylinderGeometry args={[0.18, 0.16, 0.05, 7]} />
        <meshStandardMaterial color="#c98f4f" flatShading />
      </mesh>
      <mesh position={[-2.85, 0.53, 1.9]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.25, 5]} />
        <meshStandardMaterial color="#7a5230" flatShading />
      </mesh>
    </group>
  );
}

function Campfire({ position }: { position: V3 }) {
  const flame = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const f = 1 + Math.sin(clock.elapsedTime * 13) * 0.14 + Math.sin(clock.elapsedTime * 7.3) * 0.1;
    // The fire only burns once night has mostly fallen.
    const burn = smooth(Math.min(1, Math.max(0, (nightT.v - 0.5) / 0.5)));
    if (flame.current) {
      flame.current.visible = burn > 0.02;
      flame.current.scale.set(burn, f * burn, burn);
    }
    if (lightRef.current) lightRef.current.intensity = burn * 26 * f;
  });
  return (
    <group position={position}>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[Math.cos((i * Math.PI * 2) / 7) * 0.5, 0.08, Math.sin((i * Math.PI * 2) / 7) * 0.5]} castShadow>
          <dodecahedronGeometry args={[0.16, 0]} />
          <meshStandardMaterial color="#8d8f96" flatShading />
        </mesh>
      ))}
      <mesh position={[0, 0.12, 0]} rotation={[0, 0, 0.5]}>
        <cylinderGeometry args={[0.07, 0.07, 0.8, 5]} />
        <meshStandardMaterial color="#5b3a1e" flatShading />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.8, 5]} />
        <meshStandardMaterial color="#5b3a1e" flatShading />
      </mesh>
      <mesh ref={flame} position={[0, 0.45, 0]}>
        <coneGeometry args={[0.28, 0.8, 6]} />
        <meshStandardMaterial color="#ffb02e" emissive="#ff7a18" emissiveIntensity={1.6} flatShading />
      </mesh>
      <pointLight ref={lightRef} position={[0, 1, 0]} color="#ff9a3c" distance={14} decay={1.6} />
    </group>
  );
}

function Raft() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 0.08 + Math.sin(clock.elapsedTime * 0.9) * 0.07;
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.7) * 0.03;
  });
  return (
    <group ref={ref} position={[-9.5, 0.1, 2.5]} rotation={[0, 0.5, 0]}>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[0, 0, -1.2 + i * 0.4]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 3.4, 7]} />
          <meshStandardMaterial color="#c98f4f" flatShading />
        </mesh>
      ))}
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 3.2, 5]} />
        <meshStandardMaterial color="#8a5a33" flatShading />
      </mesh>
      <mesh position={[0, 2.3, 0.65]} castShadow>
        <planeGeometry args={[0.05, 1.2]} />
        <meshStandardMaterial color="#8a5a33" />
      </mesh>
      <mesh position={[0, 2.2, 0.65]} castShadow>
        <planeGeometry args={[1.5, 1.4]} />
        <meshStandardMaterial color="#f1e2bf" side={THREE.DoubleSide} flatShading />
      </mesh>
    </group>
  );
}

function RockArch() {
  return (
    <group position={[6.4, 0.2, -2.2]} rotation={[0, -0.35, 0]}>
      <mesh position={[0, 0, 0]} scale={[1.1, 1.35, 1]} castShadow receiveShadow>
        <torusGeometry args={[2.1, 0.8, 5, 7, Math.PI]} />
        <meshStandardMaterial color="#c9806a" flatShading />
      </mesh>
      <mesh position={[-2.2, 0.4, 0]} castShadow>
        <dodecahedronGeometry args={[1.2, 0]} />
        <meshStandardMaterial color="#b3715d" flatShading />
      </mesh>
      <mesh position={[2.3, 0.3, 0.2]} castShadow>
        <dodecahedronGeometry args={[1.1, 0]} />
        <meshStandardMaterial color="#b3715d" flatShading />
      </mesh>
    </group>
  );
}

function DistantIsland() {
  return (
    <group position={[-55, 0, -70]}>
      <mesh position={[0, 0.2, 0]} scale={[1, 0.3, 1]}>
        <coneGeometry args={[9, 3, 8]} />
        <meshStandardMaterial color="#e8d5a8" flatShading />
      </mesh>
      {[[-3, 0], [0, 1], [3, -1], [1, -3]].map(([x, z], i) => (
        <mesh key={i} position={[x, 2.2, z]}>
          <coneGeometry args={[1.8, 3, 5]} />
          <meshStandardMaterial color="#3d9a4d" flatShading />
        </mesh>
      ))}
    </group>
  );
}

const CLOUD_DAY = new THREE.Color("#ffffff");
const CLOUD_NIGHT = new THREE.Color("#55658c");

function Cloud({ x, y, z, scale, speed }: { x: number; y: number; z: number; scale: number; speed: number }) {
  const g = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((_, dt) => {
    if (g.current) {
      g.current.position.x += speed * Math.min(dt, 0.05);
      if (g.current.position.x > 70) g.current.position.x = -70;
    }
    if (mat.current) {
      mat.current.color.lerpColors(CLOUD_DAY, CLOUD_NIGHT, nightT.v);
      mat.current.emissive.copy(mat.current.color);
      mat.current.opacity = lerp(0.95, 0.7, nightT.v);
    }
  });
  const puffs: [number, number, number, number][] = [[0, 0, 0, 1.6], [1.6, -0.2, 0.2, 1.2], [-1.6, -0.25, 0, 1.2], [0.5, 0.7, 0, 1.1], [-0.7, 0.55, 0.1, 0.9]];
  return (
    <group ref={g} position={[x, y, z]} scale={scale}>
      {puffs.map(([px, py, pz, r], i) => (
        <mesh key={i} position={[px, py, pz]} scale={[1, 0.7, 0.8]}>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial ref={i === 0 ? mat : undefined} color="#ffffff" emissive="#ffffff" emissiveIntensity={0.55} flatShading transparent opacity={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function Clouds() {
  const items = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        x: -60 + i * 16 + rand(i) * 8,
        y: 17 + rand(i + 20) * 10,
        z: -45 - rand(i + 40) * 30,
        scale: 1.1 + rand(i + 60) * 1.1,
        speed: 0.5 + rand(i + 80) * 0.7,
      })),
    [],
  );
  return (
    <>
      {items.map((c, i) => (
        <Cloud key={i} {...c} />
      ))}
    </>
  );
}

// Fish leap out of the water every few seconds and leave a ripple.
function Fish({ origin, dir, period, offset }: { origin: [number, number]; dir: number; period: number; offset: number }) {
  const g = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const JUMP = 1.1;
  useFrame(({ clock }) => {
    const c = (clock.elapsedTime + offset) % period;
    const ph = c / JUMP;
    if (g.current) {
      g.current.visible = ph < 1;
      if (ph < 1) {
        g.current.position.set(origin[0] + dir * ph * 2.2, Math.sin(Math.PI * ph) * 1.2 - 0.1, origin[1]);
        g.current.rotation.z = dir * Math.cos(Math.PI * ph) * 0.9;
        g.current.rotation.y = dir > 0 ? 0 : Math.PI;
      }
    }
    if (ring.current) {
      const since = c - JUMP;
      const m = ring.current.material as THREE.MeshBasicMaterial;
      if (since > 0 && since < 1.2) {
        ring.current.visible = true;
        const k = since / 1.2;
        ring.current.position.set(origin[0] + dir * 2.2, 0.06, origin[1]);
        ring.current.scale.setScalar(0.3 + k * 1.6);
        m.opacity = (1 - k) * 0.7;
      } else ring.current.visible = false;
    }
  });
  return (
    <>
      <group ref={g} visible={false}>
        <mesh scale={[1, 0.5, 0.35]} castShadow>
          <icosahedronGeometry args={[0.28, 1]} />
          <meshStandardMaterial color="#ff8a3d" flatShading />
        </mesh>
        <mesh position={[-0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.15, 0.22, 4]} />
          <meshStandardMaterial color="#ff6a1f" flatShading />
        </mesh>
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.8, 1, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

// A little sailboat drifting past in the distance; hangs a lantern at night.
function Boat() {
  const g = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (g.current) {
      g.current.position.x += 2.4 * Math.min(dt, 0.05);
      if (g.current.position.x > 48) g.current.position.x = -48;
      g.current.position.y = Math.sin(t * 1.4) * 0.12;
      g.current.rotation.z = Math.sin(t * 1.1) * 0.06;
      g.current.rotation.x = Math.sin(t * 0.9) * 0.04;
    }
    if (lamp.current) lamp.current.opacity = nightT.v;
  });
  return (
    <group ref={g} position={[-48, 0, 10]} scale={0.9}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[2.2, 0.4, 0.8]} />
        <meshStandardMaterial color="#9b5a35" flatShading />
      </mesh>
      <mesh position={[1.25, 0.2, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <coneGeometry args={[0.4, 0.5, 4]} />
        <meshStandardMaterial color="#9b5a35" flatShading />
      </mesh>
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 2.2, 5]} />
        <meshStandardMaterial color="#6b4423" flatShading />
      </mesh>
      <mesh position={[-0.35, 1.45, 0]} castShadow>
        <boxGeometry args={[1.2, 1.5, 0.03]} />
        <meshStandardMaterial color="#fff7e6" flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.12, 2.55, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial ref={lamp} color="#ffd27a" transparent opacity={0} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Firefly({ seed }: { seed: number }) {
  const g = useRef<THREE.Group>(null);
  const bx = (rand(seed) - 0.5) * 15;
  const bz = (rand(seed + 50) - 0.5) * 9;
  const by = 0.9 + rand(seed + 100) * 2.2;
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime + seed * 7;
    g.current.position.set(bx + Math.sin(t * 0.5) * 0.9, by + Math.sin(t * 0.8) * 0.4, bz + Math.cos(t * 0.45) * 0.9);
    const blink = 0.55 + 0.45 * Math.sin(t * 2.2 + seed);
    const k = Math.max(0, (nightT.v - 0.6) / 0.4) * blink;
    g.current.scale.setScalar(k);
    g.current.visible = k > 0.01;
  });
  return (
    <group ref={g}>
      <mesh>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshBasicMaterial color="#e6ff6a" toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshBasicMaterial color="#d8ff4a" transparent opacity={0.25} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Ambient() {
  return (
    <>
      <Clouds />
      <Boat />
      <Fish origin={[9, 0]} dir={1} period={6} offset={0} />
      <Fish origin={[-12, 6]} dir={-1} period={7.5} offset={2.5} />
      <Fish origin={[6, 10]} dir={-1} period={9} offset={5} />
      <Fish origin={[-9, -8]} dir={1} period={8} offset={3.5} />
      {Array.from({ length: 22 }, (_, i) => (
        <Firefly key={i} seed={i + 1} />
      ))}
    </>
  );
}

function Island({ night }: { night: boolean }) {
  const rocks = useMemo<{ p: V3; s: number }[]>(
    () => [
      { p: [-4.8, 0.2, -1.5], s: 1.1 },
      { p: [-9.5, -0.2, -6], s: 1.6 },
      { p: [10, -0.1, 4], s: 1.2 },
      { p: [1.5, 0.1, 5.4], s: 0.5 },
      { p: [-3.4, 0.2, 3.9], s: 0.35 },
    ],
    [],
  );
  return (
    <group>
      <mesh position={[0, -0.7, 0]} scale={[1, 1, 0.78]} castShadow receiveShadow>
        <cylinderGeometry args={[7.2, 10, 2.2, 9]} />
        <meshStandardMaterial color="#ecd9ad" flatShading />
      </mesh>
      <mesh position={[-1.6, 0.4, -0.6]} scale={[1, 1, 0.8]} receiveShadow>
        <cylinderGeometry args={[4, 4.5, 0.16, 8]} />
        <meshStandardMaterial color="#5fb05a" flatShading />
      </mesh>
      <Hut />
      <Campfire position={[2.6, 0.4, 1.4]} />
      <Workspace />
      <Girl night={night} />
      <Palm position={[-3.6, 0.4, -1.4]} scale={1.25} lean={0.3} rot={0.5} />
      <Palm position={[1.6, 0.4, -2.2]} scale={1.15} lean={-0.2} />
      <Palm position={[3.6, 0.4, -0.8]} scale={1} lean={0.25} rot={2.5} />
      <Palm position={[-1.8, 0.4, 2]} scale={0.6} lean={0.35} rot={1} />
      <Foam />
      <RockArch />
      <Raft />
      <DistantIsland />
      {rocks.map((r, i) => (
        <mesh key={i} position={r.p} scale={r.s} castShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#9aa0aa" flatShading />
        </mesh>
      ))}
      {[[4.4, 5.2], [6, 4.6], [-6.2, 4.1]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.6, z]} rotation={[0, 0, (i - 1) * 0.1]} castShadow>
          <coneGeometry args={[0.45, 2 + i * 0.4, 4]} />
          <meshStandardMaterial color="#b3715d" flatShading />
        </mesh>
      ))}
      {[[-4, 0.5], [-2.2, 1.2], [0.6, 1.6], [4.2, 0.8], [3.4, 2.6]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.55, z]} castShadow>
          <icosahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial color={["#ec4899", "#f97316", "#a855f7", "#ef4444", "#facc15"][i]} flatShading />
        </mesh>
      ))}
    </group>
  );
}

export default function Scene({ night, section }: { night: boolean; section: SectionId | null }) {
  useEffect(() => {
    nightT.v = night ? 1 : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <Sky night={night} />
      <Water />
      <Island night={night} />
      <Ambient />
      <CameraRig section={section} />
    </>
  );
}
