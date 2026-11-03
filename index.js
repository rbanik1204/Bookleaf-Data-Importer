require("dotenv").config()

const fs = require("node:fs")
const path = require("node:path")

const BASE_URL = process.env.BUBBLE_BASE_URL?.replace(/\/$/, "")
const API_TOKEN = process.env.BUBBLE_API_TOKEN
const IMPORT_LIMIT = Number(process.env.IMPORT_LIMIT || 1)
if (!BASE_URL || !API_TOKEN) {
  throw new Error("Missing BUBBLE_BASE_URL or BUBBLE_API_TOKEN in .env")
}

const DATA_PATH = path.join(__dirname, "data", "bookleaf_sample_data.json")

async function bubbleRequest(endpoint, options = {}) {
  const response = await fetch(`${BASE_URL}/api/1.1/obj${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  const responseText = await response.text()

  let data
  try {
    data = responseText ? JSON.parse(responseText) : {}
  } catch {
    data = responseText
  }

  if (!response.ok) {
    throw new Error(
      `Bubble API error (${response.status}): ${JSON.stringify(data)}`
    )
  }

  return data
}

function formatDate(date) {
  if (!date) return undefined

  // Preserve the source calendar date.
  return `${date}T00:00:00.000Z`
}

function removeNullFields(object) {
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) => value !== null && value !== undefined
    )
  )
}

async function getExistingRecords(type) {
  const data = await bubbleRequest(`/${type}?limit=100`)

  return data.response?.results || []
}

async function importBooks() {
  console.log("\nStarting BookLeaf data import...\n")

  // Read the original JSON dataset.
  const rawData = fs.readFileSync(DATA_PATH, "utf-8")
  const dataset = JSON.parse(rawData)

  // Flatten nested books while retaining their author IDs.
  const books = dataset.authors.flatMap((author) =>
    author.books.map((book) => ({
      ...book,
      author_id: author.author_id,
    }))
  )

  console.log(`Source authors: ${dataset.authors.length}`)
  console.log(`Source books: ${books.length}`)

  // Fetch existing Bubble records.
  const [bubbleAuthors, bubbleBooks] = await Promise.all([
    getExistingRecords("author"),
    getExistingRecords("book"),
  ])

  // Map our custom author IDs to Bubble's unique IDs.
  const authorMap = new Map(
    bubbleAuthors.map((author) => [author.author_id, author._id])
  )

  // Track existing book IDs to prevent duplicates.
  const existingBookIds = new Set(bubbleBooks.map((book) => book.book_id))

  console.log(`Bubble authors found: ${authorMap.size}`)
  console.log(`Existing books found: ${existingBookIds.size}`)

  let created = 0
  let skipped = 0

  for (const book of books) {
    if (created >= IMPORT_LIMIT) break

    if (existingBookIds.has(book.book_id)) {
      console.log(`SKIPPED: ${book.book_id} already exists`)
      skipped++
      continue
    }

    const bubbleAuthorId = authorMap.get(book.author_id)

    if (!bubbleAuthorId) {
      throw new Error(
        `Author ${book.author_id} not found in Bubble for ${book.book_id}`
      )
    }

    // Build the Bubble Book record.
    const payload = removeNullFields({
      book_id: book.book_id,
      title: book.title,
      isbn: book.isbn,
      genre: book.genre,
      publication_date: formatDate(book.publication_date),
      status: book.status,
      mrp: book.mrp,
      author_royalty_per_copy: book.author_royalty_per_copy,
      total_copies_sold: book.total_copies_sold,
      total_royalty_earned: book.total_royalty_earned,
      royalty_paid: book.royalty_paid,
      royalty_pending: book.royalty_pending,
      last_royalty_payout_date: formatDate(book.last_royalty_payout_date),
      print_partner: book.print_partner,
      available_on: book.available_on,

      // Bubble relationship: use the Author's unique Bubble ID.
      author: bubbleAuthorId,

      // Keep the original custom author ID too.
      author_id: book.author_id,
    })

    console.log(`Creating: ${book.book_id} - ${book.title}`)

    const result = await bubbleRequest("/book", {
      method: "POST",
      body: JSON.stringify(payload),
    })

    console.log("Created:", result)

    existingBookIds.add(book.book_id)
    created++
  }

  console.log("\n========== IMPORT SUMMARY ==========")
  console.log(`Books created: ${created}`)
  console.log(`Books skipped: ${skipped}`)
  console.log("====================================\n")
}

importBooks().catch((error) => {
  console.error("\nIMPORT FAILED:")
  console.error(error.message)
  process.exitCode = 1
})
