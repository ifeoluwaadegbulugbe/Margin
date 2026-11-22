import React from "react";
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/caveat/600.css";
import "@fontsource/jetbrains-mono/500.css";
import timeline from "./timeline.json";

export const FPS = 30;
export const TOTAL_FRAMES = Math.round(timeline.total * FPS);

// Margin's own palette and type.
const PAPER = "#FFF9F0";
const INK = "#28243B";
const MUTED = "#716D7D";
const VIOLET = "#7657E8";
const CORAL = "#FF786C";
const SUN = "#FFBD59";
const MINT = "#62CBAA";
const LAVENDER = "#E9E2FF";
const LINE = "#E9E3DB";
const DISPLAY = "'Plus Jakarta Sans', sans-serif";
const TEXT = "'Inter', sans-serif";
const HAND = "'Caveat', cursive";
const MONO = "'JetBrains Mono', monospace";

type Point = { x: number; y: number; w: number; h: number } | null;
type Clip = { frames: string[]; url: string; points: Record<string, Point> };
type Beat = {
  kind?: string; clip?: string; d: number; start: number; kick?: string; cap?: string; play?: number[]; recording?: boolean;
  cursor?: [number, string][]; click?: number[]; zoom?: { to: number; at: string; from?: number }; ring?: { at: string; from: number };
};
const CLIPS = timeline.clips as unknown as Record<string, Clip>;
const BEATS = timeline.beats as unknown as Beat[];

// The browser window: the app's 1280 x 800 view, enlarged so its text is easy to read.
const S = 1.19, VW = 1280, VH = 800, CHROME = 44;
const WIN_W = VW * S, WIN_H = VH * S + CHROME, WIN_X = (1920 - WIN_W) / 2, WIN_Y = 12;
const ease = Easing.bezier(0.65, 0, 0.35, 1);
const T = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Cursor positions across the whole film, in the app's own coordinates. */
const KEYS: { t: number; x: number; y: number }[] = [];
for (const b of BEATS) {
  if (!b.clip) continue;
  KEYS.push({ t: b.start, x: KEYS.at(-1)?.x ?? 720, y: KEYS.at(-1)?.y ?? 500 });
  for (const [at, name] of b.cursor ?? []) {
    const p = CLIPS[b.clip]?.points?.[name];
    if (p) KEYS.push({ t: b.start + at, x: p.x, y: p.y });
  }
}
function cursorAt(sec: number) {
  let a = KEYS[0], z = KEYS[0];
  for (const k of KEYS) {
    if (k.t <= sec) a = k;
    if (k.t >= sec) { z = k; break; }
    z = k;
  }
  if (a === z) return a;
  const span = z.t - a.t, moveFrom = Math.max(a.t, z.t - Math.min(span, 1.1));
  const p = interpolate(sec, [moveFrom, z.t], [0, 1], { ...clamp, easing: ease });
  return { x: a.x + (z.x - a.x) * p, y: a.y + (z.y - a.y) * p };
}

const Cursor: React.FC<{ beat: Beat; sec: number }> = ({ beat, sec }) => {
  const c = cursorAt(beat.start + sec);
  const lastClick = (beat.click ?? []).filter((t) => t <= sec).at(-1);
  const since = lastClick === undefined ? 9 : sec - lastClick;
  return (
    <>
      {since < 0.5 && (
        <div style={{ position: "absolute", left: c.x, top: c.y, width: 16, height: 16, marginLeft: -8, marginTop: -8, borderRadius: 99, border: `3px solid ${VIOLET}`, opacity: 1 - since * 2, transform: `scale(${1 + since * 6})` }} />
      )}
      <svg viewBox="0 0 24 24" width={27} height={27} style={{ position: "absolute", left: c.x - 4, top: c.y - 2, transform: `scale(${since < 0.14 ? 0.86 : 1})`, filter: "drop-shadow(0 2px 3px rgba(0,0,0,.35))" }}>
        <path d="M4 2 L4 19 L8.6 15 L11.6 22 L14.6 20.8 L11.6 14 L18 14 Z" fill={INK} stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </>
  );
};

const Caption: React.FC<{ kick?: string; cap?: string; frame: number; d?: number }> = ({ kick, cap, frame, d }) => {
  if (!cap || (d !== undefined && frame >= T(d))) return null;
  const o = interpolate(frame, [0, 6], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: o }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, background: INK, color: "#fff", borderRadius: 14, padding: "11px 22px", fontFamily: TEXT, fontSize: 25, fontWeight: 500, maxWidth: 1700, boxShadow: "0 8px 24px rgba(40,36,59,.28)" }}>
        {kick && <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: 1.3, color: SUN, whiteSpace: "nowrap" }}>{kick}</span>}
        <span>{cap}</span>
      </div>
    </div>
  );
};

const Window: React.FC<{ url: string; children: React.ReactNode }> = ({ url, children }) => (
  <div style={{ position: "absolute", left: WIN_X, top: WIN_Y, width: WIN_W, height: WIN_H, background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 18px 50px rgba(40,36,59,.16)" }}>
    <div style={{ height: CHROME, background: "#f7f4ef", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 8, padding: "0 16px" }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: 99, background: c }} />)}
      <div style={{ marginLeft: 18, flex: 1, maxWidth: 720, height: 28, borderRadius: 8, background: "#fff", border: `1px solid ${LINE}`, fontFamily: TEXT, fontSize: 15, color: MUTED, display: "flex", alignItems: "center", padding: "0 12px", overflow: "hidden", whiteSpace: "nowrap" }}>{url}</div>
    </div>
    <div style={{ position: "relative", width: WIN_W, height: VH * S, overflow: "hidden" }}>{children}</div>
  </div>
);

const Screen: React.FC<{ beat: Beat }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  const clip = CLIPS[beat.clip!];
  const n = clip.frames.length;
  const [p0, p1] = beat.play ?? [0, beat.d];
  const idx = n === 1 ? 0 : Math.round(interpolate(sec, [p0, p1], [0, n - 1], clamp));
  const zp = beat.zoom?.at ? clip.points?.[beat.zoom.at] : null;
  const zoom = beat.zoom && zp ? interpolate(sec, [beat.zoom.from ?? 0, (beat.zoom.from ?? 0) + 0.9], [1, beat.zoom.to], { ...clamp, easing: ease }) : 1;
  const ox = zp ? (zp.x + VW / 2) / 2 : VW / 2, oy = zp ? (zp.y + VH / 2) / 2 : VH / 2;
  const ringP = beat.ring ? clip.points?.[beat.ring.at] : null;
  const ringO = beat.ring ? interpolate(sec, [beat.ring.from, beat.ring.from + 0.35], [0, 1], clamp) : 0;
  return (
    <Window url={clip.url}>
      <div style={{ position: "absolute", left: 0, top: 0, width: VW, height: VH, transformOrigin: "0 0", transform: `scale(${S})` }}>
        <div style={{ position: "absolute", inset: 0, transformOrigin: `${ox}px ${oy}px`, transform: `scale(${zoom})` }}>
          <Img src={staticFile(clip.frames[idx])} style={{ width: VW, height: VH, display: "block" }} />
          {ringP && (
            <div style={{ position: "absolute", left: ringP.x - ringP.w / 2 - 8, top: ringP.y - ringP.h / 2 - 8, width: ringP.w + 16, height: ringP.h + 16, borderRadius: 18, border: `3px solid ${CORAL}`, opacity: ringO, boxShadow: "0 0 0 6px rgba(255,120,108,.16)" }} />
          )}
          {beat.cursor || beat.click ? <Cursor beat={beat} sec={sec} /> : null}
        </div>
      </div>
    </Window>
  );
};

/** Scribble, the same SVG companion as in the app. */
const Scribble: React.FC<{ size: number; mood?: "curious" | "excited" | "celebrating" }> = ({ size, mood = "curious" }) => {
  const happy = mood !== "curious";
  return (
    <svg viewBox="0 0 72 72" width={size} height={size} style={{ overflow: "visible" }}>
      {mood === "celebrating" && (
        <g>
          <path d="M8 10 l2 5 l5 1 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -1z" fill={SUN} />
          <path d="M62 6 l1.5 4 l4 1 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1z" fill={VIOLET} />
          <circle cx="66" cy="30" r="2" fill={CORAL} />
        </g>
      )}
      <g stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none">
        {mood === "celebrating" ? <><path d="M14 36 q-8 -6 -7 -16" /><path d="M58 36 q8 -6 7 -16" /></> : <><path d="M13 44 q-6 2 -7 7" /><path d="M59 44 q6 2 7 7" /></>}
      </g>
      <path d="M36 12 C52 11 62 22 61 39 C60 55 49 63 35 62 C20 61 10 52 11 37 C12 22 21 13 36 12 Z" fill="#fff" stroke={INK} strokeWidth="2.4" />
      <path d="M28 13 c1 -8 7 -9 8 -3 c1 6 7 5 8 -2" fill="none" stroke={VIOLET} strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="22" cy="44" rx="4" ry="2.5" fill={CORAL} opacity="0.45" />
      <ellipse cx="50" cy="44" rx="4" ry="2.5" fill={CORAL} opacity="0.45" />
      {happy ? (
        <g stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none"><path d="M24 36 q3 -4 6 0" /><path d="M42 36 q3 -4 6 0" /></g>
      ) : (
        <g fill={INK}><circle cx="27" cy="36" r="3" /><circle cx="45" cy="36" r="3" /></g>
      )}
      {mood === "curious" ? <circle cx="36" cy="47" r="2.6" fill="none" stroke={INK} strokeWidth="2.2" /> : <path d="M28 44 q8 11 16 0 z" fill={INK} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />}
    </svg>
  );
};

const Mark: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 32 32" width={size} height={size}>
    <rect x="1" y="1" width="30" height="30" rx="9" fill={VIOLET} />
    <path d="M8 1 V31" stroke={CORAL} strokeWidth="2" />
    <path d="M12.5 22 V14.5 c0 -2 3.5 -2 3.5 0 V22 M16 14.5 c0 -2 3.5 -2 3.5 0 V22" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M22 9 l1 2 l2 .5 l-2 .8 l-1 2 l-.8 -2 l-2 -.8 l2 -.5z" fill={SUN} />
  </svg>
);

const Wordmark: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.3, fontFamily: DISPLAY, fontWeight: 800, fontSize: size, color: INK, letterSpacing: -1 }}>
    <Mark size={size * 1.15} /> margin
  </div>
);

const ruled: React.CSSProperties = {
  backgroundColor: "#fff",
  backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 47px, rgba(114,191,234,.28) 47px, rgba(114,191,234,.28) 48px)",
};

/** The problem: a chatbot that hands over the answer. An illustration with made-up messages. */
const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = (at: number) => spring({ frame: frame - T(at), fps, config: { damping: 14, stiffness: 170 } });
  const bubble = (at: number, side: "l" | "r", child: React.ReactNode) => {
    const p = pop(at);
    return (
      <div style={{ alignSelf: side === "r" ? "flex-end" : "flex-start", maxWidth: 520, opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 14}px)`, background: side === "r" ? VIOLET : "#fff", color: side === "r" ? "#fff" : INK, borderRadius: 20, padding: "16px 22px", fontFamily: TEXT, fontSize: 24, lineHeight: 1.45, boxShadow: "0 10px 26px rgba(40,36,59,.1)" }}>{child}</div>
    );
  };
  const big = (txt: string, at: number, color = INK) => {
    const p = pop(at);
    return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 16}px)`, color }}>{txt}</div>;
  };
  const s = pop(2.2);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <div style={{ position: "absolute", left: 160, top: 150, width: 640, display: "flex", flexDirection: "column", gap: 16 }}>
        {bubble(0.2, "r", "solve 2(x+3) = 14")}
        {bubble(0.8, "l", <><b>Answer: x = 4</b><br />Step 1: expand… Step 2: subtract 6… Step 3: divide by 2.</>)}
        {bubble(1.4, "r", "thanks!! next one: 3(x−2) = 12")}
        {bubble(1.9, "l", <b>Answer: x = 6</b>)}
      </div>
      <div style={{ position: "absolute", right: 170, top: 190, width: 600, height: 520, borderRadius: 22, ...ruled, boxShadow: "0 16px 40px rgba(40,36,59,.12)", padding: "34px 40px", opacity: s, transform: `rotate(${2 - s * 0.5}deg) translateY(${(1 - s) * 20}px)`, fontFamily: TEXT }}>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: 1.4, color: MUTED }}>MATHS TEST · NO PHONES</div>
        <div style={{ fontFamily: MONO, fontSize: 40, marginTop: 40, color: INK }}>5(x − 1) = 20</div>
        <div style={{ fontFamily: HAND, fontSize: 64, marginTop: 40, color: CORAL }}>x = ???</div>
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 110, fontFamily: DISPLAY, fontWeight: 800, fontSize: 64, textAlign: "center", lineHeight: 1.12, letterSpacing: -1 }}>
        {big("AI made homework answers instant.", 3.4)}
        {big("It didn't make understanding instant.", 4.4, VIOLET)}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const LogoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 15, stiffness: 150 } });
  const q = spring({ frame: frame - 12, fps, config: { damping: 16 } });
  return (
    <AbsoluteFill style={{ background: PAPER, alignItems: "center", justifyContent: "center", color: INK }}>
      <div style={{ transform: `scale(${0.9 + p * 0.1})`, opacity: p, display: "flex", alignItems: "center", gap: 40 }}><Wordmark size={110} /><Scribble size={130} mood="curious" /></div>
      <div style={{ opacity: q, transform: `translateY(${(1 - q) * 14}px)`, fontFamily: HAND, fontWeight: 600, fontSize: 72, marginTop: 30, color: CORAL }}>Think it through.</div>
      <div style={{ opacity: q, fontFamily: TEXT, fontSize: 27, marginTop: 14, color: MUTED }}>A Socratic maths notebook with hybrid on-device and cloud AI. Real footage of the live app.</div>
    </AbsoluteFill>
  );
};

/**
 * On-device inference. With the owner's own screen recording (public/ondevice.mp4) it plays that.
 * Without it, it shows the actual results the owner got on the app's test page on their laptop.
 */
const OnDevice: React.FC<{ beat: Beat }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (beat.recording) {
    return (
      <AbsoluteFill style={{ background: PAPER }}>
        <Window url="lodestar-f3359.web.app/dev/spike/">
          <OffthreadVideo src={staticFile("ondevice.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }} />
        </Window>
        <Caption kick={beat.kick} cap={beat.cap} frame={frame} d={beat.d} />
      </AbsoluteFill>
    );
  }
  const row = (at: number, mode: string, src: string, ms: string, color: string, note: string) => {
    const p = spring({ frame: frame - T(at), fps, config: { damping: 16 } });
    return (
      <div style={{ opacity: p, transform: `translateY(${(1 - p) * 18}px)`, background: "#fff", borderRadius: 20, padding: "26px 34px", boxShadow: "0 10px 28px rgba(40,36,59,.08)", border: `1px solid ${LINE}`, width: 1240 }}>
        <div style={{ fontFamily: MONO, fontSize: 32, color: INK }}>mode: {mode} · inferenceSource: <span style={{ color, fontWeight: 700 }}>{src}</span> · {ms}</div>
        <div style={{ fontFamily: HAND, fontSize: 34, color: MUTED, marginTop: 6 }}>{note}</div>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ background: PAPER, alignItems: "center", justifyContent: "center", gap: 26, paddingBottom: 60 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 6 }}>
        <Scribble size={96} mood="excited" />
        <div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 52, color: INK, letterSpacing: -0.5 }}>Proof: the same prompt, two places</div>
          <div style={{ fontFamily: TEXT, fontSize: 26, color: MUTED }}>Results from Margin's test page on our laptop, reported by Firebase AI Logic</div>
        </div>
      </div>
      {row(0.6, "PREFER_ON_DEVICE", "on_device", "27.8 s", "#1c7a5c", "Gemini Nano in Chrome, running on the laptop itself.")}
      {row(1.4, "ONLY_IN_CLOUD", "in_cloud", "3.3 s", "#23709e", "Gemini through Firebase AI Logic, in the cloud.")}
      <Caption kick={beat.kick} cap={beat.cap} frame={frame} d={beat.d} />
    </AbsoluteFill>
  );
};

const Phones: React.FC<{ beat: Beat }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const names = ["phone-desk", "phone-notebook", "phone-rewards"].filter((n) => CLIPS[n]);
  const h = 880, w = (h * 390) / 844;
  return (
    <AbsoluteFill style={{ background: PAPER, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 70, paddingBottom: 66 }}>
      {names.map((n, i) => {
        const p = spring({ frame: frame - i * 5, fps, config: { damping: 16 } });
        return (
          <div key={n} style={{ width: w + 22, height: h + 22, padding: 11, background: INK, borderRadius: 52, opacity: p, transform: `translateY(${(1 - p) * 34}px) rotate(${(i - 1) * 2}deg)` }}>
            <Img src={staticFile(CLIPS[n].frames[0])} style={{ width: w, height: h, borderRadius: 42, display: "block" }} />
          </div>
        );
      })}
      <Caption kick={beat.kick} cap={beat.cap} frame={frame} d={beat.d} />
    </AbsoluteFill>
  );
};

const STACK: [string, string, string][] = [
  ["Firebase AI Logic · hybrid inference", "PREFER_ON_DEVICE for Scribble, ONLY_IN_CLOUD for the Learning Guide", LAVENDER],
  ["Gemini Nano in Chrome", "Private, on-device Socratic replies", "#DDF5EB"],
  ["Gemini 3.5 Flash-Lite", "Cloud fallback and cross-session analysis", "#E4F3FC"],
  ["Deterministic maths engine", "mathjs + a linear solver judge every line", "#FFF1D6"],
  ["Firebase Auth + Cloud Firestore", "Guest or Google sign-in, owner-only security rules", "#fff"],
  ["App Check · reCAPTCHA Enterprise", "Protects AI Logic and the database", "#fff"],
  ["Next.js + TypeScript · Firebase Hosting", "434 automated tests, MIT licensed", "#fff"],
];
const Stack: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: PAPER, alignItems: "center", justifyContent: "center", fontFamily: TEXT, color: INK }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 62, marginBottom: 10, letterSpacing: -0.5 }}>The AI asks. The maths engine decides.</div>
      <div style={{ fontSize: 28, color: MUTED, marginBottom: 40 }}>Correctness never depends on a language model, and every label shows where the AI really ran.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 660px)", gap: 16 }}>
        {STACK.map(([a, b, bg], i) => {
          const p = spring({ frame: frame - 6 - i * 4, fps, config: { damping: 16 } });
          return (
            <div key={a} style={{ gridColumn: i === STACK.length - 1 ? "1 / span 2" : undefined, background: bg, border: `1px solid ${LINE}`, borderRadius: 18, padding: "16px 24px", opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
              <div style={{ fontWeight: 600, fontSize: 27 }}>{a}</div>
              <div style={{ fontSize: 21, color: MUTED }}>{b}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const End: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 15 } });
  const q = spring({ frame: frame - 14, fps, config: { damping: 16 } });
  return (
    <AbsoluteFill style={{ background: VIOLET, alignItems: "center", justifyContent: "center", color: "#fff", textAlign: "center" }}>
      <div style={{ transform: `scale(${0.92 + p * 0.08})`, opacity: p, display: "flex", alignItems: "center", gap: 30 }}>
        <div style={{ background: PAPER, borderRadius: 28, padding: "18px 30px" }}><Wordmark size={84} /></div>
        <Scribble size={130} mood="celebrating" />
      </div>
      <div style={{ opacity: q, fontFamily: DISPLAY, fontWeight: 800, fontSize: 58, marginTop: 34, letterSpacing: -0.5 }}>Private help in the moment. Long-term wisdom from the cloud.</div>
      <div style={{ opacity: q, fontFamily: HAND, fontSize: 60, marginTop: 10, color: SUN }}>Think it through.</div>
      <div style={{ opacity: q, fontFamily: TEXT, fontSize: 28, marginTop: 24, color: "#e6defe" }}>lodestar-f3359.web.app · github.com/ifeoluwaadegbulugbe/Margin</div>
    </AbsoluteFill>
  );
};

const BeatView: React.FC<{ beat: Beat }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 5], [0, 1], clamp);
  let body: React.ReactNode;
  if (beat.kind === "problem") body = <Problem />;
  else if (beat.kind === "logo") body = <LogoScene />;
  else if (beat.kind === "ondevice") body = <OnDevice beat={beat} />;
  else if (beat.kind === "phone") body = <Phones beat={beat} />;
  else if (beat.kind === "stack") body = <Stack />;
  else if (beat.kind === "end") body = <End />;
  else body = (
    <AbsoluteFill style={{ background: PAPER }}>
      <Screen beat={beat} />
      <Caption kick={beat.kick} cap={beat.cap} frame={frame} d={beat.d} />
    </AbsoluteFill>
  );
  return <AbsoluteFill style={{ opacity: fade }}>{body}</AbsoluteFill>;
};

export const Demo: React.FC = () => (
  <AbsoluteFill style={{ background: PAPER }}>
    {BEATS.map((b, i) => (
      <Sequence key={i} from={T(b.start)} durationInFrames={T(b.d) + 6} layout="none">
        <BeatView beat={b} />
      </Sequence>
    ))}
    <Audio src={staticFile("audio.wav")} />
  </AbsoluteFill>
);
