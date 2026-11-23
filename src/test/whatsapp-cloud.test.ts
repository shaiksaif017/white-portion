import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppointmentRecord } from "@/lib/booking-types";
import {
  CANCEL_TEMPLATE_TEXT,
  CONFIRM_TEMPLATE_TEXT,
  cancelParams,
  confirmParams,
  fillTemplate,
} from "@/lib/whatsapp-templates";
import { sendTemplate } from "@/server/whatsapp-cloud";

const appt = {
  id: "00000000-0000-4000-8000-000000000000",
  booking_reference: "WPW-ABC123",
  full_name: "Asha Rao",
  phone: "98765 43210",
  whatsapp_number: "",
  email: "asha@example.com",
  service: "Personalised Diet Planning",
  fitness_goal: "Fat loss",
  appointment_type: "In-Person Consultation",
  appointment_date: "2026-12-01",
  appointment_time: "14:30",
  timezone: "Asia/Kolkata",
  booking_status: "Confirmed",
} as unknown as AppointmentRecord;

const settings = { businessLocation: "Studio,\nIndiranagar,     Bangalore" };

describe("WhatsApp template values", () => {
  it("fills every placeholder of the confirmation template", () => {
    const params = confirmParams(appt, settings);
    expect(params).toHaveLength(7);
    expect((CONFIRM_TEMPLATE_TEXT.match(/\{\{\d+\}\}/g) ?? []).length).toBe(7);
    const text = fillTemplate(CONFIRM_TEMPLATE_TEXT, params);
    expect(text).not.toMatch(/\{\{/);
    expect(text).toContain("Dear Asha");
    expect(text).toContain("Tuesday, 1 December 2026");
    expect(text).toContain("2:30 PM");
    expect(text).toContain("WPW-ABC123");
  });

  it("never passes new lines, tabs or 4+ spaces (WhatsApp rejects them)", () => {
    for (const v of confirmParams(appt, settings)) {
      expect(v).not.toMatch(/[\n\r\t]| {4,}/);
      expect(v.length).toBeGreaterThan(0);
    }
  });

  it("fills the cancellation template", () => {
    const params = cancelParams(appt);
    expect((CANCEL_TEMPLATE_TEXT.match(/\{\{\d+\}\}/g) ?? []).length).toBe(params.length);
    expect(fillTemplate(CANCEL_TEMPLATE_TEXT, params)).toContain("has been cancelled");
  });
});

describe("sendTemplate", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts a template message to the Cloud API", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await sendTemplate(
      "919876543210",
      "appointment_confirmed",
      ["A", "B"],
      "en",
      "12345678",
      "TOKEN",
    );
    expect(r).toEqual({ ok: true, id: "wamid.1" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://graph.facebook.com/v23.0/12345678/messages");
    expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer TOKEN");
    expect(JSON.parse(String(init.body))).toEqual({
      messaging_product: "whatsapp",
      to: "919876543210",
      type: "template",
      template: {
        name: "appointment_confirmed",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "A" },
              { type: "text", text: "B" },
            ],
          },
        ],
      },
    });
  });

  it("explains common Meta errors in plain English", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { message: "Template name does not exist", code: 132001 } }),
            { status: 404 },
          ),
      ),
    );
    const r = await sendTemplate("919876543210", "x", [], "en", "1", "T");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Template not found/);
  });

  it("reports network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const r = await sendTemplate("919876543210", "x", [], "en", "1", "T");
    expect(r).toEqual({ ok: false, error: "Could not reach WhatsApp: offline" });
  });
});
