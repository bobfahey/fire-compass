import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fire Compass",
  description: "FIRE planning app for couples with phased spending and priority drift detection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-zinc-50 text-zinc-900">{children}</body>
    </html>
  );
}
