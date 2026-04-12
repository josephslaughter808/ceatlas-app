"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./auth-provider";
import { useTripCart } from "./trip-cart-provider";

export default function SiteHeader() {
  const { user, loading } = useAuth();
  const { tripCourseIds } = useTripCart();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <nav className="site-nav">
      <div className="site-brand">
        <Image src="/logo.png" alt="CEAtlas logo" width={72} height={72} />
        <div className="site-brand__text">
          <span>Dental CE Catalog</span>
          <strong>CEAtlas</strong>
        </div>
      </div>

      <div className="site-nav__right">
        <div className="auth-actions">
          <Link href="/travel" className="auth-button auth-button--icon" aria-label="Open cart" title="Open cart">
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

        <div className="site-links">
          <Link href="/">Home</Link>
          <Link href="/courses">Courses</Link>
          <Link href="/saved">Saved</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/travel">Travel</Link>
          <Link href="/packages">Packages</Link>
          <Link href="/cruises">Cruises</Link>
          <Link href="/list-your-ce">List your CE</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </div>
    </nav>
  );
}
