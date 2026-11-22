# Margin

**Think it through.** An interactive learning notebook: a gamified Socratic maths tutor built for the Firebase AI Logic Hybrid Inference hackathon.

A student brings a maths problem they're stuck on. They don't get the answer. They get **Scribble**, a Socratic guide that runs on their own device with Gemini Nano in Chrome. Scribble asks one question at a time, while a deterministic maths engine checks every line the student writes. After each session the **Learning Guide**, a strategist in the cloud, studies compact learning records from all of the student's sessions. It finds recurring misconceptions and writes a watch-list back into Scribble's next prompts.

- **Live app:** https://lodestar-f3359.web.app
- **Demo video:** _add link_
- **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · **Hybrid inference notes:** [docs/HYBRID_INFERENCE.md](docs/HYBRID_INFERENCE.md)

## Why hybrid is the product

| | On-device: **Scribble** | Cloud: **Learning Guide** |
|---|---|---|
| Job | Moment-to-moment Socratic replies | Cross-session analysis and planning the next challenges |
| Mode | `InferenceMode.PREFER_ON_DEVICE` (Gemini Nano, automatic cloud fallback) | `InferenceMode.ONLY_IN_CLOUD` |
| Sees | One compact state packet per turn | Problem IDs, counts, hint levels, timings. Never what the student typed |
| Why there | Dozens of tiny exchanges per problem should be private and need no server | Long histories and planning need a bigger model |

The two halves close a loop. The Learning Guide's `nova_watch_phrase` values become the `WATCH:` line in every following Scribble prompt. You can see this under **profile menu → Settings & AI engine → What Scribble knows about you**.

**The maths is never judged by the model.** `src/lib/learning/verify.ts` solves every line with mathjs plus a linear solver. Scribble is told the facts and a plain verdict (`VERDICT: the student's latest line is WRONG`). It only supplies the language, and the app owns the stage machine.

### Honest routing on real hardware

Gemini Nano speed varies a lot between laptops (on our test laptop it took about 30 s per reply). The app measures it:

- **Fast device:** Scribble answers on-device.
- **Slow device (median over 12 s):** in *auto* mode, live turns use `ONLY_IN_CLOUD`, and the AI log says `ONLY_IN_CLOUD (device slow)`.
- **Always on-device switch** (Settings): Scribble waits for Nano. Use it to demonstrate private inference.
- **Cloud rescue:** if an on-device reply is too slow or fails a check, Scribble asks the cloud once. It shows an authored line, labelled **Offline script**, only if that also fails.
- **Learning Guide backup:** if the configured model is busy, it retries with `gemini-3.5-flash-lite` and the log names the model that answered.

Every label in the UI comes from the SDK's `response.inferenceSource`, never from a guess.

## How to verify on-device inference (judge protocol)

1. Use desktop Chrome 139+. Enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and relaunch. In DevTools, `await LanguageModel.availability()` should return `available`, `downloadable` or `downloading`. Hardware requirements are at developer.chrome.com/docs/ai/get-started.
2. Open `/dev/spike/` and click **Wake Scribble**. This calls `tutorModel.initializeDeviceModel()` from a user gesture.
3. Click **Run (prefer device)** and look for `inferenceSource: on_device`. Turn Wi-Fi off and run it again: it still answers on-device.
4. Click **Run (cloud only)** and look for `inferenceSource: in_cloud`. The Network tab shows the Firebase AI Logic request.
5. In the main app, open **Settings & AI engine**. It shows device status, measured on-device reply times, the mode in use, the **Force cloud tutor** and **Always on-device** switches, and a live log of every call (who, task, mode, reported source, latency, validation result).
6. Finish a challenge set. A **Guide** row appears in the log (Cloud, valid), and the home page's *Notes from your learning guide* updates.

## Setup

Prerequisites: Node 20+ and desktop Chrome 139+.

```powershell
npm install
Copy-Item .env.example .env.local   # then fill in the Firebase values
npm run dev
```

Firebase console:
1. Create a project, then go to **AI Logic → Get started → Gemini Developer API**.
2. **Authentication:** enable Anonymous and Google.
3. **Firestore:** create the database in production mode. The rules are in `firestore.rules`.
4. **App Check:** register the web app with reCAPTCHA Enterprise. The key must allow your `*.web.app` and `*.firebaseapp.com` domains. For local development, put any UUID in `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN` and register it under *App Check → Apps → Manage debug tokens*. It is only used in development builds.
5. Set `NEXT_PUBLIC_STRATEGIST_MODEL` to a model ID from the Firebase AI Logic *supported models* page (default `gemini-3.5-flash-lite`).

Without `.env.local` the app runs in **local mode**: progress stays in the browser and Scribble uses its written notes. The whole learning loop stays testable offline.

```powershell
npm test          # 434 tests: verifier, every problem re-solved, stage machine, XP, mastery, AI guards, strategist validation
npm run lint
npm run build     # static export to out/
npx firebase-tools deploy --only hosting,firestore:rules
```

## What's inside

- **Content:** five algebra topics and 40 hand-written problems (`src/content/algebra/*.json`). Each has authored steps, four hint rungs, a worked parallel example and wrong-answer values mapped to misconceptions. The tests re-solve every answer, step and worked example, and check that no hint leaks the answer.
- **Socratic workspace:** line-by-line checking, a six-stage flow (understand → plan → work it out → check → explain → try it elsewhere), hints that appear on the page as notes, and XP costs shown before a hint is opened.
- **Guards on every AI reply:** schema validation (zod), answer-leak detection, exactly one question, length cap, tone blocklist, and *verdict consistency* (a reply that praises a wrong line, or criticises a correct one, is rejected).
- **Game:** XP comes only from reasoning, written to an append-only ledger. Levels, eight sticker achievements, a daily goal, a streak with freezes, and a transparent mastery average (α = 0.3) with a "why?" explanation.
- **Design:** *The Living Notebook*: warm paper surfaces, Plus Jakarta Sans, Inter and Caveat, violet, coral, sunshine and mint, and Scribble, an original SVG companion with five expressions. Motion respects `prefers-reduced-motion`.
- **Privacy:** the Learning Guide never sees typed text. The cloud tutor (fallback only) gets the packet: problem, latest line (≤200 characters), stage, hint level and watch-list. It never gets a name or email.

## Known limitations

- Gemini Nano needs a capable desktop, and its speed varies widely; slow devices are routed to the cloud in auto mode.
- XP totals are computed on the client. Firestore rules limit the damage: XP never decreases, at most +1000 per write, and the ledger is append-only. With no leaderboards, inflated XP only affects your own profile.
- When Scribble runs in the cloud, the student's latest line or explanation is part of the prompt.

## Licence

MIT. See [LICENSE](LICENSE).
