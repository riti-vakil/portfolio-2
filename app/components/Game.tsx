"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import Scene from "./Scene";
import { initAudio, setMuted, setNightMode, sfx, stopAudio } from "./sound";
import { experience, links, menu, profile, projects, resume, type SectionId } from "../data";

function useTypewriter(line1: string, line2: string) {
  const gap = 10;
  const [count, setCount] = useState(0);
  const total = line1.length + gap + line2.length;
  useEffect(() => {
    const id = setInterval(() => setCount((c) => (c >= total ? c : c + 1)), 75);
    return () => clearInterval(id);
  }, [total]);
  const first = line1.slice(0, count);
  const second = line2.slice(0, Math.max(0, count - line1.length - gap));
  const onSecond = count >= line1.length + gap;
  return { first, second, onSecond };
}

function Hall({ section, night, onClose }: { section: SectionId; night: boolean; onClose: () => void }) {
  const card = night ? "bg-slate-900/80 text-slate-100 border-white/10" : "bg-white/80 text-slate-900 border-white/60";
  const muted = night ? "text-slate-300" : "text-slate-600";
  const chip = night ? "bg-indigo-400/20 text-indigo-100" : "bg-indigo-500/15 text-indigo-900";
  const item = night ? "bg-white/5 border-white/10" : "bg-white/60 border-slate-200";
  const current = menu.find((m) => m.id === section)!;

  return (
    <section
      key={section}
      className={`hall-in absolute right-4 top-20 bottom-4 z-20 w-[min(94vw,34rem)] overflow-y-auto rounded-3xl border p-4 shadow-2xl md:p-6 backdrop-blur-md portrait:left-4 portrait:right-4 portrait:top-[46%] portrait:bottom-4 portrait:w-auto md:right-8 md:top-24 md:bottom-8 ${card}`}
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {current.icon} {current.label}
        </h2>
        <button onClick={onClose} aria-label="Close" className="rounded-full px-3 py-1 text-lg hover:bg-black/10">
          ✕
        </button>
      </div>

      {section === "resume" && (
        <div className="space-y-6">
          <p className={muted}>{resume.summary}</p>
          <div>
            <h3 className="mb-2 font-semibold">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {resume.skills.map((s) => (
                <span key={s} className={`rounded-full px-3 py-1 text-sm ${chip}`}>
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Education</h3>
            {resume.education.map((e) => (
              <div key={e.title} className={`rounded-xl border p-3 ${item}`}>
                <p className="font-medium">{e.title}</p>
                <p className={`text-sm ${muted}`}>
                  {e.place} · {e.years}
                </p>
              </div>
            ))}
          </div>
          <a
            href={resume.downloadUrl}
            download
            className="inline-block rounded-full bg-indigo-500 px-5 py-2 font-semibold text-white hover:bg-indigo-400"
          >
            ⬇ Download resume
          </a>
        </div>
      )}

      {section === "links" && (
        <ul className="space-y-3">
          {links.map((l) => (
            <li key={l.name}>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className={`block rounded-xl border p-4 transition hover:scale-[1.02] ${item}`}
              >
                <p className="font-semibold">{l.name}</p>
                <p className={`text-sm ${muted}`}>{l.text}</p>
              </a>
            </li>
          ))}
        </ul>
      )}

      {section === "experience" && (
        <ol className="space-y-4 border-l-2 border-indigo-400/50 pl-5">
          {experience.map((e) => (
            <li key={e.role + e.company} className="relative">
              <span className="absolute -left-[1.72rem] top-1.5 h-3 w-3 rounded-full bg-indigo-400" />
              <p className="font-semibold">{e.role}</p>
              <p className={`text-sm ${muted}`}>
                {e.company} · {e.years}
              </p>
              <ul className={`mt-2 list-disc space-y-1 pl-5 text-sm ${muted}`}>
                {e.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {section === "projects" && (
        <div className="space-y-3">
          {projects.map((p) => (
            <a
              key={p.name}
              href={p.url}
              className={`block rounded-xl border p-4 transition hover:scale-[1.02] ${item}`}
            >
              <p className="font-semibold">{p.name}</p>
              <p className={`mt-1 text-sm ${muted}`}>{p.desc}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.tech.map((t) => (
                  <span key={t} className={`rounded-full px-2 py-0.5 text-xs ${chip}`}>
                    {t}
                  </span>
                ))}
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Game() {
  const [night, setNight] = useState(false);
  const manual = useRef(false);
  const [section, setSection] = useState<SectionId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [muted, setMutedState] = useState(false);
  const { first, second, onSecond } = useTypewriter(profile.greeting, profile.tagline);

  // Browsers only allow audio after a user gesture, so start on the first interaction.
  useEffect(() => {
    const start = () => initAudio();
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      stopAudio();
    };
  }, []);

  // Follow local time (night 6pm-6am) until the user flips the toggle themselves.
  useEffect(() => {
    const sync = () => {
      if (manual.current) return;
      const h = new Date().getHours();
      setNight(h >= 18 || h < 6);
    };
    const first = setTimeout(sync, 0);
    const id = setInterval(sync, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    setNightMode(night);
  }, [night]);

  const glass = night ? "bg-slate-900/60 text-white" : "bg-white/60 text-slate-900";

  const toggleMenu = () => {
    initAudio();
    if (menuOpen) sfx.menuClose();
    else sfx.menuOpen();
    setMenuOpen((o) => !o);
  };

  const choose = (id: SectionId) => {
    sfx.select();
    setSection(id);
    setMenuOpen(false);
  };

  const toggleNight = () => {
    initAudio();
    if (night) sfx.toDay();
    else sfx.toNight();
    manual.current = true;
    setNight(!night);
  };

  const toggleSound = () => {
    const next = !muted;
    if (!next) initAudio();
    setMuted(next);
    setMutedState(next);
    if (!next) sfx.unmute();
  };

  return (
    <div className="relative h-dvh w-screen overflow-hidden">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ powerPreference: "high-performance" }}
        camera={{ position: [0, 4.4, 21], fov: 42 }}
        onCreated={({ gl }) => {
          // Let the browser restore the context instead of leaving a dead canvas.
          gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
        }}
      >
        <Scene night={night} section={section} />
      </Canvas>

      {!section && (
        <div className="pointer-events-none absolute inset-x-0 top-[12%] px-6 text-center text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.35)]">
          <h1 className="min-h-[1.2em] text-3xl font-bold sm:text-4xl md:text-6xl">
            {first}
            {!onSecond && <span className="caret">|</span>}
          </h1>
          <p className="mt-3 min-h-[1.5em] text-xl md:text-3xl">
            {second}
            {onSecond && <span className="caret">|</span>}
          </p>
        </div>
      )}

      <div className="absolute left-4 top-4 z-40 md:left-8">
        <button
          onClick={toggleMenu}
          aria-label="Menu"
          aria-expanded={menuOpen}
          className={`flex h-12 w-12 flex-col items-center justify-center gap-[5px] rounded-full shadow-xl backdrop-blur-md transition hover:scale-110 ${glass}`}
        >
          <span className={`h-0.5 w-5 rounded bg-current transition-transform duration-300 ${menuOpen ? "translate-y-[7px] rotate-45" : ""}`} />
          <span className={`h-0.5 w-5 rounded bg-current transition-opacity duration-200 ${menuOpen ? "opacity-0" : ""}`} />
          <span className={`h-0.5 w-5 rounded bg-current transition-transform duration-300 ${menuOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
        </button>

        <nav
          aria-hidden={!menuOpen}
          className={`mt-3 w-56 origin-top overflow-hidden rounded-2xl shadow-xl backdrop-blur-md transition-all duration-300 ease-out ${glass} ${
            menuOpen ? "max-h-80 translate-y-0 scale-y-100 p-2 opacity-100" : "pointer-events-none max-h-0 -translate-y-3 scale-y-75 p-0 opacity-0"
          }`}
        >
          {menu.map((m, i) => (
            <button
              key={m.id}
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => choose(m.id)}
              style={{ transitionDelay: menuOpen ? `${80 + i * 60}ms` : "0ms" }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all duration-300 hover:bg-indigo-500/30 ${
                menuOpen ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
              } ${section === m.id ? "bg-indigo-500 text-white hover:bg-indigo-500" : ""}`}
            >
              <span className="text-lg">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="absolute right-4 top-4 z-30 flex gap-3 md:right-8">
        <button
          onClick={toggleSound}
          aria-label={muted ? "Unmute" : "Mute"}
          className={`h-12 w-12 rounded-full text-xl shadow-xl backdrop-blur-md transition hover:scale-110 ${glass}`}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button
          onClick={toggleNight}
          aria-label="Toggle day and night"
          className={`h-12 w-12 rounded-full text-2xl shadow-xl backdrop-blur-md transition hover:scale-110 ${glass}`}
        >
          {night ? "🌙" : "☀️"}
        </button>
      </div>

      {section && (
        <Hall
          section={section}
          night={night}
          onClose={() => {
            sfx.hallClose();
            setSection(null);
          }}
        />
      )}
    </div>
  );
}
