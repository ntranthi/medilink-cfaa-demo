import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Header } from "./components/Header";

// Every page depends on the DB and the session cookie: never prerender.
export const dynamic = "force-dynamic";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MediLink Health — Internal Portal (CFAA demo)",
  description: "Fictional telehealth portal for a CFAA (18 U.S.C. § 1030) course demo. No real PHI.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-neutral-200 bg-white px-4 py-3 text-center text-xs text-neutral-500">
          <strong>Fictional demo — no real PHI.</strong> MediLink Health Inc. does not exist. Scope: CFAA (18 U.S.C. § 1030) only;
          HIPAA is out of scope. · <Link href="/terms" className="underline">Terms of Service</Link> ·{" "}
          <a href="/robots.txt" className="underline">robots.txt</a> · CO5159 HCMUT
        </footer>
      </body>
    </html>
  );
}
