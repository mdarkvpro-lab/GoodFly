"use client";

/**
 * Inline script that runs while the HTML is parsed (before first paint).
 * It is a real script in the server HTML, and inert text on the client, so React
 * does not warn about rendering a <script> (pattern from the Next.js
 * "Preventing flash before hydration" guide).
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
