# Pagecheck – URL Audit Console

## Overview

Pagecheck is a full-stack web application that audits any webpage URL and returns useful information about the page. It measures the page response time, extracts SEO-related details, and provides a structured report.

The application consists of:
- **Backend:** Node.js, Express, Cheerio
- **Frontend:** HTML, CSS, JavaScript

---

# Features

- Audit any valid HTTP/HTTPS URL
- HTTP Status Code
- Response Time
- Page Title
- Meta Description
- H1 Heading Count
- Total Images
- Images Missing Alt Text
- Approximate Word Count
- Handles invalid URLs
- Handles timeouts
- Handles non-HTML responses
- Returns user-friendly error messages without crashing

---

# Installation

Clone the repository and install dependencies.

```bash
npm install
```

Start the server.

```bash
npm start
```

Open your browser and visit:

```
http://localhost:3000
```

---

# API Contract

## Endpoint

```
POST /api/audit
```

## Request

```json
{
  "url": "https://example.com"
}
```

## Successful Response

```json
{
  "requestedUrl": "example.com",
  "finalUrl": "https://example.com/",
  "status": 200,
  "statusText": "OK",
  "responseTimeMs": 120,
  "contentType": "text/html",
  "title": "Example Domain",
  "metaDescription": "Example description",
  "h1Count": 1,
  "imageCount": 2,
  "imagesMissingAlt": 0,
  "wordCount": 250
}
```

---

# Error Handling

The application handles the following cases gracefully:

| Situation | HTTP Status | Example Error |
|-----------|------------|---------------|
| Empty URL | 400 | Please provide a URL |
| Invalid URL | 400 | That does not look like a valid URL |
| Unsupported URL Scheme | 400 | Only HTTP and HTTPS URLs are supported |
| Invalid JSON | 400 | Request body must be valid JSON |
| Website Unreachable | 502 | Could not reach that URL |
| Request Timeout | 504 | Request timed out after 10 seconds |
| Non-HTML Response | 200 | Response is not an HTML page |
| Target Page Returns 404/500 | 200 | Server responded with 404 Not Found |

---

# Design Decisions

## 1. Used Cheerio for HTML Parsing

**Reason:**
Cheerio provides a simple jQuery-like syntax for extracting HTML elements such as the title, meta description, headings, and images. It is lightweight, fast, and ideal for server-side HTML parsing.

---

## 2. Added a 10-Second Timeout

**Reason:**
Some websites may be slow or unresponsive. A timeout prevents the application from waiting indefinitely and provides a better user experience by returning a clear timeout error.

---

## 3. Validate URLs Before Fetching

**Reason:**
The application validates and normalizes URLs before sending a request. This avoids unnecessary network calls, improves performance, and returns immediate feedback for invalid input.

---

# Testing

The project includes automated tests using **Jest**.

Run the tests using:

```bash
npm test
```

Current test coverage includes:

- Valid URL (Happy Path)
- Empty URL
- Invalid URL

Example output:

```
PASS src/url-validator.test.js

✓ parses a valid URL
✓ throws when the input is empty
✓ throws when the URL is not valid

Tests: 3 passed
```

---

# Technologies Used

- Node.js
- Express.js
- Cheerio
- HTML
- CSS
- JavaScript
- Jest

---

# Future Improvements

If given more time, the following improvements could be made:

- Improve word count by excluding navigation, footer, and hidden content.
- Add caching for repeated URL requests.
- Support concurrent audits for multiple URLs.
- Increase automated test coverage.
- Improve the frontend UI with charts and better responsiveness.

---

# Author

**Hemant Singh**

URL Audit Console Assignment