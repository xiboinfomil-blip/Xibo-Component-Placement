export function sanitizeHtmlForIframe(html) {
  if (!html) return '';
  
  // Replace external script/src references with placeholders
  let sanitized = html;
  
  // Remove or comment out external script tags that will fail
  sanitized = sanitized.replace(
    /<script\s+src=["']\/assets\/[^"']*["'][^>]*><\/script>/gi,
    '<!-- External script removed for local development -->'
  );
  
  // Remove external CSS links that will fail
  sanitized = sanitized.replace(
    /<link\s+rel="stylesheet"\s+href=["']\/assets\/[^"']*["'][^>]*>/gi,
    '<!-- External CSS removed for local development -->'
  );
  
  return sanitized;
}