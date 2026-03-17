# Carvia Backend

A robust backend service for the **Carvia Job Portal**, powering job aggregations from multiple highly respected APIs and an automated LinkedIn web scraper.

## Features
- **Job Aggregation**: Combines results from:
   - Findwork API
   - Jooble API
   - Arbeitnow API (Free)
   - Jobicy API (Free)
   - Remotive API (Free)
- **Built-in LinkedIn Web Scraper**: Includes a scheduled Cheerio script running every 6 hours to fetch fresh jobs directly from LinkedIn, bypassing expensive API solutions.
- **Production Ready**: Fully configured CORS integration, rate-limiting, Helmet security headers, reverse proxy support, and asynchronous internal data handling to ensure excellent UI performance under high load.

## Requirements
- Node.js (v18+)
- Supabase account (for database connection, if applicable)

## Installation and Setup

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd Carvia-Backend
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Environment Setup:**
   Duplicate the provided `.env.example` file and rename it to `.env`:
   ```bash
   cp .env.example .env
   ```
   *Fill out the file with your specific API keys, Supabase credentials, and the production URL of your frontend once deployed.*

4. **Running Locally:**
   ```bash
   npm start
   ```
   *The server will boot up and immediately begin crawling LinkedIn into the `linkedin_jobs_india.json` cache file, while listening for requests on port `5000`.*

## Tech Stack
- **Express.js:** Core backend router
- **Axios:** Outbound API fetcher
- **Cheerio:** LinkedIn HTML parsing engine
- **Node `fs` Promises:** For non-blocking persistent JSON caches 
- **Dotenv:** API key management
