# SmogShift

SmogShift is an account-free **Challenge 6 · Urban Air Quality Assistant** for adult caregivers planning school pickup, errands, exercise, and household routines during winter smog in Delhi-NCR.

## Try it

Requires Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The initial screen uses an explicitly labeled fictional smog day so a reviewer can try the flow without credentials.

1. Review the example routine or add and edit activities. Use **Compare plans** to confirm edits.
2. Change **Carpool is possible** and check that the pickup time stays fixed while the conditional trip saving changes.
3. Select a city and choose **Regional forecast** for tomorrow in India Standard Time. If the provider is unavailable, the app offers the sample forecast explicitly.
4. To try natural-language extraction, copy `.env.example` to `.env.local`, fill in a Google AI Studio API key, and restart the server. Open **Extract activities with Gemini**, use the fictional or generic sample text, and review the extracted tasks. The editor works without a key.

| Server environment variable | Purpose                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`            | Optional at startup. Enables Gemini routine extraction. Keep it in `.env.local` or the deployment environment. |
| `GEMINI_MODEL`              | Defaults to `gemini-4-hydrogen`. Any override must support structured output on the Interactions API.          |

## How it works

- `src/app/api/forecast/route.ts` serves one of three allowlisted regional forecasts. `src/server/open-meteo.ts` normalizes the upstream response, caches it per city for 15 minutes, and deduplicates simultaneous requests.
- `src/app/api/routine/route.ts` handles extraction. The Gemini call is in `src/server/gemini.ts` via the **Gemini Interactions REST API**, pinned to the documented API revision. The response is limited to validated task fields, including activity type, start, duration, flexibility, and travel mode. The app requests structured JSON and asks the user to confirm ambiguous details.
- `src/domain/planner.ts` recalculates suggestions locally from confirmed tasks, the forecast, and household constraints. It preserves fixed commitments, checks every hour an activity spans, filters out overlapping options, and searches same-day alternatives within four hours of the original start. The UI comparison comes from the resulting decisions and calculations.
- `src/components/` contains the regional outlook, routine editor, and plan comparison. The hourly table gives keyboard and screen-reader users the values shown in the chart.

## Assumptions and limits

- Phase 1 covers a single schedule and tomorrow’s regional forecast for Delhi, Noida, or Gurugram. Open-Meteo uses the CAMS global grid at roughly 45 km coverage. The card displays forecast values on the **US AQI scale** and links to the official Delhi bulletin for local context. Missing or misaligned readings appear as unavailable.
- The planner uses conservative thresholds for offering activity changes, US AQI 151 for general households and 101 when the sensitivity option is selected. These are app rules informed by the health bands. The app can suggest indoor exercise or postponement when a flexible activity has no acceptable alternative. Household sensitivities stay in the local planner.
- Fewer outdoor minutes are scheduled minutes moved indoors or deferred for the plan day. They are neither a measured dose nor an estimate of indoor air. At most one conditional round trip is counted and only if a shared pickup replaces another drive. Damp mopping and skipping incense address an indoor source without claiming a concentration reduction.
- Gemini receives the optional routine text only. Use generic activities and avoid personal information under Google’s free-tier terms. Requests are bounded, checked for cross-site browser traffic, and rate-limited to five upstream calls per minute per server process. The short bounded cache holds only a digest and structured activity fields. Quota and throttling are local to a process, so multi-instance hosting would require platform-level controls for a shared limit.
- Open-Meteo’s open-access API is used for this non-commercial prototype. [Open-Meteo / CAMS data and attribution](https://open-meteo.com/en/docs/air-quality-api) · [US AQI health bands](https://www.airnow.gov/aqi/aqi-basics/) · [Particle pollution activity guidance](https://document.airnow.gov/air-quality-guide-for-particle-pollution.pdf) · [India NCDC indoor and outdoor guidance](https://ncdc.mohfw.gov.in/uploads/pdf/air7.pdf) · [IITM Delhi bulletin](https://ews.tropmet.res.in/) · [Gemini free-tier terms](https://aistudio.google.com/docs/terms#data-use-unpaid)

## Verify

```sh
npm run lint
npm run typecheck
npm run format:check
npm test
npx playwright install chromium
npm run build
npm run test:e2e
```

The unit suite covers AQI band boundaries, severe and incomplete air data, fixed times, overlapping alternatives, travel constraints, API validation, provider timeouts, caching, and AI rate limiting. Playwright tests cover the full comparison with mocked providers, the no-key fallback through the real route, keyboard navigation, mobile layout, and automated accessibility checks. These checks do not require external API keys.
