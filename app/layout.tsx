import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { AuthProvider } from "./components/auth-provider";
import { CompareProvider } from "./components/compare-provider";
import { SavedCoursesProvider } from "./components/saved-courses-provider";
import Analytics from "./components/analytics";
import SiteHeader from "./components/site-header";
import { TravelPlannerProvider } from "./components/travel-planner-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://ceatlas-app.vercel.app"),
  title: "CEAtlas",
  description: "A searchable dental continuing education catalog for comparing courses, conferences, cruises, and CE travel ideas.",
  openGraph: {
    title: "CEAtlas",
    description: "Search and compare dental CE courses, conferences, cruises, and CE travel ideas.",
    url: "/",
    siteName: "CEAtlas",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Analytics />
        <AuthProvider>
          <CompareProvider>
            <SavedCoursesProvider>
              <TravelPlannerProvider>
                <div className="site-shell">
                  <div className="beta-banner">
                    <div className="container beta-banner__inner">
                      <strong>CEAtlas beta</strong>
                      <span>Verify CE eligibility, registration status, price, and state-board fit with the provider before enrolling.</span>
                      <Link href="/contact">Send feedback</Link>
                    </div>
                  </div>

                  <div className="container">
                    <SiteHeader />
                  </div>

                  {children}

                  <footer className="site-footer">
                    <div className="container site-footer__inner">
                      <p>© {new Date().getFullYear()} CEAtlas</p>
                      <div className="site-footer__links">
                        <Link href="/courses">Catalog</Link>
                        <Link href="/saved">Saved</Link>
                        <Link href="/travel">Travel</Link>
                        <Link href="/compare">Compare</Link>
                        <Link href="/account">Account</Link>
                        <Link href="/cruises">Cruises</Link>
                        <Link href="/list-your-ce">List your CE</Link>
                        <Link href="/contact">Contact</Link>
                        <Link href="/privacy">Privacy</Link>
                        <Link href="/terms">Terms</Link>
                        <a href="https://www.ada.org/" target="_blank" rel="noreferrer">ADA</a>
                        <a href="https://www.dentalcare.com/" target="_blank" rel="noreferrer">Dentalcare</a>
                      </div>
                    </div>
                  </footer>
                </div>
              </TravelPlannerProvider>
            </SavedCoursesProvider>
          </CompareProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
