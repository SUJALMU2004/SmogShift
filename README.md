# SmogShift

SmogShift is an account-free **Challenge 6 · Urban Air Quality Assistant** for adult caregivers planning school pickup, errands, exercise, and household routines during winter smog in Delhi-NCR.

## Try it

Use Node.js 24 LTS with npm. The tooling also supports Node.js 22.12+ within the 22.x release line.

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The initial screen uses a labeled fictional forecast and a ready-to-try schedule.

### 60-second demo

1. Use **Jump to plan** to see the 7 AM walk move to 10 AM, where the fictional forecast peak is 120 instead of 210 US AQI.
2. In the walk’s **Activity options**, set **Air sensitivity for this activity** to **Sensitive**. With indoor exercise available, the comparison shows 30 fewer planned outdoor minutes. School pickup stays at 3 PM.
3. On the carpool suggestion, open **Share pickup proposal**. Preview the labeled demo message. **Open WhatsApp** prefills it and leaves recipient selection and sending to WhatsApp. **Copy message** is available from the same panel.
4. Turn off **Carpool is possible**. The proposal disappears and the conditional trip saving drops to zero. Switch the display to **हिन्दी** to see the same workflow in Hindi.

Choose **Regional forecast** to use tomorrow’s actual regional forecast in India Standard Time. If it is unavailable, the app offers the fictional sample. For live routine extraction, copy `.env.example` to `.env.local`, set a Google AI Studio key, and restart the server. Open **Extract activities with Gemini**, enter a generic routine in English, Hindi, or Hinglish, and review the tasks. The manual editor and sharing work without credentials.

| Server environment variable | Purpose                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`            | Optional at startup. Enables Gemini routine extraction. Set it in `.env.local` or the deployment environment. |
| `GEMINI_MODEL`              | Defaults to `gemini-3.5-flash-lite`. An override must support structured output on the Interactions API.      |

## Architecture

- `src/app/api/forecast/route.ts` serves one of three allowlisted regional forecasts. `src/server/open-meteo.ts` normalizes the upstream response, caches by city for up to 15 minutes, and deduplicates simultaneous requests. The client cancels stale requests when the city changes and refreshes the regional forecast at midnight IST.
- `src/app/api/routine/route.ts` handles extraction. The only Gemini call is in `src/server/gemini.ts` via the **Gemini Interactions REST API**. Gemini extracts structured tasks and any stated move constraints. The output schema and the app validate activity types, times, durations, required status, and allowed move windows. Missing or ambiguous start times and durations need confirmation.
- `src/domain/routine.ts` validates a single baseline schedule. `src/domain/planner.ts` builds a comparison from confirmed activities, the forecast, and local constraints. The decision contains a typed reason and the values used to explain it. The UI renders bilingual explanations from `src/i18n/messages.ts`.
- `src/components/` separates the editor, individual activity controls, forecast, comparison, and request hooks. Activity options and household changes replan locally after confirmation. The chart has an equivalent hourly table, and plan updates are announced to screen readers.
- `src/domain/share.ts` formats an invitation from the latest eligible carpool decision and forecast date. `src/components/share-proposal.tsx` previews it and opens WhatsApp’s documented prefilled link. Both actions are client-side. If automatic copy fails, the preview is selected for manual copying. [WhatsApp Click to Chat](https://faq.whatsapp.com/5913398998672934)

## Planning rules and assumptions

- The app plans one schedule for tomorrow. Overlapping baseline activities need review. A fixed time stays fixed. A required activity stays in the plan and can move if its time is flexible. If no eligible slot exists, the app offers an available indoor exercise option, defers an optional flexible activity, or keeps a required activity visible for review.
- The app checks every hourly value in a block. It uses US AQI planning cutoffs of 151 for the general setting and 101 for the sensitive setting. These cutoffs determine when to suggest a change. With full forecast coverage, candidates must stay below the applicable cutoff, fit the supplied window, and avoid overlaps. The planner considers required tasks first and ranks eligible starts by lowest peak forecast AQI, then smallest time change. With both bounds blank, it looks up to four hours from the original start during 06:00–21:00. If a user enters only one bound, the other defaults to the start or end of the forecast day.
- The Open-Meteo feed uses the CAMS global model, at approximately 45 km spatial and three-hour native temporal resolution, with hourly values exposed by the API. These are regional estimates on the **US AQI scale**. The app also shows PM₂.₅, PM₁₀, NO₂, and O₃ when present and links to the official Delhi bulletin. Missing hours cannot qualify a proposed time.
- Fewer outdoor minutes count planned minutes moved indoors or deferred. Time shifts keep the original duration and show the change in forecast AQI. Neither metric measures a person’s exposure or indoor air quality. Carpool savings are conditional on replacing a separate drive. Damp mopping and skipping incense address indoor sources without estimating a pollutant reduction.
- A share preview contains only the generic pickup proposal, fixed pickup time, and the forecast date when available. If there is no dated forecast, the proposal asks the recipient to confirm the date. The demo uses a fictional label. Copying or opening WhatsApp leaves trip savings conditional.
- Gemini receives only the routine text you choose to submit. Enter generic activities and omit personal information under Google’s free-tier terms. The endpoint has an input cap, same-origin browser checks, strict output validation, and no model tool access. It shares identical requests already in progress and caches a digest and structured activities for five minutes after success. Each upstream attempt, including the single retry on a temporary HTTP 503, counts toward the limit of five per minute per server process. Multi-instance hosting would need a shared limit.

[Open-Meteo / CAMS forecast and attribution](https://open-meteo.com/en/docs/air-quality-api) · [US AQI bands](https://www.airnow.gov/aqi/aqi-basics/) · [AirNow activity guidance](https://document.airnow.gov/air-quality-guide-for-particle-pollution.pdf) · [India NCDC air pollution guidance](https://ncdc.mohfw.gov.in/uploads/pdf/air7.pdf) · [IITM Delhi bulletin](https://ews.tropmet.res.in/) · [Google free-tier terms](https://aistudio.google.com/docs/terms#data-use-unpaid)

## Verify

```sh
npm ci
npx playwright install chromium
npm run verify
```

`npm run verify` runs lint, type checking, formatting, Vitest, the production build, and Playwright without API keys. Vitest covers scheduling, AQI edge cases, malformed inputs, caching, timeouts, throttling, and the fields included in a share message. Thirty fictional routines (ten per language) test the extraction contract and whether the expected task drafts require confirmation with a mocked provider. Playwright covers the forecast-to-plan flow, Hindi review, request cancellation, the missing-key fallback, keyboard navigation, mobile accessibility, and share previews, including copy denial and the midnight IST rollover. The WhatsApp destination is intercepted during automated tests.

Use `npm run test:gemini` with `GEMINI_API_KEY` available in the environment or `.env.local` to run one live extraction smoke case each for English, Hindi, and Hinglish. That test is separate from the offline suite.

For a real-device check, open the sample proposal in WhatsApp or WhatsApp Web and send it to yourself. A phone needs a reachable HTTPS preview to open the app running on another device.
