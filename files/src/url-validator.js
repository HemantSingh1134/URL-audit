function parseAndValidateUrl(raw) {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    throw new Error('Please provide a URL.');
  }

  let candidate = raw.trim();
  // Be forgiving: if there's no scheme, assume https://
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = 'https://' + candidate;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch (e) {
    throw new Error('That does not look like a valid URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are supported.');
  }

  return parsed;
}

module.exports = { parseAndValidateUrl };
