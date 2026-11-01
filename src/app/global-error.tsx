"use client";

/** Last resort, when even the app's frame fails. Plain styles: the app's CSS isn't loaded here. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, padding: 24, textAlign: "center" }}>
        <title>TutoringHub</title>
        <div>
          <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
          <p style={{ color: "#666" }}>TutoringHub didn&apos;t load. Check the internet, then try again.</p>
          <button type="button" onClick={() => retry()} style={{ marginTop: 12, padding: "12px 20px", borderRadius: 12, border: 0, background: "#0f6b62", color: "#fff", fontSize: 16 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
