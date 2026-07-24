const { parseAndValidateUrl } = require('./url-validator');

describe('parseAndValidateUrl', () => {
  test('parses a valid URL without requiring an explicit scheme', () => {
    const result = parseAndValidateUrl('example.com/path?x=1');
    expect(result).toBeInstanceOf(URL);
    expect(result.protocol).toBe('https:');
    expect(result.hostname).toBe('example.com');
    expect(result.pathname).toBe('/path');
    expect(result.search).toBe('?x=1');
  });

  test('throws when the input is empty', () => {
    expect(() => parseAndValidateUrl('')).toThrow('Please provide a URL.');
  });

  test('throws when the URL is not valid', () => {
    expect(() => parseAndValidateUrl('not a url')).toThrow(
      'That does not look like a valid URL.'
    );
  });
});
