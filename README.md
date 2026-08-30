# CEAtlas

CEAtlas is a continuing education discovery and planning platform for dental professionals. It brings course search, state requirement guidance, saved learning plans, comparison tools, travel planning, and provider connections into one application.

**Live application:** [ceatlas-app.vercel.app](https://ceatlas-app.vercel.app)

> CEAtlas is an active work in progress. The public deployment demonstrates the current product experience while course coverage, provider integrations, and planning workflows continue to expand.

## Problem

Dental professionals often have to search across many provider websites to find eligible continuing education, compare formats and destinations, and understand whether a course supports their state requirements. CEAtlas explores a more organized workflow for discovering and planning that education.

## Current capabilities

- Search and filter a structured continuing education catalog
- Open individual course pages with normalized provider and location information
- Compare selected courses side by side
- Save courses and maintain a personal planning list
- Browse course locations through an interactive world map
- Review state specific continuing education requirements
- Explore dental education cruises and destination based learning
- Build travel plans and continue through a checkout workflow
- Create an account and manage provider connections
- Submit a course or provider for future catalog inclusion

## Architecture

CEAtlas uses the Next.js App Router for the interface and server routes. Course and provider data is normalized through a collection of ingestion scripts before it is exposed to the catalog, comparison, map, and planning experiences.

The repository includes:

- API routes for course filters, map data, featured courses, saved planning, travel, ratings, and account connections
- Data collection and normalization scripts using Playwright, Axios, and Cheerio
- Supabase services for authentication and application data
- Prisma models for structured database access
- Stripe integration for checkout workflows
- Vercel Analytics and Speed Insights for deployment monitoring

## Technology

- Next.js 16 and React 19
- TypeScript and JavaScript
- Supabase and Prisma
- Playwright, Axios, and Cheerio
- Leaflet
- Stripe
- Tailwind CSS
- Vercel

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Some account, database, provider, and checkout features require the services documented in `.env.example`.

## Daily catalog refresh

The `Daily course catalog refresh` GitHub Actions workflow runs `npm run scrape:sync`
every day at 12:00 AM in `America/Chicago`. The refresh scrapes current courses,
upserts providers, courses, and sessions into Supabase, deletes expired dated
sessions, and removes scraper-owned courses that no longer have a session.
Evergreen, on-demand, self-paced, and asynchronous sessions are preserved.

Before enabling the workflow, add these repository Actions secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The workflow can also be started manually from the Actions tab. Its concurrency
setting prevents overlapping catalog refreshes.

## Development status

The application is live but unfinished. Current development is focused on improving catalog quality, expanding provider coverage, refining state eligibility guidance, and completing production ready account and transaction workflows.

## Author

Designed and developed by [Joseph Slaughter](https://github.com/josephslaughter808) as a portfolio and product development project.
