import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "SmogShift | Air-aware day planner",
  description:
    "Plan a lower-exposure, lower-emission day around Delhi-NCR’s winter air forecast.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
