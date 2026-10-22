"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDiscipline } from "@/lib/disciplines";
import { getDisciplineLogo, getDisciplineLogoAlt } from "@/lib/discipline-logo";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./auth-provider";
import { useTripCart } from "./trip-cart-provider";

export default function SiteHeader() {
  const { user, loading } = useAuth();
  const { tripCourseIds } = useTripCart();
  const pathname = usePathname();
  const returnTo = pathname || "/";
  const pathDiscipline = pathname?.match(/^\/disciplines\/([^/]+)/)?.[1];
  const isDentalCatalog = Boolean(pathname?.match(/^\/courses(\/|$)/));
  const activeDisciplineSlug = pathDiscipline || (isDentalCatalog ? "dentistry" : null);
  const activeDiscipline = getDiscipline(activeDisciplineSlug || "");
  const brandLogo = getDisciplineLogo(activeDisciplineSlug);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <nav className="site-nav" aria-label="Main navigation">
      <Link href="/" className="site-brand">
        <Image src={brandLogo} alt={getDisciplineLogoAlt(activeDiscipline)} width={72} height={72} priority />
        <div className="site-brand__text">
          <strong>CEAtlas</strong>
          <span>{activeDiscipline ? `${activeDiscipline.shortName} CE` : "Learn. Travel. Grow."}</span>
        </div>
      </Link>

      <div className="site-nav__right">
        <div className="site-links">
          <Link href="/courses">Explore CE</Link>
          <Link href="/disciplines">Professions</Link>
          <Link href="/match">Trip Match</Link>
          <Link href="/travel">Plan travel</Link>
          <Link href="/how-it-works">How it works</Link>
        </div>
        <div className="auth-actions">
          <Link href="/travel" className="auth-button auth-button--icon" aria-label="Open trip plan" title="Open trip plan">
            <span className="auth-button__icon-wrap" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="auth-button__icon">
                <path d="M3.5 5.5h2.1l1.6 8.1a1 1 0 0 0 .98.8h8.95a1 1 0 0 0 .97-.76l1.58-6.14H7.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9.25" cy="18.3" r="1.3" fill="currentColor" />
                <circle cx="16.75" cy="18.3" r="1.3" fill="currentColor" />
              </svg>
              {tripCourseIds.length > 0 ? <span className="auth-button__badge">{tripCourseIds.length}</span> : null}
            </span>
          </Link>

          {loading ? null : user ? (
            <>
              <Link href="/account" className="auth-button auth-button--primary">Account</Link>
              <button type="button" className="auth-button auth-button--ghost" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href={`/account?mode=signin&returnTo=${encodeURIComponent(returnTo)}`} className="auth-button auth-button--ghost">Log in</Link>
              <Link href={`/account?mode=signup&returnTo=${encodeURIComponent(returnTo)}`} className="auth-button auth-button--primary">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
