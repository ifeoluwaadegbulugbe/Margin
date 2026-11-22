# Devpost submission: #BuildHybridAI 2026

Copy each block into the matching field. Fields marked **(you)** need your own answer.

---

## Project details (public page)

### Project name
```
Margin: a Socratic maths notebook with hybrid AI
```

### Elevator pitch
```
A maths notebook that never hands you the answer. Scribble tutors privately on-device with Gemini Nano; a cloud Learning Guide spots your habits and teaches Scribble what to watch for.
```

### About the project
```markdown
## Inspiration

AI made homework answers instant. It didn't make understanding instant. Students paste a question into a chatbot, copy the worked solution, and then freeze in the test where there's no AI. The fix isn't a smarter answer machine. It's a tutor that asks the one right question and never gives the answer away, available at 9 pm when no teacher is.

Two facts made hybrid AI the right shape for this:
- **Tutoring is dozens of tiny exchanges per problem.** They should be private, because a student's half-formed wrong attempts are their most sensitive learning data, and they shouldn't need a server for every keystroke-sized turn.
- **Knowing how a student learns over weeks needs a bigger mind** that can look across sessions and plan.

So Margin gives each environment a *different job*, and connects them in a loop.

## What it does

Margin is an interactive learning notebook for algebra (40 hand-written problems across five topics, from negative numbers to brackets and variables on both sides).

- **Scribble, the on-device tutor.** The student writes their working one line at a time. Scribble (Gemini Nano in Chrome, through Firebase AI Logic `PREFER_ON_DEVICE`) replies with one Socratic question per turn. Ask it for the answer and it asks a smaller question instead. Hints appear on the page as notes and cost a little XP.
- **A deterministic maths checker judges every line, never the AI.** mathjs plus a linear solver decides whether each line keeps the equation balanced, and matches wrong values to known misconceptions (for example, moving a term across = without changing its sign). Scribble is told the facts and a plain verdict; it only supplies the language.
- **The Learning Guide, in the cloud.** After each chapter, Gemini (`ONLY_IN_CLOUD`) analyses compact learning records: problem IDs, counts, hint levels, mistake types, never what the student typed. It finds recurring habits with evidence counts and plans the next challenges. Its output is validated against real data: inflated evidence is clamped and invented problem IDs are replaced.
- **The loop.** The Learning Guide's watch phrase ("watch the sign") becomes the `WATCH:` line in every following Scribble prompt, so the private on-device tutor gets smarter about *this* student.
- **A game that rewards thinking, not clicking.** XP comes only from balanced lines, fixing your own mistakes, explanations and transfer challenges. There are levels, sticker achievements, streaks and mastery stamps, all decided by plain code.

Every Scribble reply shows its real source (On-device / Cloud), taken from `response.inferenceSource`, and an AI engine panel logs every call with mode, reported source, latency and validation result.

## How we built it

- **Firebase AI Logic hybrid inference** (`firebase/ai`, JS SDK 13.4):
  - `getGenerativeModel` with `InferenceMode.PREFER_ON_DEVICE` for Scribble, `ONLY_IN_CLOUD` for the forced-cloud demo toggle and for the Learning Guide.
  - `initializeDeviceModel()` from a user gesture to download and wake Gemini Nano, plus a background warm-up that measures its speed.
  - Structured output both ways: `onDeviceParams.promptOptions.responseConstraint` (JSON Schema) on device, `responseSchema` with `application/json` in the cloud, then zod validation in the app.
  - `onDeviceParams.createOptions.initialPrompts` and `inCloudParams.systemInstruction` for the same tutor persona in both places; `thinkingLevel: LOW` for the strategist.
  - The UI and log compare `response.inferenceSource` against the SDK's exported `InferenceSource` constant.
- **Firebase App Check** (reCAPTCHA Enterprise in production, a fixed debug token in local development only), **Authentication** (anonymous guests plus Google), **Cloud Firestore** (owner-only security rules and an append-only XP ledger) and **Firebase Hosting**.
- Next.js (static export), TypeScript, Tailwind CSS, Zustand, zod, mathjs, KaTeX and Motion. 434 Vitest tests cover the maths checker, every content problem re-solved, the stage machine, XP, mastery, the AI guards and the strategist validation.
- Built with Claude Code as the AI coding assistant.

## Challenges we ran into

- **Real on-device speed varies a lot.** On our laptop Gemini Nano took about 28–64 s per tutor reply. So Margin measures it: when on-device is slow it routes live turns to the cloud and labels them `ONLY_IN_CLOUD (device slow)`, with an "Always on-device" switch for privacy-first use. If an on-device reply is too slow or fails a check, it gets one "cloud rescue" before falling back to a written note, which is labelled as such and never as AI.
- **A small model contradicting the facts.** In testing, Nano sometimes praised a line the checker had marked wrong. We added a plain `VERDICT:` line to the prompt and a guard that rejects any reply praising a wrong line (or criticising a correct one), alongside answer-leak, one-question and tone guards. The video shows a raw, unguarded test-page reply on purpose, labelled as such.
- **Single-turn on device.** Hybrid inference on device is single-turn, so every call carries a compact state packet: stage, next objective, checker facts, verdict, watch-list, and the strings the tutor must never say.
- **A busy cloud model.** The newest Flash model kept returning "high demand", so the Learning Guide now falls back to `gemini-3.5-flash-lite` and logs which model answered.

## What we learned

Hybrid works best when the two sides do different jobs rather than the same job in two places. Labelling the real source of every answer builds trust, and small models need hard facts and hard guards, not just better prompts.

## What's next

Android with Gemini Nano through the same Firebase AI Logic hybrid SDK, more subjects (the content format and the maths-checker interface are subject-agnostic), Remote Config for the routing thresholds, and teacher and parent progress views.
```

### Built with
```
firebase-ai-logic, gemini-nano, gemini, firebase, cloud-firestore, firebase-authentication, firebase-app-check, recaptcha-enterprise, firebase-hosting, chrome, prompt-api, next.js, react, typescript, tailwindcss, zustand, zod, mathjs, katex, motion, vitest, remotion, claude-code
```

### "Try it out" links
```
https://lodestar-f3359.web.app
https://github.com/ifeoluwaadegbulugbe/Margin
```

### Image gallery
Upload from `demo-video/out/gallery/` (3:2, all under 0.2 MB). Suggested order: 03, 04, 05, 02, 07, 08, 12, 06, 09, 10, 11, 13, 01. Use `00-thumbnail.jpg` for the thumbnail.

### Demo video URL
```
(your YouTube link: public or unlisted, 2:30)
```

---

## Additional info (for judges)

| Field | Answer |
|---|---|
| Submitter type | **(you)** Individual |
| Country of residence | **(you)** |
| Organization name | leave blank (unless entering for one) |
| Start date (MM-DD-YY) | `11-20-26` |
| New or existing | **New.** This project did not exist before Nov 11, 2026 |
| Platform(s) | **Web (Chrome)** |
| Open-source license URL | `https://github.com/ifeoluwaadegbulugbe/Margin/blob/main/LICENSE` |
| Working demo URL | `https://lodestar-f3359.web.app` |

### Explain how your project meets the main technology requirement
```
Margin is a Web (Chrome) app whose AI runs entirely on Firebase AI Logic hybrid inference.

- On-device: Scribble, the Socratic tutor, uses getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE, onDeviceParams, inCloudParams }) with Gemini Nano in Chrome. initializeDeviceModel() is called from a user gesture, and on-device structured output uses promptOptions.responseConstraint (JSON Schema).
- Cloud: the same tutor falls back to Gemini automatically, and the Learning Guide runs with InferenceMode.ONLY_IN_CLOUD (gemini-3.5-flash-lite) to analyse sessions and personalise the on-device tutor's next prompts.
- Every reply's real source is read from response.inferenceSource and shown in the UI and an AI engine log.
- Firebase App Check (reCAPTCHA Enterprise) protects AI Logic and Firestore. Firebase Authentication (anonymous + Google), Cloud Firestore and Firebase Hosting are also used.

Code: src/lib/ai/models.ts (model setup), src/lib/ai/inference.ts (routing, inferenceSource, timeouts, cloud rescue), src/lib/ai/tutor.ts (prompt, validation, fallback), src/lib/ai/deviceModel.ts (initializeDeviceModel).
```

### Testing instructions
```
No account or password needed.

1. Open https://lodestar-f3359.web.app and click "Start learning" (a guest account is created).
2. Do the short onboarding and the warm-up, or skip the warm-up.
3. On Home, click "Open your notebook", or use Explore > a topic > "Practise this topic".
4. In the challenge, type working lines such as 2x + 6 = 14 and then 2x = 20 (a sign mistake). Try "just tell me the answer" in Scribble's box, reveal a hint, then finish the problem.
5. Open the profile menu (top right) > "Settings & AI engine" to see the device status, the measured on-device speed, the live AI log (mode, reported source, latency, validation), the "What Scribble knows about you" watch-list, and the Force cloud / Always on-device switches.

To see on-device inference (Gemini Nano):
- Use desktop Chrome 139+ and enable chrome://flags/#prompt-api-for-gemini-nano-multimodal-input, then relaunch.
- Open https://lodestar-f3359.web.app/dev/spike/, click "Wake Scribble", then "Run (prefer device)": the result shows inferenceSource: on_device. "Run (cloud only)" shows in_cloud.
- Note: Gemini Nano speed depends on the hardware (about 30-60 s per reply on our laptop). In auto mode, the app routes live tutor turns to the cloud when on-device is slow and labels them; switch on "Always on-device" in Settings to keep Scribble on the device.

Without Gemini Nano, everything still works via automatic cloud fallback.
```

### Disclosures (include in the description or testing notes if asked)
- Built during the submission period (started Nov 20, 2026) with Claude Code as an AI coding assistant, plus the open-source libraries listed in package.json.
- The demo video's capture and rendering scripts (`demo-video/`) follow the approach of my own earlier PriceDrop demo video tooling. They are not part of the app.
