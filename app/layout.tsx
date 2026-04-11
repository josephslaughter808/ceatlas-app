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

const socialLinks = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/ceatlas.co/",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4.25" />
        <circle cx="17.25" cy="6.75" r="1.25" className="social-icon__fill" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/ceatlas.co",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13.5 21v-7h2.65l.4-3h-3.05V9.1c0-.87.24-1.46 1.5-1.46H16.7V4.96c-.3-.04-1.35-.12-2.57-.12-2.55 0-4.3 1.56-4.3 4.43V11H7v3h2.83v7h3.67Z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@ceatlas.co",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.8 4c.35 2.02 1.55 3.41 3.5 4.02V10.7c-1.44-.05-2.77-.45-3.96-1.2v5.43c0 3.05-2.4 5.24-5.33 5.24-1.1 0-2.13-.32-3.01-.92A5.14 5.14 0 0 1 3.7 15c0-2.92 2.32-5.27 5.31-5.27.24 0 .48.02.7.06v2.93a2.4 2.4 0 0 0-.7-.11c-1.33 0-2.39 1.06-2.39 2.39 0 .91.49 1.7 1.22 2.11.34.2.74.31 1.17.31 1.26 0 2.28-1.01 2.28-2.39V4h3.51Z" />
      </svg>
    ),
  },
];

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CEAtlas | Dental CE Courses, Conferences, Cruises & Travel",
    template: "%s | CEAtlas",
  },
  description: siteDescription,
  icons: {
    icon: [
      { url: "/icon.png?v=3", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico?v=3", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon.png?v=3", sizes: "180x180", type: "image/png" }],
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
                      <div className="site-footer__brand">
                        <p className="site-footer__copyright">© {new Date().getFullYear()} CEAtlas</p>
                        <p className="site-footer__tagline">Dental CE discovery, comparison, and travel planning in one place.</p>
                      </div>
                      <div className="site-footer__actions">
                        <a className="site-footer__button site-footer__button--secondary" href="mailto:support@ceatlas.co">Support</a>
                        <a className="site-footer__button site-footer__button--secondary" href="mailto:providers@ceatlas.co">Providers</a>
                        <div className="site-footer__socials" aria-label="CEAtlas social media">
                          {socialLinks.map((link) => (
                            <a
                              key={link.label}
                              className={`site-footer__social-link site-footer__social-link--${link.label.toLowerCase()}`}
                              href={link.href}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={link.label}
                              title={link.label}
                            >
                              {link.icon}
                            </a>
                          ))}
                        </div>
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
