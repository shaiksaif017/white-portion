// Shared admin check for server functions and server routes.
import { getCookie } from "@tanstack/react-start/server";

import { SESSION_COOKIE, verifySessionToken } from "./auth";

export function isAdminRequest(): boolean {
  return verifySessionToken(getCookie(SESSION_COOKIE));
}

// Blocks cross-site form posts to raw server routes (server functions already have CSRF protection).
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    return (
      new URL(origin).host === new URL(request.url).host ||
      new URL(origin).host === request.headers.get("host")
    );
  } catch {
    return false;
  }
}
