"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground">An unexpected error occurred.</p>
          <button
            onClick={reset}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
