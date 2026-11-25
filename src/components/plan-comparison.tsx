import {
  ArrowDown,
  ArrowRight,
  CalendarCheck,
  CarFront,
  House,
  LockKeyhole,
  Wind,
} from "lucide-react";
import type { buildPlan } from "../domain/planner";
import { isFixed } from "../domain/routine";
import type { Messages } from "../i18n/messages";
import { decisionCopy } from "./decision-copy";

type Props = {
  plan: ReturnType<typeof buildPlan> | null;
  forecastStatus: "sample" | "loading" | "ready" | "unavailable";
  text: Messages;
};

export function PlanComparison({ plan, forecastStatus, text }: Props) {
  const forecastDescriptions = {
    sample: text.comparisonSample,
    loading: text.comparisonLoading,
    ready: text.comparisonReady,
    unavailable: text.comparisonUnavailable,
  };
  const status = plan?.impact;
  const changes = plan?.decisions.filter(
    ({ kind, reason }) => kind !== "kept" || reason.code === "lockedHigh",
  );

  return (
    <section className="card comparison" aria-labelledby="comparison-heading">
      <div className="card-heading">
        <span className="section-icon">
          <CalendarCheck size={20} aria-hidden />
        </span>
        <div>
          <h2 id="comparison-heading">{text.comparison}</h2>
          <p>{forecastDescriptions[forecastStatus]}</p>
        </div>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {status && (
          <>
            {text.planStatus(
              status.outdoorMinutesAvoided,
              status.conditionalRoundTrips,
              status.sourcesRemoved,
            )}{" "}
            {changes
              ?.map(
                (change) =>
                  `${decisionCopy(change, text).title}${change.time ? ` ${change.time}` : ""}`,
              )
              .join(". ")}
          </>
        )}
      </p>
      {plan ? (
        <>
          <dl className="impact">
            <div>
              <dt>
                <Wind size={17} aria-hidden /> {text.fewerMinutes}
              </dt>
              <dd>{plan.impact.outdoorMinutesAvoided}</dd>
            </div>
            <div>
              <dt>
                <CarFront size={17} aria-hidden /> {text.sharedTrips}
              </dt>
              <dd>{plan.impact.conditionalRoundTrips}</dd>
            </div>
            <div>
              <dt>
                <House size={17} aria-hidden /> {text.indoorSources}
              </dt>
              <dd>{plan.impact.sourcesRemoved}</dd>
            </div>
          </dl>
          <p className="column-labels" aria-hidden="true">
            <span>{text.original}</span>
            <span>{text.suggested}</span>
          </p>
          <ol className="decisions">
            {plan.decisions.map((decision) => {
              const copy = decisionCopy(decision, text);
              return (
                <li className="decision" key={decision.original.id}>
                  <div className="decision-top">
                    <div className="decision-before">
                      <span className="sr-only">{text.originalActivity}</span>
                      <time dateTime={decision.original.time}>
                        {decision.original.time}
                      </time>
                      <strong>{text.activities[decision.original.kind]}</strong>
                      <span>
                        {decision.original.duration} {text.minuteUnit}{" "}
                        {isFixed(decision.original) && (
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
                    <ArrowDown
                      className="decision-arrow vertical"
                      size={16}
                      aria-hidden
                    />
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
                </li>
              );
            })}
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
