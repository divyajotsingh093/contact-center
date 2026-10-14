import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Inter with its optical-size axis: large type moves towards the Inter Display cut, as on Attio.
const sans = Inter({ subsets: ["latin"], axes: ["opsz"], variable: "--font-brand", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-data", display: "swap" });

export const metadata: Metadata = {
  title: "Income CCMS",
  description: "Customer Case Management System – POC",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
