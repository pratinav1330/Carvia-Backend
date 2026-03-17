import axios from "axios"
import * as cheerio from "cheerio"
import fs from "fs"
import path from "path"

const KEYWORDS = [
  "software developer",
  "python developer",
  "data analyst",
  "backend developer",
  "frontend developer",
  "full stack developer",
  "java developer"
]

const OUTPUT_FILE = path.resolve("linkedin_jobs_india.json")
const SCRAPE_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours

async function scrapeLinkedInJobs() {
  console.log(`[LinkedIn Scraper] Starting scrape at ${new Date().toISOString()}...`)

  const allJobs = []

  for (const keyword of KEYWORDS) {
    for (let start = 0; start < 200; start += 25) {
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keyword)}&location=India&start=${start}`

      try {
        const { data: html } = await axios.get(url, {
          timeout: 10000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        })

        const $ = cheerio.load(html)

        $("li").each((_, el) => {
          const title = $(el).find("h3").text().trim()
          const company = $(el).find("h4").text().trim()
          const location = $(el).find("span.job-search-card__location").text().trim()
          const link = $(el).find("a").attr("href") || ""

          if (title) {
            allJobs.push({
              keyword,
              title,
              company,
              location,
              link
            })
          }
        })

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (err) {
        // Silently continue on individual page failures
        if (err.response && err.response.status === 429) {
          console.log(`[LinkedIn Scraper] Rate limited on "${keyword}" page ${start}, skipping...`)
          break // Move to next keyword
        }
      }
    }
  }

  // Write results to file
  await fs.promises.writeFile(OUTPUT_FILE, JSON.stringify(allJobs, null, 4), "utf-8")
  console.log(`[LinkedIn Scraper] Done! Scraped ${allJobs.length} jobs. Saved to ${OUTPUT_FILE}`)

  return allJobs.length
}

function startScheduledScraping() {
  // Run immediately on startup
  scrapeLinkedInJobs().catch(err => {
    console.error("[LinkedIn Scraper] Initial scrape failed:", err.message)
  })

  // Then run every 6 hours
  setInterval(() => {
    scrapeLinkedInJobs().catch(err => {
      console.error("[LinkedIn Scraper] Scheduled scrape failed:", err.message)
    })
  }, SCRAPE_INTERVAL_MS)

  console.log(`[LinkedIn Scraper] Scheduled to run every ${SCRAPE_INTERVAL_MS / 3600000} hours`)
}

export { scrapeLinkedInJobs, startScheduledScraping }
