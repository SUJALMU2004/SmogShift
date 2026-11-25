"use client";

export default function PlannerError({ reset }: { reset: () => void }) {
  return (
    <main className="site-width">
      <section className="card" aria-labelledby="error-heading">
        <h1 id="error-heading">The planner could not load</h1>
        <p>Try opening the planner again.</p>
        <button className="button primary" type="button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
