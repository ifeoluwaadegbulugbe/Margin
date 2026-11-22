# Demo video script (target 2:50)

**Setup before recording**
- Desktop Chrome with the Prompt API flag on. Open `/dev/spike/` once and click **Wake Scribble** so Gemini Nano is loaded.
- Browser window about 1440×900 at 110% zoom. Hide the bookmarks bar and close other tabs.
- Use a fresh guest account that has already finished one or two challenge sets with a deliberate sign mistake (for example writing `3x = 6` from `3x - 6 = 12`), so the Learning Guide has a real note and a watch-list. These are real play sessions; say so in the README if asked.
- In **Settings & AI engine**: switch **Always on-device** ON for the on-device scenes, then OFF again.
- On-device replies on a slow laptop take about 30 s. Record the wait, cut it in editing, and put a small "sped up" or "cut" label on screen whenever you remove time.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:12 | Landing page, then hover "Start learning" | "AI made homework answers instant. It didn't make understanding instant. Margin is a maths notebook that never hands you the answer. It helps you find it." |
| 0:12–0:25 | Home (learning desk): violet "Continue learning" card, *Notes from your learning guide* with "Scribble is watching for…" | "This is the student's desk. A learning guide in the cloud has studied their past sessions, noticed a habit, and planned today's page." |
| 0:25–0:55 | Challenge workspace, `3(x − 2) = 12`. Type `3x - 6 = 12` (tick), then `3x = 6`: it gets circled in coral ("solution changed"). Scribble's note card appears. Show the source chip **On-device** | "Every line is checked by a maths engine, not by the AI. When the student slips, Scribble, running privately on this laptop with Gemini Nano, asks one question instead of correcting them." |
| 0:55–1:15 | Type in Scribble's box: "just tell me the answer". Scribble declines and asks a smaller question. Click **Reveal a hint**: a sticky note appears on the page and the XP multiplier drops | "Ask for the answer and you get a better question. Hints are always there, but they cost a little XP, so thinking pays more." |
| 1:15–1:35 | Fix the line (`3x = 18`, then `x = 6`), type `6` in the answer box, explain the reasoning, and Scribble accepts | "The student fixes their own mistake and explains why it works. That earns more than any hint ever could." |
| 1:35–1:55 | Chapter complete: XP count-up, sticker flies in, mastery stamp or "why?" for the mastery change | "Rewards follow understanding: balanced lines, self-corrections and explanations. Never clicks." |
| 1:55–2:20 | "Note from your learning guide" resolves (Cloud). Open **Progress** → *Notes from your learning guide*: the recurring habit with its evidence count. Open **Settings → What Scribble knows about you** to show the WATCH line | "Then the cloud does what a small on-device model can't: it looks across every session, finds the pattern, and hands Scribble a watch-list for next time." |
| 2:20–2:45 | **Settings & AI engine** log: Scribble rows *On-device*, Guide row *Cloud*. Turn Wi-Fi off, run `/dev/spike/` → **Run (prefer device)** → `on_device`. Turn Wi-Fi on, toggle **Force cloud tutor** → next reply *Cloud* | "This is real hybrid inference with Firebase AI Logic. The tutor runs on the device and falls back to the cloud automatically; the strategist always runs in the cloud. Every label comes from the SDK's reported inference source." |
| 2:45–2:55 | Explore page learning path, then the logo and URL | "Margin. Private help in the moment, long-term wisdom from the cloud. Think it through." |

**Honesty rules for the edit:** don't change any labels, don't fake an on-device result, and label every cut. If your laptop can't run a scene on-device, show the honest `ONLY_IN_CLOUD (device slow)` label and explain the automatic routing. That is a feature too.
