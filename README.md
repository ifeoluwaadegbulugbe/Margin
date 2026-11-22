# Margin

**Think it through.** An interactive learning notebook (formerly codenamed Lodestar): a gamified Socratic maths tutor built for the Firebase AI Logic Hybrid Inference hackathon.

A student brings a maths problem they're stuck on. They don't get the answer. They get **Scribble**, a Socratic guide that runs on their own device with Gemini Nano in Chrome. Scribble asks one question at a time, and a deterministic maths engine checks every line the student writes. After each session the **Learning Guide**, a strategist running in the cloud, studies compact learning records from all of the student's sessions. It finds recurring misconceptions and writes a watch-list back into Scribble's next prompts.

- Demo: _add your `PROJECT.web.app` URL_
- Video: _add link_

## Design

The interface follows *The Living Notebook* direction: warm paper surfaces, ink typography (Plus Jakarta Sans, Inter, Caveat for margin notes), violet for actions, coral for emphasis, sunshine for rewards, mint for mastery. Hints appear on the page as notes; achievements are collectible stickers; mastered topics get an ink stamp. Scribble, the companion, is an original SVG character with five expressions (curious, thinking, encouraging, excited, celebrating). Motion respects `prefers-reduced-motion`.

## Why hybrid is the product

| | On-device: **Scribble** | Cloud: **Learning Guide** |
|---|---|---|
| Job | Moment-to-moment Socratic replies | Cross-session analysis, route planning |
| Mode | `InferenceMode.PREFER_ON_DEVICE` (automatic cloud fallback) | `InferenceMode.ONLY_IN_CLOUD` |
| Sees | One compact state packet per turn (single-turn) | Problem IDs, counts, hint levels, timings. Never what the student typed |
| Why there | Dozens of tiny exchanges per problem need to be instant and private | Long history and planning need a bigger model |

The two halves close a loop. The Learning Guide's `nova_watch_phrase` values become the `WATCH:` line in every following Scribble packet. You can see this under **Profile menu → Settings & AI engine → What Scribble knows about you**.

**The maths is never judged by the model.** `src/lib/learning/verify.ts` solves every line with mathjs plus a linear solver. Scribble is only told the facts (`Line 2 "3x = 6" CHANGED the solution…`). It produces language, and the app owns the stage machine.

## How to verify on-device inference (judge protocol)

1. Use desktop Chrome 139+. Enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and restart. Check that `await LanguageModel.availability()` in DevTools returns `available`, `downloadable` or `downloading`. Hardware requirements are at developer.chrome.com/docs/ai/get-started.
2. Onboarding → **Wake Scribble on this device**. This calls `tutorModel.initializeDeviceModel()` from a click.
3. Solve a step. The chip under Scribble's message and the **Inference log** show `On-device`. That label comes from `result.response.inferenceSource === InferenceSource.ON_DEVICE`.
4. Turn Wi-Fi off. Scribble still answers on-device. Firestore writes queue offline.
5. Turn Wi-Fi back on. In AI engine panel, switch on **Force cloud tutor**. The next reply shows `Cloud`, and the Network tab shows the Firebase AI Logic request.
6. Open the app in a browser without Nano. The same journey works with every reply from the cloud.
7. Finish an expedition. The log shows `Strategist · in_cloud`, and the Learning desk's Next expedition and Scribble's WATCH line update.

If Scribble's reply fails validation twice, or there is no network and no device model, an **authored** line from the content bank is shown. It is labelled `Guide (offline script)`, never as AI.

The relevant code is in `src/lib/ai/models.ts` (all model configuration), `src/lib/ai/inference.ts` (source, timeout, stale-request guard) and `src/lib/ai/tutor.ts` (packet → infer → zod + guards → retry → fallback).

## Setup

Prerequisites: Node 20+ and desktop Chrome 139+.

```powershell
npm install
Copy-Item .env.example .env.local   # then fill in values
npm run dev
```

Firebase console:
1. Create a project, then go to **AI Logic → Get started → Gemini Developer API**.
2. **Authentication**: enable Anonymous and Google. Add your Hosting domains as authorised domains.
3. **Firestore**: create the database in production mode.
4. **App Check**: register the web app with reCAPTCHA Enterprise and put the site key in `.env.local`. For local development, register the debug token printed in the browser console under *App Check → Manage debug tokens*. App Check is enforced automatically for AI Logic.
5. Set `NEXT_PUBLIC_STRATEGIST_MODEL` to an exact model name from the AI Logic "supported models" page. It defaults to `gemini-3.5-flash-lite`.

Without `.env.local` the app runs in **local mode**. Progress stays in the browser, and Scribble uses its authored guide, labelled as such. This keeps the whole learning loop testable offline.

```powershell
npm test          # 428 tests: verifier, every content problem re-solved, stage machine, XP, mastery, guards, strategist validation
npm run lint
npm run build     # static export to out/
npx firebase-tools deploy --only hosting,firestore:rules
```

`/dev/spike` is the Phase-0 page. It runs one packet through `PREFER_ON_DEVICE` and `ONLY_IN_CLOUD` and shows the raw JSON and `inferenceSource`.

## What's inside

- **Content**: one constellation, five skills and 40 hand-written problems (`src/content/algebra/*.json`). Each has authored steps, four hint rungs, a worked parallel example and distractor values mapped to misconceptions. `tests/content.test.ts` re-solves every answer, step line and worked example. It also checks that no worked example shares the original's answer and that no hint leaks it.
- **Socratic workspace**: line-by-line verification, a six-stage machine (`ORIENT → PLAN → STEP → VERIFY → EXPLAIN → TRANSFER`), a four-rung hint ladder with XP costs, explain-your-reasoning and a transfer challenge.
- **Guards**: answer-leak detection against forbidden strings, one question per reply, a length cap, a tone blocklist, and a rule that the verifier's misconception wins over the model's.
- **Game**: XP comes only from reasoning, written to an auditable ledger. Ranks, eight achievements, daily goal, streak with freezes and a transparent mastery EWMA (α = 0.3).
- **Privacy**: the Learning Guide never sees typed text. The cloud tutor (fallback only) gets the packet: problem, latest line (≤200 chars), stage, hint level and watch-list. It never gets a name or email.

## Known limitations

- Gemini Nano needs a capable desktop. Unsupported devices fall back to the cloud automatically.
- XP totals are computed on the client. Firestore rules cap the damage (XP is monotonic, at most +1000 per write, and the ledger is append-only). Since there are no leaderboards, inflating XP only affects your own profile. Server-side validation is future work.
- Explanations are rated by Scribble, so if Scribble is running in the cloud, the explanation text goes to the cloud as the latest input.

## Licence

MIT. See `LICENSE`.
