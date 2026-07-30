"use client";

// app/error.tsx only covers errors thrown by page.tsx segments below the
// root layout — it explicitly does NOT catch an error thrown by
// layout.tsx or anything it renders directly (e.g. SiteHeader). This is
// the one boundary Next.js provides that does cover the root layout
// itself; without it, an error at that level has no boundary above it at
// all, and React unmounts to a blank page with nothing rendered — on
// every page, since SiteHeader mounts on all of them, and identically on
// every reload since the trigger (e.g. a missing required env var) is
// deterministic, not transient.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>CityPinned is temporarily unavailable</h1>
        <p style={{ marginTop: "0.5rem", color: "#475569", fontSize: "0.875rem" }}>
          Something failed to load. Please try again in a moment.
        </p>
        {process.env.NODE_ENV !== "production" && (
          <pre style={{ marginTop: "1rem", textAlign: "left", fontSize: "0.75rem", color: "#b91c1c" }}>
            {error.message}
          </pre>
        )}
      </body>
    </html>
  );
}
