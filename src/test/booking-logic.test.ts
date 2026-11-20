import { describe, expect, it } from "vitest";

import {
  computeSlots,
  generateDayTimeSlots,
  isBookableDate,
  nowInBusinessTz,
} from "@/lib/booking-logic";
import { BookingSchema, defaultBookingSettings } from "@/lib/booking-types";

const settings = { ...defaultBookingSettings }; // Mon–Sat, 09:30–18:30, 30 min + 15 buffer

describe("nowInBusinessTz", () => {
  it("uses India time, not UTC", () => {
    // 20:00 UTC on 1 Jan is 01:30 on 2 Jan in India.
    expect(nowInBusinessTz(new Date("2026-01-01T20:00:00Z"))).toEqual({
      date: "2026-01-02",
      minutes: 90,
    });
  });
});

describe("generateDayTimeSlots", () => {
  it("steps by duration + buffer and never runs past closing", () => {
    const slots = generateDayTimeSlots(settings);
    expect(slots[0]).toBe("09:30");
    expect(slots[1]).toBe("10:15");
    expect(slots.at(-1)).toBe("17:45"); // 17:45 + 30 = 18:15 <= 18:30; next would be 18:30
  });
});

describe("isBookableDate", () => {
  const now = { date: "2026-11-23", minutes: 600 }; // a Monday, 10:00

  it("rejects past dates, Sundays, blocked dates and invalid dates", () => {
    expect(isBookableDate("2026-11-22", settings, now)).toBe(false); // yesterday (Sunday)
    expect(isBookableDate("2026-11-29", settings, now)).toBe(false); // Sunday
    expect(isBookableDate("2026-02-30", settings, now)).toBe(false); // no such day
    expect(
      isBookableDate("2026-11-24", { ...settings, blockedDates: ["2026-11-24"] }, now),
    ).toBe(false);
    expect(isBookableDate("2027-12-01", settings, now)).toBe(false); // too far ahead
  });

  it("accepts an upcoming working day", () => {
    expect(isBookableDate("2026-11-24", settings, now)).toBe(true);
  });
});

describe("computeSlots", () => {
  const now = { date: "2026-11-23", minutes: 600 }; // Monday 10:00

  it("marks taken, blocked and already-passed slots unavailable", () => {
    const slots = computeSlots(
      "2026-11-23",
      { ...settings, blockedSlots: [{ date: "2026-11-23", time: "12:30" }] },
      new Set(["11:00"]),
      now,
    );
    const byTime = Object.fromEntries(slots.map((s) => [s.time, s]));
    expect(byTime["09:30"]?.isAvailable).toBe(false); // passed
    expect(byTime["10:15"]?.isAvailable).toBe(false); // within 15-minute lead time
    expect(byTime["11:00"]?.reason).toBe("Fully booked");
    expect(byTime["12:30"]?.isAvailable).toBe(false); // blocked by admin
    expect(byTime["11:45"]?.isAvailable).toBe(true);
  });

  it("returns nothing for a closed day", () => {
    expect(computeSlots("2026-11-29", settings, new Set(), now)).toEqual([]);
  });
});

describe("BookingSchema", () => {
  const valid = {
    fullName: "Test Client",
    phone: "+91 98765 43210",
    email: "client@example.com",
    service: "Fat Loss & Weight Management",
    fitnessGoal: "Fat Loss",
    appointmentType: "Online Consultation",
    appointmentDate: "2026-11-24",
    appointmentTime: "11:00",
    privacyConsent: true,
  };

  it("accepts a normal booking", () => {
    expect(BookingSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects missing consent, bad email and newline injection", () => {
    expect(BookingSchema.safeParse({ ...valid, privacyConsent: false }).success).toBe(false);
    expect(BookingSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(
      BookingSchema.safeParse({ ...valid, fullName: "Eve\r\nBcc: victim@example.com" }).success,
    ).toBe(false);
  });
});
