// HTTP security headers added to every response (see src/server.ts).
//
// The Content-Security-Policy allows only what the site actually uses: our own
// pages, Google Fonts, Razorpay Checkout, and the lesson video players. Inline
// scripts stay allowed because the framework's server rendering needs them.
// Lovable's editor preview is left alone (its tooling injects scripts and shows
// the site inside a frame), so the CSP and anti-framing rules apply on our domains.

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.razorpay.com",
  "frame-src 'self' https://*.razorpay.com https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://iframe.mediadelivery.net",
  "media-src 'self' https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.razorpay.com",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

function isLovablePreview(host: string): boolean {
  return /(^|\.)lovable(project)?\.(app|com|dev)$/i.test(host);
}

function isLocal(host: string): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
}

export function securityHeaders(url: URL): Record<string, string> {
  const host = url.host;
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      'camera=(), microphone=(), geolocation=(), usb=(), payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com")',
    // keeps window.opener for Razorpay's bank/UPI pop-ups, isolates everything else
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  };
  if (!isLovablePreview(host)) {
    headers["Content-Security-Policy"] = isLocal(host)
      ? CSP.replace("; upgrade-insecure-requests", "")
      : CSP;
    headers["X-Frame-Options"] = "SAMEORIGIN";
  }
  if (url.protocol === "https:" && !isLovablePreview(host)) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  // never cache private pages in shared caches
  if (
    /^\/(admin|account|learn|order|checkout|cart|api\/(download|lesson-file|admin))(\/|$|\?)/.test(
      url.pathname,
    )
  ) {
    headers["Cache-Control"] = "private, no-store";
    headers["X-Robots-Tag"] = "noindex, nofollow";
  }
  return headers;
}

export function withSecurityHeaders(response: Response, url: URL): Response {
  const extra = securityHeaders(url);
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(extra)) {
    // a route's own Cache-Control (e.g. year-long caching of images) wins except on private pages
    if (k === "Cache-Control" || !headers.has(k)) headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
