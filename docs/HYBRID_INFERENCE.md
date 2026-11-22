# Hybrid inference: implementation notes

These notes were checked against the installed Firebase JS SDK **13.4.0** (`@firebase/ai` type definitions), not against the docs alone.

| Item | What the SDK actually exposes | Where it is used |
|---|---|---|
| Modes | `InferenceMode.PREFER_ON_DEVICE \| ONLY_ON_DEVICE \| ONLY_IN_CLOUD \| PREFER_IN_CLOUD`. The values are lowercase strings (`"prefer_on_device"` …) | `src/lib/ai/models.ts` |
| Reported source | `response.inferenceSource` is typed as `InferenceSource`, which is exported, with values `"on_device"` / `"in_cloud"`. **They are lowercase, not `"ON_DEVICE"`.** The app compares against the exported constant | `src/lib/ai/inference.ts` |
| Cloud params | `inCloudParams: ModelParams` requires `model` and accepts `systemInstruction`. The blueprint's §9.6 contingency was not needed | `models.ts` |
| Default cloud model | `gemini-3.5-flash-lite`, the only model string in the SDK bundle | `DEFAULT_CLOUD_MODEL` |
| On-device structured output | `onDeviceParams.promptOptions.responseConstraint: object`. A plain JSON Schema is passed | `tutorResponseJsonSchema` in `schemas.ts` |
| On-device system prompt | `onDeviceParams.createOptions.initialPrompts: [{ role: 'system', content: [{ type: 'text', value }] }]` | `models.ts` |
| Device download | `initializeDeviceModel(onDownloadProgress?: (progressValue: number /* 0..1 */) => void)`. Must be called from a user gesture | `src/lib/ai/deviceModel.ts` |

## Routing

```
student event → verifier (deterministic) → buildPacket → force-cloud?
   ├─ yes → tutorCloudModel (ONLY_IN_CLOUD)
   └─ no  → tutorModel (PREFER_ON_DEVICE) → SDK picks Nano if ready, else cloud
→ JSON.parse (repair) → zod → guards → render with the SDK-reported source
→ on failure: one retry with the rejection reason → authored fallback, labelled SCRIPTED
```

- Timeouts: 8 s for the device path and 15 s for forced cloud. A network error gets one retry after 1.5 s. App Check errors are not retried and show a diagnostic.
- Each `runTutor` call increments a request id. A reply that arrives after a newer request has started is discarded.
- Each problem allows at most 30 Scribble calls. After that, Scribble uses authored hints only.

## Deliberate deviations from the blueprint

- **Line feedback never shows the original solution.** The blueprint's example "Solution changed: was x = 6, now x = 2" would reveal the answer, so the UI and the facts sent to Scribble only say what the *wrong* line implies.
- **Local mode.** Without `.env.local` the app still runs. Data goes to `localStorage` and Scribble shows authored lines labelled *Offline script*. No AI response is ever mocked.
- **Opening questions, explain prompts and the H4 worked example are authored.** They are shown with a `Written note` chip, not as AI. Hints H1–H3 are rephrased by Scribble from authored text.
