# SmogShift

**An air-quality planner for families in Delhi-NCR**

[![Verify](https://github.com/SUJALMU2004/SmogShift/actions/workflows/verify.yml/badge.svg?branch=main)](https://github.com/SUJALMU2004/SmogShift/actions/workflows/verify.yml)

SmogShift helps adult caregivers plan tomorrow’s school pickups, errands, exercise, and household activities during winter smog. It combines an hourly regional forecast with an editable family schedule and explains the effect of each suggested change.

**PromptWars Challenge 6 · Urban Air Quality Assistant**

**Stack** · Next.js App Router, React, TypeScript, Zod, Vitest, and Playwright

## Run locally

Use **Node.js 24 LTS** and npm. The package also supports Node.js 22.12+ on the 22.x release line.

```sh
git clone https://github.com/SUJALMU2004/SmogShift.git
cd SmogShift
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The fictional sample and manual schedule work without credentials. Select **Regional forecast** for tomorrow’s Open-Meteo forecast in Delhi, Noida, or Gurugram.

### 60-second demo

1. Open **Jump to plan**. The fictional forecast peaks at **210 US AQI** during the 07:00 walk and at **120** in the suggested 10:00 slot.
2. Open the walk’s **Activity options** and set **Air sensitivity for this activity** to **Sensitive**. With an indoor option available, the comparison shows **30 fewer planned outdoor minutes** and preserves the fixed 15:00 pickup.
3. Open **Share pickup proposal**. The fictional invitation can be copied or prefilled in WhatsApp. WhatsApp handles recipient selection and sending.
4. Clear **Carpool is possible**. The proposal disappears and the conditional trip saving becomes zero. Switch to **हिन्दी** to try the same flow in Hindi.

## Configure Gemini

Copy [`.env.example`](.env.example) to `.env.local`, add your Google AI Studio key, and restart the server. Open **Extract activities with Gemini** and enter a generic routine in English, Hindi, or Hinglish.

| Server variable  | Purpose                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY` | Optional. Enables routine extraction.                                                                           |
| `GEMINI_MODEL`   | Defaults to `gemini-3.5-flash-lite`. An override must support structured output on the Gemini Interactions API. |

Gemini extracts activity types, times, durations, pickup travel modes, and any stated scheduling constraints. Users review those fields before comparing plans. Missing or ambiguous times and durations stay pending until the user completes them. [Gemini structured output](https://aistudio.google.com/docs/structured-output)

## Planning rules

| Decision               | Rule                                                                                                                                                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reschedule             | Check every forecast hour the activity touches. Select the eligible window with the lowest peak US AQI, then the smallest time shift, then the earlier start. Candidates must fit the move window and avoid other activities.                                   |
| Respect commitments    | Fixed pickups keep their entered time. Required tasks get priority for alternative slots. An outdoor exercise can move indoors when available. An optional flexible activity can be deferred. A required activity with no alternative stays visible for review. |
| Address indoor sources | Suggest damp mopping to reduce dust stirred by sweeping, and skipping optional incense to remove a source of indoor smoke.                                                                                                                                      |
| Offer a shared ride    | A confirmed car pickup can generate a dated carpool proposal when the caregiver enables the option. Count one possible round trip saved if the ride replaces a separate drive.                                                                                  |

The planner uses US AQI cutoffs of **151** for the general setting and **101** for the sensitive setting. These are scheduling rules. By default, the planner looks up to four hours from the original start within **06:00–21:00 IST**. A supplied move bound overrides that default. Missing hours never qualify a proposed time. [AirNow AQI categories](https://www.airnow.gov/aqi/aqi-basics/) · [AirNow activity guidance](https://document.airnow.gov/air-quality-guide-for-particle-pollution.pdf)

The comparison reports peak **forecast** AQI for each window and planned outdoor minutes moved indoors or deferred. Rescheduling preserves the activity’s duration. Trip savings remain conditional. These measures describe the plan and the regional forecast. Personal exposure and indoor concentrations require measurements.

## Architecture

| Layer     | Responsibility                                                                                                            | Entry points                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interface | Localized editor, forecast chart and accessible hourly table, plan comparison, and share preview                          | [Planner](src/components/planner.tsx) · [Routine editor](src/components/routine-editor.tsx) · [Forecast readings](src/components/forecast-readings.tsx)                                         |
| Domain    | Runtime schemas, confirmed baseline validation, pure scheduling rules, impact calculations, and pickup message formatting | [Routine](src/domain/routine.ts) · [Forecast contract](src/domain/air.ts) · [Outdoor windows](src/domain/outdoor-window.ts) · [Planner](src/domain/planner.ts) · [Sharing](src/domain/share.ts) |
| API       | Validate request inputs and return normalized JSON with bounded error responses                                           | [Forecast route](src/app/api/forecast/route.ts) · [Routine route](src/app/api/routine/route.ts)                                                                                                 |
| Services  | Apply request deadlines, cache results, and enforce the Gemini attempt budget                                             | [Forecast service](src/server/forecast-service.ts) · [Routine service](src/server/routine-service.ts) · [Request cache](src/server/request-cache.ts)                                            |
| Providers | Translate provider-specific payloads and validate results                                                                 | [Open-Meteo adapter](src/server/open-meteo.ts) · [Gemini Interactions adapter](src/server/gemini.ts)                                                                                            |

Forecast data moves from Open-Meteo through the forecast route and shared schema before reaching the browser. Optional routine text moves through the routine route and Gemini adapter into editable drafts. The browser combines reviewed activities, the forecast, and household preferences in the deterministic planner. Adjustments and sharing run locally.

### API

| Method and path                | Input                                                   | Success                                                                                                       |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET /api/forecast?city=delhi` | Allowlisted city ID · `delhi`, `noida`, or `gurugram`   | Tomorrow’s calendar date in IST, retrieval timestamp, and ordered hours with US AQI, PM₂.₅, PM₁₀, NO₂, and O₃ |
| `POST /api/routine`            | JSON object with a `routine` string of 3–800 characters | A `tasks` array of at most ten validated drafts                                                               |

Both routes return an `error` string for unsuccessful requests and set `Cache-Control: no-store`. The browser cancels stale forecast requests and refreshes the regional forecast at midnight IST. The forecast cache is keyed by city and date with a 15-minute TTL.

### Privacy and operational limits

- The Gemini key stays on the server. Gemini receives only the routine text the user chooses to submit. Use generic activities and omit personal details. [Google’s free-tier data terms](https://aistudio.google.com/docs/terms#data-use-unpaid)
- Routine extraction accepts a bounded UTF-8 JSON body and checks browser origin. A strict output schema limits Gemini to recognized fields. Identical requests share work in progress. Successful drafts are cached by digest for five minutes.
- The server allows five Gemini attempts per minute per process, including a single retry for a temporary HTTP 503 within its original deadline. Multi-instance operation requires a shared quota. If Gemini is unavailable, the manual editor remains usable.
- A share preview contains a generic proposal, the fixed pickup time, and the forecast date where available. Sample proposals carry a fictional label. [WhatsApp Click to Chat](https://faq.whatsapp.com/5913398998672934)

## Verification

```sh
npm exec -- playwright install chromium
npm run verify
```

The single command runs ESLint, strict TypeScript checks, Prettier, coverage, the production build, and Chromium tests without provider credentials. On Linux runners, use `npm exec -- playwright install --with-deps chromium` to install browser system dependencies. GitHub Actions runs the same checks and an npm security audit on `main`.

| Check                      | Coverage                                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code quality               | ESLint limits function complexity and length and guards the server import boundary. TypeScript checks indexed reads and return paths.              |
| Unit and integration tests | AQI boundaries, schedule conflicts, exact move windows, malformed provider data, cache expiry, retries, quota, and share formatting                |
| Coverage gate              | The domain and server tests require at least 90% lines, statements, and functions, and 85% branches. Reports are generated under `coverage/`.      |
| Browser tests              | Manual and assisted planning, Hindi review, stale-request cancellation, fallback states, keyboard navigation, 320 px layout, and WhatsApp previews |
| Live provider smoke        | With a configured key, `npm run test:gemini` checks one fictional routine each in English, Hindi, and Hinglish.                                    |

## Data sources

The regional forecast uses the CAMS global model through Open-Meteo at approximately **45 km** grid resolution and **three-hour** native resolution. Open-Meteo serves hourly estimates. The app labels the source and US AQI scale and links to the Delhi bulletin for local context. [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) · [CAMS](https://atmosphere.copernicus.eu/) · [IITM Delhi bulletin](https://ews.tropmet.res.in/) · [India NCDC air-pollution guidance](https://ncdc.mohfw.gov.in/uploads/pdf/air7.pdf)
