import { describe, expect, it } from "vitest";

import type { AppointmentRecord } from "@/lib/booking-types";
import {
  buildConfirmation,
  buildCustomerWhatsAppConfirmation,
  formatTime12h,
  customerWhatsAppConfirmationUrl,
  toWhatsAppDigits,
} from "@/lib/notifications";
import { whatsappUrl } from "@/lib/whatsapp";

describe("toWhatsAppDigits", () => {
  it("normalises the ways customers type Indian numbers", () => {
    expect(toWhatsAppDigits("98765 43210")).toBe("919876543210");
    expect(toWhatsAppDigits("098765 43210")).toBe("919876543210");
    expect(toWhatsAppDigits("+91 98765-43210")).toBe("919876543210");
    expect(toWhatsAppDigits("0091 98765 43210")).toBe("919876543210");
    expect(toWhatsAppDigits("+44 7700 900123")).toBe("447700900123");
  });

  it("rejects unusable numbers", () => {
    expect(toWhatsAppDigits("12345")).toBeNull();
    expect(toWhatsAppDigits("")).toBeNull();
    expect(toWhatsAppDigits(undefined)).toBeNull();
  });
});

describe("customer WhatsApp confirmation", () => {
  const appt: AppointmentRecord = {
    id: "x",
    booking_reference: "WPW-2026-123456",
    full_name: "Priya Sundaram",
    phone: "98450 67890",
    whatsapp_number: "98450 11111",
    email: "p@example.com",
    service: "PCOS/PCOD Nutrition Support",
    fitness_goal: "PCOS/PCOD Nutrition Support",
    appointment_type: "In-Person Consultation",
    appointment_date: "2026-11-24",
    appointment_time: "11:00",
    timezone: "Asia/Kolkata (IST)",
    booking_status: "Confirmed",
    created_at: "2026-11-20T10:00:00Z",
  };
  const settings = { businessLocation: "Studio, Bangalore" };

  it("writes a clear confirmation with the key details", () => {
    const msg = buildCustomerWhatsAppConfirmation(appt, settings);
    expect(msg).toContain("Dear Priya");
    expect(msg).toContain("Thank you for choosing *White Portion Wellness*");
    expect(msg).toContain("*confirmed*");
    expect(msg).toContain("WPW-2026-123456");
    expect(msg).toContain("Date: Tuesday, 24 November 2026");
    expect(msg).toContain("Time: 11:00 AM (India Standard Time)");
    expect(msg).toContain("Location: Studio, Bangalore");
  });

  it("sends a professional confirmation email (text + HTML) with escaped details", () => {
    const email = buildConfirmation(
      { ...appt, full_name: "Priya <script>" },
      { ...settings, adminNotificationEmail: "care@x.com" },
    );
    expect(email.to).toBe("p@example.com");
    expect(email.subject).toBe(
      "Appointment Confirmed: Tuesday, 24 November 2026 at 11:00 AM | White Portion Wellness",
    );
    expect(email.text).toContain("Thank you for choosing White Portion Wellness.");
    expect(email.text).toContain("Time: 11:00 AM (India Standard Time)");
    expect(email.html).toContain("APPOINTMENT CONFIRMED");
    expect(email.html).toContain("Studio, Bangalore");
    expect(email.html).not.toContain("<script>");
  });

  it("formats times in 12-hour style", () => {
    expect(formatTime12h("09:30")).toBe("9:30 AM");
    expect(formatTime12h("12:00")).toBe("12:00 PM");
    expect(formatTime12h("17:45")).toBe("5:45 PM");
  });

  it("messages the customer's WhatsApp number, falling back to phone", () => {
    expect(customerWhatsAppConfirmationUrl(appt, settings)).toMatch(
      /^https:\/\/wa\.me\/919845011111\?text=/,
    );
    const noWa = { ...appt, whatsapp_number: undefined };
    expect(customerWhatsAppConfirmationUrl(noWa, settings)).toMatch(
      /^https:\/\/wa\.me\/919845067890\?/,
    );
    expect(customerWhatsAppConfirmationUrl({ ...noWa, phone: "123" }, settings)).toBeNull();
  });
});

describe("business WhatsApp link", () => {
  it("uses the real business number", () => {
    expect(whatsappUrl("hi")).toBe("https://wa.me/919000193486?text=hi");
  });
});
