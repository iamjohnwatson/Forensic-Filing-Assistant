import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forensic SEC Assistant",
  description: "AI-powered SEC filing analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
