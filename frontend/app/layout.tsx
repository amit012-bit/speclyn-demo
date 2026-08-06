import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Providers from "./providers";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
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
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col bg-background font-sans text-foreground antialiased`}
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
