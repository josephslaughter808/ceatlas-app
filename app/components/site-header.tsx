"use client";

import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./auth-provider";

export default function SiteHeader() {
  const { user, loading } = useAuth();

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
          {loading ? null : user ? (
            <>
              <Link href="/account" className="auth-button auth-button--primary">Account</Link>
              <button type="button" className="auth-button auth-button--ghost" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/account" className="auth-button auth-button--ghost">Log in</Link>
              <Link href="/account" className="auth-button auth-button--primary">Sign up</Link>
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
