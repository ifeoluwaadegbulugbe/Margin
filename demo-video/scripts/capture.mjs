/**
 * Captures real footage of Margin by driving Chrome through the live site and saving its actual screens.
 *   node scripts/capture.mjs            live site, fresh guest account (no password is ever typed)
 *   node scripts/capture.mjs local      http://localhost:3000 (needs `npm run dev` in the app folder)
 * Chrome runs in its own throwaway profile, so the student's real browser and accounts are never touched.
 * Gemini Nano is not set up in that profile, so Scribble's replies here honestly come from the cloud.
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const LOCAL = process.argv[2] === "local";
const TARGET = LOCAL ? "local" : "live";
const APP = LOCAL ? "http://localhost:3000" : "https://lodestar-f3359.web.app";
const OUT = resolve(`public/footage/${TARGET}`);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const PORT = 9335;

if (await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true).catch(() => false)) throw new Error(`Port ${PORT} is busy. Close the old capture window first.`);
const chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
  "--window-size=1400,980", "--no-first-run", "--no-default-browser-check", "--disable-search-engine-choice-screen",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), `margin-capture-${Date.now()}`)}`, "about:blank",
], { stdio: "ignore" });

let target;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(500);
  try { target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json(); } catch { /* starting */ }
}
if (!target) throw new Error("Chrome didn't start");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let nextId = 1;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = nextId++;
  pending.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const HELPERS = `
  const byText=(t,scope='body')=>[...document.querySelectorAll(scope+' a,'+scope+' button')].find(e=>{const x=e.textContent.trim();return (x===t||x.startsWith(t)||e.getAttribute('aria-label')===t)&&e.offsetParent!==null});
  const panel=()=>document.querySelector('[aria-label="Scribble, your guide"]');
`;
const js = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: `(async()=>{${HELPERS}${expr}})()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`js: ${r.exceptionDetails.exception?.description ?? expr.slice(0, 90)}`);
  return r.result.value;
};
const until = async (cond, what, ms = 90000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await js(`return !!(${cond})`).catch(() => false)) return;
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${what}, at ${await js("return location.href")}`);
};
const go = async (path, cond = "document.querySelector('main')") => {
  await send("Page.navigate", { url: APP + path });
  await sleep(700);
  await until(`document.readyState==='complete' && ${cond}`, path);
  await sleep(1400);
};
const VIEW = { width: 1280, height: 800, deviceScaleFactor: 1.6, mobile: false };
const viewport = (v = VIEW) => send("Emulation.setDeviceMetricsOverride", v);

const manifest = {};
const save = async (clip, n) => {
  const { data } = await send("Page.captureScreenshot", { format: "jpeg", quality: 88 });
  const file = `${clip}-${String(n).padStart(3, "0")}.jpg`;
  writeFileSync(join(OUT, file), Buffer.from(data, "base64"));
  return `footage/${TARGET}/${file}`;
};
const rects = async (points) => {
  const out = {};
  for (const [name, finder] of Object.entries(points)) {
    out[name] = await js(`const e=${finder};if(!e)return null;const r=e.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),w:Math.round(r.width),h:Math.round(r.height)}`).catch(() => null);
  }
  return out;
};
const url = () => js("return location.host+location.pathname");
/** Let animations (page reveal, notes drawing in, count-ups) finish before a still is saved. */
const settle = async (ms = 900) => { await js("await document.fonts.ready;return 1"); await sleep(ms); };
const snap = async (clip, points = {}, wait = 900) => {
  await settle(wait);
  manifest[clip] = { frames: [await save(clip, 0)], url: await url(), points: await rects(points) };
  log("captured", clip);
};
/** Several frames over time, for moments that animate (stickers flying in, XP counting up). */
const timed = async (clip, count, gap, points = {}) => {
  const frames = [];
  for (let i = 0; i < count; i++) { frames.push(await save(clip, i)); await sleep(gap); }
  manifest[clip] = { frames, url: await url(), points: await rects(points) };
  log("captured", clip, frames.length, "frames");
};
const scrollClip = async (clip, toY, steps = 30, points = {}) => {
  const from = await js("return window.scrollY");
  const max = await js("return document.documentElement.scrollHeight-innerHeight");
  const to = Math.min(toY, max);
  const frames = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, e = t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    await js(`window.scrollTo({top:${from + (to - from) * e},behavior:'instant'});return 1`);
    await sleep(70);
    frames.push(await save(clip, i));
  }
  manifest[clip] = { frames, url: await url(), points: await rects(points) };
  log("captured", clip, frames.length, "frames");
};
const setValue = (sel, v) => js(`const el=document.querySelector(${JSON.stringify(sel)});el.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(v)});el.dispatchEvent(new Event('input',{bubbles:true}));return 1`);
/** The text really is typed into the app, a few letters per saved frame. */
const typeClip = async (clip, sel, text, each = 2, points = {}) => {
  const frames = [];
  for (let n = 0, i = 0; ; n = Math.min(n + each, text.length), i++) {
    await setValue(sel, text.slice(0, n));
    await sleep(90);
    frames.push(await save(clip, i));
    if (n === text.length) break;
  }
  manifest[clip] = { frames, url: await url(), points: await rects({ input: `document.querySelector(${JSON.stringify(sel)})`, ...points }) };
  log("captured", clip, frames.length, "frames");
};
const click = (finder) => js(`const e=${finder};if(!e)throw new Error('nothing to click: '+${JSON.stringify(finder)});e.click();return 1`);
const enter = (sel) => js(`document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return 1`);
const submitForm = (sel) => js(`document.querySelector(${JSON.stringify(sel)}).closest('form').requestSubmit();return 1`);

const NOTES = "(panel()?.querySelectorAll('[class*=shadow-]')?.length ?? 0)";
const THINKING = "panel()?.querySelector('.shimmer')";
/**
 * Sends one turn to Scribble: saves the real "thinking" moment, then waits for the real reply.
 * The network is NOT slowed, so the latency the app shows on screen is the real one.
 */
const turn = async (clip, doSubmit) => {
  const before = await js("return panel()?.innerText ?? ''");
  await doSubmit();
  await until(THINKING, "thinking", 3000).catch(() => undefined);
  if (await js(`return !!${THINKING}`)) manifest[`${clip}-thinking`] = { frames: [await save(`${clip}-thinking`, 0)], url: await url(), points: {} };
  await until(`!${THINKING} && (panel()?.innerText ?? '') !== ${JSON.stringify(before)}`, `${clip} reply`, 60000);
};
/** Solves the equation on screen (for the quick second and third problems). */
const answerOnScreen = () => js(`const t=document.querySelector('[aria-label="The problem"] .katex-html')?.textContent??'';
  const s=t.replace(/−/g,'-').replace(/×/g,'*').replace(/÷/g,'/').replace(/\\s/g,'').replace(/(\\d)x/g,'$1*x').replace(/(\\d)\\(/g,'$1*(').replace(/\\)\\(/g,')*(');
  const [L,R]=s.split('=');const f=(x)=>Function('x','return ('+L+')-('+(R??'0')+')')(x);
  if(R===undefined) return String(Function('return ('+L+')')());
  const a=f(1)-f(0),b=f(0);const v=-b/a;return Number.isInteger(v)?String(v):String(Math.round(v*1e6)/1e6)`);

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await viewport();

  // ---- Landing and onboarding ----
  await go("/", "byText('Start learning')");
  await snap("landing", { start: "byText('Start learning')" }, 2200);
  await click("byText('Start learning')");
  await until("location.pathname.startsWith('/onboarding')", "onboarding", 30000);
  await until("document.querySelector('h1')?.textContent.includes('Welcome')", "welcome");
  await snap("onb-welcome", { go: "byText(\"Let's go\")" }, 1500);
  await click("byText(\"Let's go\")");
  await until("document.querySelector('h1')?.textContent.includes('explore')", "subjects");
  await snap("onb-subjects", { maths: "byText('Mathematics')", go: "byText('Continue')" });
  await click("byText('Continue')");
  await until("document.querySelector('h1')?.textContent.includes('right now')", "level");
  await snap("onb-level", { year: "byText('Year 10')", go: "byText('Continue')" });
  await click("byText('Continue')");
  await until("document.querySelector('h1')?.textContent.includes('goal')", "goal");
  await click("byText('Continue')");
  await until("document.querySelector('h1')?.textContent.includes('Wake')", "wake");
  await sleep(800);
  await click("byText('Begin my first challenge')");

  // ---- Warm-up: answered honestly, with one miss, so the first pages fit ----
  await until("location.pathname.startsWith('/calibrate') && document.getElementById('cal')", "warm-up", 30000);
  await sleep(1200);
  await typeClip("warmup", "#cal", "10", 1, { submit: "byText('Submit')" });
  await submitForm("#cal");
  for (const a of ["16", "7/12", "6", "2"]) {
    await sleep(900);
    await setValue("#cal", a);
    await submitForm("#cal");
  }
  await sleep(900);
  await click("byText(\"I'm not sure\")");
  await until("document.querySelector('h1')?.textContent.includes('Planning')", "planning", 15000).catch(() => undefined);
  if (await js("return !!document.querySelector('h1')?.textContent.includes('Planning')")) await snap("planning", {}, 600);
  await until("location.pathname.startsWith('/desk')", "desk", 60000);
  await until("document.body.innerText.includes('Notes from your learning guide') && !document.body.innerText.includes('After a few challenges')", "first guide note", 40000).catch(() => undefined);
  await snap("desk", { open: "byText('Open your notebook')", guide: "[...document.querySelectorAll('div')].find(d=>d.textContent.startsWith('Notes from your learning guide'))" }, 1800);

  // ---- Choose a topic and open the notebook ----
  await go("/explore/?topic=multi-step", "byText('Practise this topic')");
  await snap("explore", { practise: "byText('Practise this topic')", path: "document.querySelector('ol[aria-label=\"Learning path\"]')" });
  await click("byText('Practise this topic')");
  await until("document.querySelector('[role=dialog]')", "sheet");
  await snap("sheet", { open: "byText('Open your notebook','[role=dialog]')" });
  await click("byText('Open your notebook','[role=dialog]')");
  await until("location.pathname.startsWith('/learn') && document.getElementById('line-input')", "workspace", 30000);

  // ---- The challenge: one right line, one sign mistake, an answer request, a hint, the fix ----
  await snap("ws-orient", { line: "document.getElementById('line-input')", problem: "document.querySelector('[aria-label=\"The problem\"]')" }, 1600);
  const pts = { line: "document.getElementById('line-input')", note: "panel()?.querySelector('[class*=shadow-]')", work: "document.querySelector('[aria-label=\"Your working area\"]')", hint: "byText('Reveal a hint')", reply: "document.getElementById('reply')" };
  await typeClip("type-line1", "#line-input", "2x + 6 = 14", 2);
  await turn("line1", () => enter("#line-input"));
  await snap("ws-line1", pts, 1300);
  await typeClip("type-line2", "#line-input", "2x = 20", 2);
  await turn("line2", () => enter("#line-input"));
  await snap("ws-wrong", { ...pts, wrong: "[...document.querySelectorAll('[aria-label=\"Your working area\"] li')].at(-1)" }, 1600);
  await typeClip("type-ask", "#reply", "just tell me the answer", 3);
  await turn("ask", () => submitForm("#reply"));
  await snap("ws-ask", pts, 1500);
  await click("byText('Reveal a hint')");
  await until("document.querySelector('[aria-label=\"Hints\"]') && !" + THINKING, "hint", 40000);
  await snap("ws-hint", { ...pts, hints: "document.querySelector('[aria-label=\"Hints\"]')" }, 1500);
  await typeClip("type-fix", "#line-input", "2x = 8", 2);
  await turn("fix", () => enter("#line-input"));
  await setValue("#line-input", "x = 4");
  await turn("solved", () => enter("#line-input"));
  await snap("ws-solved", { ...pts, final: "document.getElementById('final')" }, 1300);
  await typeClip("type-final", "#final", "4", 1);
  await submitForm("#final");
  await sleep(1500);
  await snap("ws-explain", { ...pts, reply: "document.getElementById('reply')" }, 900);
  await typeClip("type-explain", "#reply", "I subtracted 6 from both sides to keep it balanced, then divided both sides by 2", 6);
  await turn("explain", () => submitForm("#reply"));
  await sleep(1200);
  if (await js("return !!byText('Skip this one')")) {
    await snap("ws-transfer", {}, 900);
    await click("byText('Skip this one')");
  }
  await until("byText('Turn the page') || byText('Finish this chapter')", "page complete", 40000);
  await until("!panel()?.querySelector('.shimmer')", "celebration note", 30000);
  await snap("ws-complete", { next: "byText('Turn the page') || byText('Finish this chapter')" }, 3200);

  // The other two problems, solved quickly off camera
  for (let k = 0; k < 2 && await js("return !!byText('Turn the page')"); k++) {
    await click("byText('Turn the page')");
    await until("document.getElementById('final')", "next problem", 20000);
    await sleep(1200);
    await setValue("#final", await answerOnScreen());
    await submitForm("#final");
    await until("document.getElementById('reply') && !document.getElementById('reply').disabled", "explain", 20000);
    await setValue("#reply", "I did the same thing to both sides to undo each operation and keep the equation balanced");
    await submitForm("#reply");
    await until("byText('Skip this one') || byText('Turn the page') || byText('Finish this chapter')", "after explain", 40000);
    if (await js("return !!byText('Skip this one')")) await click("byText('Skip this one')");
    await until("byText('Turn the page') || byText('Finish this chapter')", "page complete", 40000);
    await sleep(800);
  }

  // ---- Chapter complete: stickers, level, the Learning Guide's note ----
  await click("byText('Finish this chapter')");
  await until("location.pathname.startsWith('/complete')", "complete", 30000);
  await until("document.querySelector('[role=dialog]')", "reward overlay", 15000).catch(() => undefined);
  if (await js("return !!byText('Add to my collection')")) {
    await timed("stickers", 14, 90);
    await click("byText('Add to my collection')");
    await sleep(900);
  }
  if (await js("return !!byText('Keep going')")) {
    await timed("levelup", 10, 90);
    await click("byText('Keep going')");
    await sleep(900);
  }
  await until("!document.body.innerText.includes('Your guide is reading this session')", "guide note", 60000).catch(() => undefined);
  await js("window.scrollTo({top:0,behavior:'instant'});return 1");
  await snap("complete", {}, 1400);
  await scrollClip("complete-scroll", 760, 30, { next: "byText('Start next challenge')" });

  // ---- Progress and the AI engine, reached by clicking (so the in-memory AI log keeps this visit's calls) ----
  await click("byText('Back to my desk')");
  await until("location.pathname.startsWith('/desk')", "desk again", 20000);
  await sleep(1500);
  await click("document.querySelector('aside a[href=\"/progress/\"]')");
  await until("location.pathname.startsWith('/progress') && document.querySelector('h1')", "progress", 20000);
  await sleep(1500);
  await js("[...document.querySelectorAll('h2')].find(h=>h.textContent.includes('Notes from your learning guide'))?.scrollIntoView({block:'start',behavior:'instant'});window.scrollBy({top:-100,behavior:'instant'});return 1");
  await snap("progress", {}, 1200);
  await click("document.querySelector('button[aria-label=\"Profile menu\"]')");
  await sleep(500);
  await click("document.querySelector('[role=menu] a[href=\"/settings/\"]')");
  await until("location.pathname.startsWith('/settings') && document.querySelector('table')", "settings with log", 20000);
  await snap("settings", { engine: "[...document.querySelectorAll('h2')].find(h=>h.textContent.includes('AI engine'))" }, 1200);
  await js("[...document.querySelectorAll('div')].find(d=>d.textContent.trim()==='What Scribble knows about you')?.scrollIntoView({block:'start',behavior:'instant'});window.scrollBy({top:-110,behavior:'instant'});return 1");
  await snap("settings-log", { watch: "document.querySelector('pre')", log: "document.querySelector('table')" }, 1000);
  await go("/rewards/", "document.querySelector('h1')");
  await snap("rewards", {}, 1500);
  await go("/notebook/", "document.querySelector('h1')");
  await snap("notebook", {}, 1300);

  // ---- Phone ----
  await viewport({ width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  for (const [clip, path] of [["phone-desk", "/desk/"], ["phone-notebook", "/notebook/"], ["phone-rewards", "/rewards/"]]) {
    await go(path, "document.querySelector('h1')");
    await snap(clip, {}, 1300);
  }
  await viewport();

  writeFileSync(resolve(`public/footage/${TARGET}.json`), JSON.stringify({ target: TARGET, clips: manifest }, null, 1));
  log("done:", Object.keys(manifest).length, "clips");
} catch (e) {
  writeFileSync(resolve(`public/footage/${TARGET}.partial.json`), JSON.stringify({ target: TARGET, clips: manifest }, null, 1));
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  ws.close();
  spawn("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" });
}
