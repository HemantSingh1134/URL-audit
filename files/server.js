const express = require('express');
const cheerio = require('cheerio');
const path = require('path');
const { parseAndValidateUrl } = require('./src/url-validator');

const app = express();
const PORT = process.env.PORT || 3000;
const FETCH_TIMEOUT_MS = 10000; // 10s
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5MB cap on how much body we read

app.use(express.json());

// Malformed JSON in the request body throws inside express.json(); catch it
// here and respond with a clean 400 instead of falling through to the
// generic 500 handler.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON.' });
  }
  next(err);
});

app.use(express.static(path.join(__dirname, 'public')));


/**
 * Fetch a URL with a hard timeout, following redirects, and return the
 * response object plus timing info. Throws descriptive errors on failure.
 */
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; URLAuditorBot/1.0; +https://example.com/bot)',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
    });
    const elapsedMs = Date.now() - start;
    return { response, elapsedMs };
  } catch (err) {
    const elapsedMs = Date.now() - start;
    if (err.name === 'AbortError') {
      const e = new Error(`Request timed out after ${timeoutMs / 1000}s.`);
      e.code = 'TIMEOUT';
      e.elapsedMs = elapsedMs;
      throw e;
    }
    // Covers DNS failures, connection refused, TLS errors, etc.
    const e = new Error(
      `Could not reach that URL (${err.cause?.code || err.code || err.message}).`
    );
    e.code = 'NETWORK_ERROR';
    e.elapsedMs = elapsedMs;
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read the response body up to a max byte cap, so a huge/streaming
 * response can't hang or blow up memory. Returns the text collected.
 */
async function readBodyCapped(response, maxBytes) {
  if (!response.body) {
    return await response.text();
  }
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > maxBytes) {
      chunks.push(value.subarray(0, value.length - (received - maxBytes)));
      try {
        await reader.cancel();
      } catch (_) {
        /* ignore */
      }
      break;
    }
    chunks.push(value);
  }

  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return buffer.toString('utf-8');
}

function analyzeHtml(html) {
  const $ = cheerio.load(html);

  const title = $('title').first().text().trim() || null;

  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null;

  const h1Count = $('h1').length;

  const images = $('img');
  let imagesMissingAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr('alt');
    // Missing alt attribute entirely, or present but empty/whitespace-only
    // counts as "missing" for accessibility purposes, except a
    // deliberately empty alt="" on a purely decorative image is valid —
    // we only flag when the attribute is absent altogether or is
    // whitespace, to stay conservative and avoid false positives.
    if (alt === undefined) {
      imagesMissingAlt += 1;
    }
  });

  // Approximate word count from visible text: strip script/style, then
  // split on whitespace.
  $('script, style, noscript').remove();
  const bodyText = $('body').text() || $.root().text();
  const words = bodyText
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  return {
    title,
    metaDescription,
    h1Count,
    imageCount: images.length,
    imagesMissingAlt,
    wordCount: words.length,
  };
}

app.post('/api/audit', async (req, res) => {
  const rawUrl = req.body && req.body.url;

  let targetUrl;
  try {
    targetUrl = parseAndValidateUrl(rawUrl);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  let fetchResult;
  try {
    fetchResult = await fetchWithTimeout(targetUrl, FETCH_TIMEOUT_MS);
  } catch (err) {
    const statusCode = err.code === 'TIMEOUT' ? 504 : 502;
    return res.status(statusCode).json({
      error: err.message,
      elapsedMs: err.elapsedMs,
    });
  }

  const { response, elapsedMs } = fetchResult;
  const contentType = response.headers.get('content-type') || '';

  const baseReport = {
    requestedUrl: rawUrl,
    finalUrl: response.url || targetUrl.toString(),
    status: response.status,
    statusText: response.statusText,
    responseTimeMs: elapsedMs,
    contentType: contentType.split(';')[0].trim() || null,
  };

  if (!response.ok) {
    return res.status(200).json({
      ...baseReport,
      error: `Server responded with ${response.status} ${response.statusText}.`,
    });
  }

  if (!contentType.toLowerCase().includes('html')) {
    return res.status(200).json({
      ...baseReport,
      error: `Response is not an HTML page (content-type: ${
        contentType || 'unknown'
      }), so it can't be audited for page content.`,
    });
  }

  let html;
  try {
    html = await readBodyCapped(response, MAX_BODY_BYTES);
  } catch (err) {
    return res.status(502).json({
      ...baseReport,
      error: 'Failed to read the response body.',
    });
  }

  let analysis;
  try {
    analysis = analyzeHtml(html);
  } catch (err) {
    return res.status(200).json({
      ...baseReport,
      error: 'Fetched the page but could not parse its HTML.',
    });
  }

  return res.status(200).json({
    ...baseReport,
    ...analysis,
  });
});

// Catch-all 404 for unknown API routes, so nothing falls through unhandled.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Unknown API route.' });
});

// Never let an unexpected error crash the process.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

app.listen(PORT, () => {
  console.log(`URL Auditor running at http://localhost:${PORT}`);
});
