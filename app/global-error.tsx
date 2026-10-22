"use client";
/** Last-resort error UI (replaces the root layout, so it carries its own <html>). */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#0b0c0e", color: "#f4f3ef", fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <main style={{ maxWidth: 560, margin: "20vh auto", padding: "0 1rem" }}>
          <h1 style={{ fontSize: "2rem" }}>Something went wrong.</h1>
          <p style={{ color: "#b1b4ba", lineHeight: 1.6 }}>Please refresh the page. If the problem continues, give us a call.</p>
          <button
            onClick={reset}
            style={{ marginTop: 16, minHeight: 44, padding: "0 20px", borderRadius: 999, border: 0, background: "#c8a24a", fontWeight: 700, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
