# Architecture

Margin is a static Next.js app (App Router, `output: 'export'`) served from Firebase Hosting. Everything runs in the browser: the maths engine, the game logic, and all calls to Firebase (Auth, Firestore, App Check, AI Logic). There is no custom server.

```
Browser (Chrome)
├── UI (React, Zustand stores)
├── Learning engine (pure TypeScript)        src/lib/learning
│   ├── linear.ts / verify.ts   maths checker: judges every line and final answer
│   ├── reducer.ts              stage machine (ORIENT → … → COMPLETE)
│   └── recommender.ts          rules-based next challenge (fallback for the Guide)
├── Game engine (pure TypeScript)            src/lib/game
│   └── xp, levels, mastery, streak, achievements, complete.ts (one batched write)
├── AI layer                                 src/lib/ai
│   ├── models.ts      the only place models are configured
│   ├── inference.ts   routing, timeouts, SDK-reported source, cloud rescue, warm-up
│   ├── packet.ts      single-turn state packet (with VERDICT line) for Scribble
│   ├── guards.ts      zod + leak / question / tone / verdict checks
│   ├── tutor.ts       packet → infer → validate → (rescue) → authored fallback
│   └── strategist.ts  Learning Guide records, validation against the catalogue
└── Data layer                               src/lib/data
    ├── firestore.ts   users/{uid}/… (sessions, mastery, misconceptions, insights, xpLedger, achievements)
    └── local.ts       localStorage fallback ("local mode" without Firebase config)

Firebase
├── AI Logic (Gemini Developer API)   cloud Gemini for Scribble's fallback and the Learning Guide
├── Gemini Nano in Chrome             on-device Scribble via PREFER_ON_DEVICE
├── Authentication                    anonymous guests, Google, guest → Google linking
├── Cloud Firestore                   owner-only rules, append-only XP ledger
├── App Check                         reCAPTCHA Enterprise in production, debug token in dev
└── Hosting                           static files from out/
```

## One tutor turn

1. The student writes a line. `verify.ts` decides whether it keeps the solution (balanced), changes it (wrong), or makes no progress. It also matches wrong values to known misconceptions.
2. `reducer.ts` updates the stage from that fact. The model can only advance the stages that have no deterministic evidence (understand, plan, explain).
3. `packet.ts` builds a compact prompt: problem, stage, next objective, checker facts, a plain VERDICT, the watch-list from the Learning Guide, and the strings it must not say.
4. `inference.ts` picks the route: on-device first, the cloud when forced or when the device is measured slow, and a cloud rescue after a slow or failed on-device reply.
5. `guards.ts` validates the reply. A failed reply is retried once (in the cloud), then replaced by an authored line from the content bank.
6. The UI shows the reply with the SDK-reported source. Ticks and crosses on the page always come from the checker, never from the model.

## After a challenge set

`complete.ts` computes XP, mastery, streak and achievements, then writes them in a single Firestore batch. The Learning Guide then runs in the background: it receives counts and IDs only, and its output is validated against the real data. Inflated evidence counts are clamped, and unknown or locked problem IDs are replaced. The result is stored as an insight and becomes Scribble's watch-list.

## Security

- Firestore rules: users can read and write only their own documents. XP never decreases and grows by at most 1000 per write. The XP ledger and achievements are append-only.
- App Check is enforced by Firebase AI Logic. The development debug token comes from `.env.local`, which is git-ignored, and is compiled out of production builds.
- Firebase web configuration values are public identifiers. There are no server secrets.
