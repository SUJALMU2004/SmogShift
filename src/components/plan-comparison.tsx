import {
  ArrowDown,
  ArrowRight,
  CalendarCheck,
  CarFront,
  House,
  LockKeyhole,
  Wind,
} from "lucide-react";
import type { Forecast } from "../domain/air";
import type { buildPlan, Decision } from "../domain/planner";
import { isFixed } from "../domain/routine";
import { buildPickupProposal } from "../domain/share";
import { messages, type Locale, type Messages } from "../i18n/messages";
import { decisionCopy } from "./decision-copy";
import { ShareProposal } from "./share-proposal";
import type { ForecastView } from "./use-regional-forecast";

type Plan = ReturnType<typeof buildPlan>;
type Props = {
  plan: Plan | null;
  forecastStatus: ForecastView["status"];
  forecast: Pick<Forecast, "source" | "date"> | null;
  locale: Locale;
};

function announcePlan(plan: Plan | null, text: Messages): string {
  if (!plan) return "";
  const { outdoorMinutesAvoided, conditionalRoundTrips, sourcesRemoved } =
    plan.impact;
  const summary = text.planStatus(
    outdoorMinutesAvoided,
    conditionalRoundTrips,
    sourcesRemoved,
  );
  const changes = plan.decisions
    .filter(
      ({ kind, reason }) => kind !== "kept" || reason.code === "lockedHigh",
    )
    .map((decision) => {
      const { title } = decisionCopy(decision, text);
      return decision.time ? `${title} ${decision.time}` : title;
    });
  return [summary, ...changes].join(" ");
}

function ImpactSummary({
  impact,
  text,
}: {
  impact: Plan["impact"];
  text: Messages;
}) {
  return (
    <dl className="impact">
      <div>
        <dt>
          <Wind size={17} aria-hidden /> {text.fewerMinutes}
        </dt>
        <dd>{impact.outdoorMinutesAvoided}</dd>
      </div>
      <div>
        <dt>
          <CarFront size={17} aria-hidden /> {text.sharedTrips}
        </dt>
        <dd>{impact.conditionalRoundTrips}</dd>
      </div>
      <div>
        <dt>
          <House size={17} aria-hidden /> {text.indoorSources}
        </dt>
        <dd>{impact.sourcesRemoved}</dd>
      </div>
    </dl>
  );
}

function DecisionCard({
  decision,
  forecast,
  locale,
}: {
  decision: Decision;
  forecast: Props["forecast"];
  locale: Locale;
}) {
  const text = messages[locale];
  const copy = decisionCopy(decision, text);
  const proposal = buildPickupProposal(decision, forecast, locale);
  const { original } = decision;

  return (
    <li className="decision">
      <div className="decision-top">
        <div className="decision-before">
          <span className="sr-only">{text.originalActivity}</span>
          <time dateTime={original.time}>{original.time}</time>
          <strong>{text.activities[original.kind]}</strong>
          <span>
            {original.duration} {text.minuteUnit}{" "}
            {isFixed(original) && (
              <LockKeyhole
                size={12}
                role="img"
                aria-label={text.fixedIndicator}
              />
            )}
          </span>
        </div>
        <ArrowRight
          className="decision-arrow horizontal"
          size={16}
          aria-hidden
        />
        <ArrowDown className="decision-arrow vertical" size={16} aria-hidden />
        <div className="decision-after">
          <span className="sr-only">{text.suggestedActivity}</span>
          <span className={`decision-tag ${decision.kind}`}>
            {copy.tag}
            {decision.time ? ` · ${decision.time}` : ""}
          </span>
          <strong>{copy.title}</strong>
        </div>
      </div>
      <p>{copy.reason}</p>
      {proposal && (
        <ShareProposal
          key={proposal.message}
          proposal={proposal}
          text={text.share}
        />
      )}
    </li>
  );
}

export function PlanComparison({
  plan,
  forecastStatus,
  forecast,
  locale,
}: Props) {
  const text = messages[locale];
  const forecastDescriptions = {
    sample: text.comparisonSample,
    loading: text.comparisonLoading,
    ready: text.comparisonReady,
    unavailable: text.comparisonUnavailable,
  };

  return (
    <section className="card comparison" aria-labelledby="comparison-heading">
      <div className="card-heading">
        <span className="section-icon">
          <CalendarCheck size={20} aria-hidden />
        </span>
        <div>
          <h2 id="comparison-heading" tabIndex={-1}>
            {text.comparison}
          </h2>
          <p>{forecastDescriptions[forecastStatus]}</p>
        </div>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcePlan(plan, text)}
      </p>
      {plan ? (
        <>
          <ImpactSummary impact={plan.impact} text={text} />
          <p className="column-labels" aria-hidden="true">
            <span>{text.original}</span>
            <span>{text.suggested}</span>
          </p>
          <ol className="decisions">
            {plan.decisions.map((decision) => (
              <DecisionCard
                key={decision.original.id}
                decision={decision}
                forecast={forecast}
                locale={locale}
              />
            ))}
          </ol>
          <p className="subtle metric-note">{text.metricNote}</p>
        </>
      ) : (
        <div className="empty-plan">
          <CalendarCheck size={28} aria-hidden />
          <p>
            {forecastStatus === "loading"
              ? text.waitComparison
              : text.emptyComparison}
          </p>
        </div>
      )}
    </section>
  );
}
