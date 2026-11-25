import { describe, expect, it } from "vitest";

import { isWeakPassword, PasswordSchema } from "@/lib/admin-types";
import { csvCell } from "@/server/csv";

describe("admin password rule", () => {
  it.each([
    "Password@123",
    "password1234",
    "Admin@12345",
    "WhitePortion2025!",
    "qwerty123456",
    "1234567890",
    "0987654321",
    "aaaaaaaaaaaa",
    "ababababab12",
  ])("refuses the guessable password %s", (p) => {
    expect(isWeakPassword(p)).toBe(true);
    expect(PasswordSchema.safeParse(p).success).toBe(false);
  });

  it.each(["correct horse battery", "mango-rickshaw-Velvet-41", "tz8#Lq2!vRw9"])(
    "accepts the strong password %s",
    (p) => expect(PasswordSchema.safeParse(p).success).toBe(true),
  );
});

describe("csv export", () => {
  it.each(['=HYPERLINK("http://evil")', "+1+1", "-2+3", "@SUM(A1)", " =cmd", "\t=1", "\r=1"])(
    "neutralises the formula %j",
    (v) => expect(csvCell(v).startsWith(`"'`)).toBe(true),
  );
  it("quotes commas, quotes and new lines", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(42)).toBe('"42"');
  });
});
