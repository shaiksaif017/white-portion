import { beforeAll, describe, expect, it } from "vitest";

import { formatMinutes, LessonInputSchema, parseVideoUrl, percent } from "@/lib/course-types";

describe("parseVideoUrl", () => {
  it("accepts YouTube links in their common shapes", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    ]) {
      expect(parseVideoUrl(url)).toEqual({
        provider: "youtube",
        embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1",
      });
    }
  });

  it("accepts Vimeo (incl. private hash) and Bunny Stream", () => {
    expect(parseVideoUrl("https://vimeo.com/123456789")?.embedUrl).toBe(
      "https://player.vimeo.com/video/123456789",
    );
    expect(parseVideoUrl("https://vimeo.com/123456789/abcdef1234")?.embedUrl).toBe(
      "https://player.vimeo.com/video/123456789?h=abcdef1234",
    );
    expect(
      parseVideoUrl(
        "https://iframe.mediadelivery.net/embed/12345/0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0",
      )?.provider,
    ).toBe("bunny");
  });

  it("rejects anything else, including script and non-https links", () => {
    for (const bad of [
      "",
      "javascript:alert(1)",
      "http://youtu.be/dQw4w9WgXcQ",
      "https://evil.example/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=short",
      "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    ]) {
      expect(parseVideoUrl(bad)).toBeNull();
    }
    expect(
      LessonInputSchema.safeParse({
        title: "x",
        description: "",
        videoUrl: "https://evil.example/x",
        durationMinutes: 1,
        isPreview: false,
        attachmentFileId: null,
      }).success,
    ).toBe(false);
  });

  it("formats progress and durations", () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(1, 3)).toBe(33);
    expect(formatMinutes(75)).toBe("1 h 15 min");
    expect(formatMinutes(9)).toBe("9 min");
  });
});

describe("customer session cookie", () => {
  let customers: typeof import("@/server/customers");

  beforeAll(async () => {
    process.env["SESSION_SECRET"] = "x".repeat(40);
    process.env["ADMIN_PASSWORD_HASH"] = "scrypt:00:00";
    customers = await import("@/server/customers");
  });

  it("signs tokens that can't be edited or reused after expiry", async () => {
    const now = Date.now();
    const token = customers.createCustomerToken(7, 1, now);
    const [id, version, expires, sig] = token.split(".");
    expect([id, version]).toEqual(["7", "1"]);
    expect(Number(expires)).toBeGreaterThan(now);
    // changing the customer id breaks the signature (no database needed to reject it)
    expect(await customers.customerFromToken(`8.1.${expires}.${sig}`)).toBeNull();
    expect(await customers.customerFromToken("garbage")).toBeNull();
    const old = customers.createCustomerToken(7, 1, now - 31 * 86_400_000);
    expect(await customers.customerFromToken(old)).toBeNull();
  });
});
