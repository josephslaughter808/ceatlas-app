import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { AuthProvider } from "./components/auth-provider";
import { CompareProvider } from "./components/compare-provider";
import { SavedCoursesProvider } from "./components/saved-courses-provider";
import Analytics from "./components/analytics";
import SiteHeader from "./components/site-header";
import { TravelPlannerProvider } from "./components/travel-planner-provider";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ceatlas.co";
const siteDescription =
  "Search dental CE courses, conferences, cruises, and hands-on events from providers across the U.S. and beyond. Compare topics, formats, locations, credits, and travel options in one place.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CEAtlas | Dental CE Courses, Conferences, Cruises & Travel",
    template: "%s | CEAtlas",
  },
  description: siteDescription,
  icons: {
    icon: [
      { url: "/icon.png?v=2", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico?v=2", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon.png?v=2", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "CEAtlas | Dental CE Courses, Conferences, Cruises & Travel",
    description: siteDescription,
    url: "/",
    siteName: "CEAtlas",
    images: [
      {
        url: "/logo-search.png",
        width: 1024,
        height: 1024,
        alt: "CEAtlas logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CEAtlas | Dental CE Courses, Conferences, Cruises & Travel",
    description: siteDescription,
    images: ["/logo-search.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "CEAtlas",
    url: siteUrl,
    logo: `${siteUrl}/logo-search.png`,
    email: "support@ceatlas.co",
    contactPoint: [
      {
        "@type": "ContactPoint",
        email: "support@ceatlas.co",
        contactType: "customer support",
      },
      {
        "@type": "ContactPoint",
        email: "providers@ceatlas.co",
        contactType: "provider inquiries",
      },
    ],
  };

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
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
