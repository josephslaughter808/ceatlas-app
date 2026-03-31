"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../components/auth-provider";

const destinations = [
  {
    id: "maui-implant",
    title: "Maui Implant Intensive",
    location: "Wailea, Hawaii",
    region: "Beach",
    topic: "Implants",
    vibe: "Beach",
    format: "Live workshop",
    pitch: "Morning implant training, sunset dinners, and enough open time to make the trip feel like a true reset.",
    highlights: ["Oceanfront resort", "Hands-on implant lab", "Partner-friendly excursions"],
  },
  {
    id: "scottsdale-aesthetics",
    title: "Scottsdale Smile Design Escape",
    location: "Scottsdale, Arizona",
    region: "Desert",
    topic: "Aesthetics",
    vibe: "Desert",
    format: "Weekend course",
    pitch: "Blend high-end cosmetic CE with spa hotels, chef dinners, and an itinerary that feels like a reward.",
    highlights: ["Luxury desert stay", "Cosmetic workflow sessions", "Golf and wellness add-ons"],
  },
  {
    id: "charleston-perio",
    title: "Charleston Perio & Practice Retreat",
    location: "Charleston, South Carolina",
    region: "East Coast",
    topic: "Periodontics",
    vibe: "Beach",
    format: "Conference + retreat",
    pitch: "Historic charm, coastal energy, and focused periodontal CE for teams who want strategy and scenery.",
    highlights: ["Boutique hotels", "Coastal dining", "Team-planning workshops"],
  },
  {
    id: "aspen-endo",
    title: "Aspen Endo Summit",
    location: "Aspen, Colorado",
    region: "Mountain",
    topic: "Endodontics",
    vibe: "Mountain",
    format: "3-day summit",
    pitch: "Advanced endo lectures by day, fireside networking and alpine luxury by night.",
    highlights: ["Mountain resort", "Specialist-led sessions", "Private dinner series"],
  },
  {
    id: "napa-leadership",
    title: "Napa Leadership and Lifestyle Week",
    location: "Napa Valley, California",
    region: "West Coast",
    topic: "Practice Growth",
    vibe: "Wine Country",
    format: "Executive retreat",
    pitch: "A founder-style CE experience built around leadership, profitability, and memorable hospitality.",
    highlights: ["Estate stays", "Leadership intensives", "Private vineyard events"],
  },
  {
    id: "miami-ortho",
    title: "Miami Aligners by the Water",
    location: "Miami, Florida",
    region: "Beach",
    topic: "Orthodontics",
    vibe: "Beach",
    format: "Live intensive",
    pitch: "Fast-moving aligner CE paired with rooftop hotels, warm nights, and a polished city-beach feel.",
    highlights: ["Waterfront hotel", "Digital ortho sessions", "Nightlife concierge"],
  },
];

const packageThemes = {
  Beach: {
    className: "packages-page packages-page--beach",
    kicker: "Ocean air. Better CE. A trip worth remembering.",
    story: "Sell the idea of beachfront mornings, polished continuing education, and a vacation the whole family actually wants to join.",
  },
  Mountain: {
    className: "packages-page packages-page--mountain",
    kicker: "High-altitude focus with real breathing room.",
    story: "Frame the trip as a reset: deep learning, crisp air, and a little distance from the usual routine of the practice.",
  },
  Desert: {
    className: "packages-page packages-page--desert",
    kicker: "Luxury, sunshine, and a sharper kind of getaway.",
    story: "Let the destination feel warm, clean, and elevated, with design-forward resorts and restorative downtime around the CE.",
  },
  "Wine Country": {
    className: "packages-page packages-page--wine",
    kicker: "An executive retreat disguised as your favorite trip of the year.",
    story: "Position CEAtlas as the easiest way to turn serious professional growth into a premium escape.",
  },
  "East Coast": {
    className: "packages-page packages-page--coast",
    kicker: "Historic cities, coastal dinners, and CE that feels curated.",
    story: "Invite dentists into a trip that is as much about atmosphere and hospitality as it is about credits.",
  },
  "West Coast": {
    className: "packages-page packages-page--coast",
    kicker: "West Coast polish with just enough indulgence.",
    story: "Make the planning feel effortless: elegant stays, standout restaurants, and one beautiful itinerary.",
  },
} as const;

function uniqueValues(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export default function PackagesPage() {
  const { user } = useAuth();
  const [region, setRegion] = useState("Beach");
  const [topic, setTopic] = useState("All topics");
  const [location, setLocation] = useState("All locations");
  const [sortBy, setSortBy] = useState("region");

  const topics = useMemo(
    () => ["All topics", ...uniqueValues(destinations.map((item) => item.topic))],
    []
  );
  const locations = useMemo(
    () => ["All locations", ...uniqueValues(destinations.map((item) => item.location))],
    []
  );
  const regions = useMemo(
    () => uniqueValues(destinations.map((item) => item.region)),
    []
  );

  const visibleDestinations = useMemo(() => {
    const filtered = destinations
      .filter((item) => (region ? item.region === region || item.vibe === region : true))
      .filter((item) => (topic === "All topics" ? true : item.topic === topic))
      .filter((item) => (location === "All locations" ? true : item.location === location));

    const sorted = [...filtered];

    if (sortBy === "location") {
      sorted.sort((a, b) => a.location.localeCompare(b.location));
    } else if (sortBy === "topic") {
      sorted.sort((a, b) => a.topic.localeCompare(b.topic));
    } else {
      sorted.sort((a, b) => a.region.localeCompare(b.region));
    }

    return sorted;
  }, [location, region, sortBy, topic]);

  const theme = packageThemes[region as keyof typeof packageThemes] || packageThemes.Beach;

  return (
    <div className={theme.className}>
      <div className="packages-atmosphere" aria-hidden="true">
        <div className="packages-sky" />
        <div className="packages-cloud packages-cloud--one" />
        <div className="packages-cloud packages-cloud--two" />
        <div className="packages-wave packages-wave--one" />
        <div className="packages-wave packages-wave--two" />
      </div>

      <div className="container packages-shell">
        <section className="packages-hero">
          <div className="packages-hero__copy">
            <p className="packages-hero__eyebrow">Build Your Own CE Vacation</p>
            <h1>Invite dentists to plan the trip they daydream about during clinic hours.</h1>
            <p>
              CEAtlas should feel less like shopping for credits and more like designing a personal reward:
              the right topic, the right destination, the right hotel, and a reason to bring someone along.
            </p>
            <div className="packages-hero__theme">
              <strong>{theme.kicker}</strong>
              <span>{theme.story}</span>
            </div>
          </div>

          <div className="packages-hero__stats">
            <div className="card">
              <h2>{visibleDestinations.length}</h2>
              <p>Curated destination ideas in this theme</p>
            </div>
            <div className="card">
              <h2>{topics.length - 1}</h2>
              <p>High-value CE topics to anchor the itinerary</p>
            </div>
            <div className="card">
              <h2>Flights + stay</h2>
              <p>Future package layers ready to be attached to saved courses and trips</p>
            </div>
          </div>
        </section>

        <section className="packages-builder">
          <div className="packages-builder__controls card">
            <div className="packages-builder__head">
              <div>
                <p className="packages-builder__eyebrow">Trip Builder</p>
                <h2>Start with the feeling, then narrow the itinerary.</h2>
              </div>
              <p>
                Dentists should be able to chase credits and the kind of destination that gets them genuinely excited to book.
              </p>
            </div>

            <div className="packages-filters">
              <label>
                <span>Region / vibe</span>
                <select value={region} onChange={(event) => setRegion(event.target.value)} disabled={!user}>
                  {regions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Topic</span>
                <select value={topic} onChange={(event) => setTopic(event.target.value)} disabled={!user}>
                  {topics.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Location</span>
                <select value={location} onChange={(event) => setLocation(event.target.value)} disabled={!user}>
                  {locations.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Sort by</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} disabled={!user}>
                  <option value="region">Region</option>
                  <option value="topic">Topic</option>
                  <option value="location">Location</option>
                </select>
              </label>
            </div>
            {!user ? (
              <div className="packages-lockup">
                <p>Browse the curated examples below. Sign in to use the interactive builder and turn them into real itineraries.</p>
                <Link href="/account" className="travel-secondary">Log in or sign up</Link>
              </div>
            ) : null}
          </div>

          <div className="packages-results">
            {visibleDestinations.map((item) => (
              <article key={item.id} className="package-card card">
                <div className="package-card__eyebrow">
                  <span>{item.region}</span>
                  <span>{item.topic}</span>
                  <span>{item.format}</span>
                </div>
                <div className="package-card__main">
                  <div className="package-card__copy">
                    <h3>{item.title}</h3>
                    <p className="package-card__location">{item.location}</p>
                    <p>{item.pitch}</p>
                  </div>

                  <div className="package-card__highlights">
                    {item.highlights.map((highlight) => (
                      <span key={highlight}>{highlight}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="packages-sell">
          <div className="card packages-sell__card">
            <p className="packages-builder__eyebrow">Why It Converts</p>
            <h2>Doctors are not just buying CE. They are buying a break from routine.</h2>
            <p>
              The strongest package flow sells professional advancement and emotional payoff together:
              sharpen a skill, bring a spouse, stay somewhere beautiful, and come home feeling like the trip paid off twice.
            </p>
          </div>
          <div className="card packages-sell__card">
            <p className="packages-builder__eyebrow">Next Layer</p>
            <h2>Saved courses can become saved itineraries.</h2>
            <p>
              Once we connect flights, hotels, and cars, this page becomes the front door to full CE travel planning instead of a static catalog.
            </p>
            <p>
              <Link href={user ? "/travel" : "/account"}>{user ? "Start a travel plan" : "Create an account to start planning"}</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
