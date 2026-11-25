import {
  ArrowDown,
  ArrowRight,
  CalendarCheck,
  CarFront,
  House,
  LockKeyhole,
  Wind,
} from "lucide-react";
import { activities } from "../domain/routine";
import type { buildPlan, Decision } from "../domain/planner";

const decisionLabel: Record<Decision["kind"], string> = {
  kept: "Keep",
  moved: "Reschedule",
  indoors: "Move indoors",
  deferred: "Defer",
  carpool: "Possible carpool",
  source: "Indoor air",
};

type Props = {
  plan: ReturnType<typeof buildPlan> | null;
  sample: boolean;
  forecastAvailable: boolean;
};

export function PlanComparison({ plan, sample, forecastAvailable }: Props) {
  const { outdoorMinutesAvoided, conditionalRoundTrips, sourcesRemoved } =
    plan?.impact ?? {};
  return (
    <section className="card comparison" aria-labelledby="comparison-heading">
      <div className="card-heading">
        <span className="section-icon">
          <CalendarCheck size={20} aria-hidden />
        </span>
        <div>
          <h2 id="comparison-heading">Plan comparison</h2>
          <p>
            {sample
              ? "Suggestions for the fictional forecast."
              : forecastAvailable
                ? "Suggestions for tomorrow’s regional forecast."
                : "Forecast unavailable. Indoor and trip suggestions still apply."}
          </p>
        </div>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {plan
          ? `Plan updated. ${outdoorMinutesAvoided} fewer planned outdoor minutes, ${conditionalRoundTrips} conditional car round trips avoided, ${sourcesRemoved} indoor smoke or dust sources addressed.`
          : "Confirm your routine to see a plan."}
      </p>
      {plan ? (
        <>
          <dl className="impact">
            <div>
              <dt>
                <Wind size={17} aria-hidden /> Fewer outdoor minutes
              </dt>
              <dd>{outdoorMinutesAvoided}</dd>
            </div>
            <div>
              <dt>
                <CarFront size={17} aria-hidden /> Round trips avoided if shared
              </dt>
              <dd>{conditionalRoundTrips}</dd>
            </div>
            <div>
              <dt>
                <House size={17} aria-hidden /> Indoor sources addressed
              </dt>
              <dd>{sourcesRemoved}</dd>
            </div>
          </dl>
          <p className="column-labels" aria-hidden="true">
            <span>Original</span>
            <span>Suggested</span>
          </p>
          <ol className="decisions">
            {plan.decisions.map((decision) => (
              <li className="decision" key={decision.original.id}>
                <div className="decision-top">
                  <div className="decision-before">
                    <span className="sr-only">Original activity</span>
                    <time dateTime={decision.original.time}>
                      {decision.original.time}
                    </time>
                    <strong>{activities[decision.original.kind]}</strong>
                    <span>
                      {decision.original.duration} min{" "}
                      {decision.original.fixed ||
                      decision.original.kind === "school_pickup" ? (
                        <LockKeyhole size={12} aria-label="Fixed" />
                      ) : null}
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
                    <span className="sr-only">Suggested activity</span>
                    <span
                      className={`decision-tag ${decision.kind === "kept" ? "kept" : ""}`}
                    >
                      {decisionLabel[decision.kind]}
                      {decision.time ? ` · ${decision.time}` : ""}
                    </span>
                    <strong>{decision.title}</strong>
                  </div>
                </div>
                <p>{decision.reason}</p>
              </li>
            ))}
          </ol>
          <p className="subtle metric-note">
            Outdoor minutes describe changes to your schedule. Trip savings
            depend on replacing a separate drive.
          </p>
        </>
      ) : (
        <div className="empty-plan">
          <CalendarCheck size={28} aria-hidden />
          <p>
            Choose <strong>Compare plans</strong> after reviewing your
            activities.
          </p>
        </div>
      )}
    </section>
  );
}
