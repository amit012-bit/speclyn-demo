import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

// Inter for all UI text (400/500/600/700); JetBrains Mono reserved for
// ICD codes, dollar bases, and clinical data tokens (§2.3).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Speclyn",
  description: "Clinical documentation intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} flex min-h-screen flex-col bg-background font-sans text-body antialiased`}
      >
        <Providers>
          <div className="flex flex-1 flex-col">{children}</div>
          <footer className="border-t border-border bg-surface px-6 py-3 text-center text-xs text-muted print:hidden">
            Demo environment. Do not enter real patient information.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
