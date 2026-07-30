"use client";

import { useEffect } from "react";

// Without this file, Next.js's default production error boundary renders
// nothing in this static-export app — any uncaught client error (a failed
// hydration, a chunk that didn't load, a thrown exception in a page like
// /vendor/signup) shows a blank white screen with no way back, which is
// indistinguishable from the site being broken.
export default function GlobalPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-600">
        This page hit an error loading. Try again, or head back to the homepage.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Try Again
        </button>
        <a
          href="/"
          className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}
