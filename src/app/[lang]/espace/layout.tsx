import type { Metadata } from "next";
import type { ReactNode } from "react";

// The staff area is private: never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function StaffRootLayout({ children }: { children: ReactNode }) {
  return children;
}
