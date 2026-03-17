import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import dotenv from "dotenv"
import axios from "axios"
import fs from "fs"
import { supabase } from "./config/supabaseClient.js"
import { startScheduledScraping } from "./linkedinScraper.js"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Security Middlewares
app.use(helmet()) // Add security headers

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: "Too many requests from this IP, please try again later." }
})
app.use(limiter)

// Strict CORS
const allowedOrigins = [
  "http://localhost:5173", // Vite default dev
  "http://localhost:3000",
  // TODO: The user will need to add their production frontend URL here later, e.g. "https://carvia.vercel.app"
]
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}))

// Authentication Middleware
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" })
  }

  const token = authHeader.split(" ")[1]
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return res.status(401).json({ error: "Invalid or expired token" })
  }

  req.user = user // Add user to request for later use
  next()
}

app.use(express.json())

// Health Check
app.get("/", (req, res) => {
  res.send("Carvia Backend Running 🚀")
})

// Supabase Jobs Route (Protected)
app.get("/jobs", authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: "Database error" })
  }
})

// Aggregator Search Route (Protected)
app.get("/search", authenticate, async (req, res) => {
  const keyword = req.query.keyword || "developer"

  try {
    const requests = [
      //  Findwork
      axios.get(process.env.API1_URL, {
        headers: {
          Authorization: `Token ${process.env.API1_KEY}`
        },
        params: { search: keyword },
        timeout: 8000
      }),

      //  Jooble
      axios.post(
        `${process.env.API2_URL}/${process.env.API2_KEY}`,
        {
          keywords: keyword,
          location: ""
        },
        { timeout: 8000 }
      ),

      //  Arbeitnow
      axios.get(process.env.API3_URL, { timeout: 8000 }),

      //  Jobicy
      axios.get(process.env.API4_URL, { timeout: 8000 })
    ]

    const responses = await Promise.allSettled(requests)
    const results = []
    // LinkedIn scraped jobs
    try {
      const data = fs.readFileSync("linkedin_jobs_india.json", "utf8")
      const linkedinJobs = JSON.parse(data)

      results.push(
        ...linkedinJobs.map(job => ({
          title: job.title,
          company: job.company,
          location: job.location,
          source: "LinkedIn",
          url: job.link
        }))
      )
    } catch (err) {
      console.log("LinkedIn jobs not loaded")
    }

    // 🔹 Findwork
    if (responses[0].status === "fulfilled") {
      const data = responses[0].value.data
      if (data.results) {
        results.push(
          ...data.results.map(job => ({
            title: job.role,
            company: job.company_name,
            location: job.location,
            source: "Findwork",
            url: job.url
          }))
        )
      }
    }

    //  Jooble
    if (responses[1].status === "fulfilled") {
      const data = responses[1].value.data
      if (data.jobs) {
        results.push(
          ...data.jobs.map(job => ({
            title: job.title,
            company: job.company,
            location: job.location,
            source: "Jooble",
            url: job.link
          }))
        )
      }
    }

    //  Arbeitnow
    if (responses[2].status === "fulfilled") {
      const data = responses[2].value.data
      if (data.data) {
        results.push(
          ...data.data.map(job => ({
            title: job.title,
            company: job.company_name,
            location: job.location,
            source: "Arbeitnow",
            url: job.url
          }))
        )
      }
    }

    //  Jobicy
    if (responses[3].status === "fulfilled") {
      const data = responses[3].value.data
      if (data.jobs) {
        results.push(
          ...data.jobs.map(job => ({
            title: job.jobTitle,
            company: job.companyName,
            location: job.jobGeo,
            source: "Jobicy",
            url: job.url
          }))
        )
      }
    }

    res.json({
      total: results.length,
      keyword,
      results
    })

  } catch (error) {
    console.error("Search Error:", error.message)
    res.status(500).json({ error: "Search failed" })
  }
})

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "production" ? "Something went wrong" : err.message
  })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`)
  startScheduledScraping()
})

