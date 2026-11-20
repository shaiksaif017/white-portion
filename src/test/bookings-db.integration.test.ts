// Runs against a real MySQL/MariaDB only when DB_TEST=1 and DB_* variables point at
// an EMPTY throwaway database. It creates and deletes data.
//   DB_TEST=1 DB_HOST=127.0.0.1 DB_PORT=3307 DB_USER=root DB_PASSWORD=... DB_NAME=wpw_test npx vitest run bookings-db
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { addDays, nowInBusinessTz } from "@/lib/booking-logic";
import { BookingSchema, defaultBookingSettings } from "@/lib/booking-types";

const enabled = process.env["DB_TEST"] === "1";

// Next Monday–Saturday at least 2 days ahead, so "time has passed" never interferes.
function upcomingWorkingDay(): string {
  let d = addDays(nowInBusinessTz().date, 2);
  while (new Date(`${d}T00:00:00Z`).getUTCDay() === 0) d = addDays(d, 1);
  return d;
}

describe.skipIf(!enabled)("bookings against a real database", async () => {
  const bookings = await import("@/server/bookings");
  const { getDb } = await import("@/server/db");
  const date = upcomingWorkingDay();

  const input = (overrides: Record<string, unknown> = {}) =>
    BookingSchema.parse({
      fullName: "Integration Test",
      phone: "+91 90000 00000",
      email: "Test@Example.com",
      service: "Fat Loss & Weight Management",
      fitnessGoal: "Fat Loss",
      appointmentType: "Online Consultation",
      appointmentDate: date,
      appointmentTime: "11:00",
      privacyConsent: true,
      ...overrides,
    });

  beforeAll(async () => {
    const db = await getDb(); // also creates the tables
    await db.query("DELETE FROM appointments");
    await db.query("DELETE FROM notification_log");
    await bookings.saveSettings({ ...defaultBookingSettings });
  });

  afterAll(async () => {
    const db = await getDb();
    await db.end();
  });

  it("creates a booking and reports the slot as taken", async () => {
    const res = await bookings.createAppointment(input());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.appointment.booking_reference).toMatch(/^WPW-\d{4}-\d{6}$/);
    expect(res.appointment.email).toBe("test@example.com");
    expect(res.appointment.appointment_date).toBe(date);
    expect(res.appointment.booking_status).toBe("Pending");

    const slots = await bookings.getSlots(date);
    expect(slots.find((s) => s.time === "11:00")?.isAvailable).toBe(false);
    expect(slots.find((s) => s.time === "11:45")?.isAvailable).toBe(true);
  });

  it("rejects a second booking for the same slot", async () => {
    const res = await bookings.createAppointment(input({ fullName: "Second Person" }));
    expect(res.ok).toBe(false);
  });

  it("lets exactly one of many simultaneous requests win the same slot", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        bookings.createAppointment(input({ appointmentTime: "14:00", fullName: `Racer ${i}` })),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const db = await getDb();
    const [rows] = await db.query(
      "SELECT COUNT(*) AS n FROM appointments WHERE appointment_date = ? AND appointment_time = '14:00'",
      [date],
    );
    expect(Number((rows as { n: number }[])[0]?.n)).toBe(1);
  });

  it("rejects times that are not real slots, closed days and unknown services", async () => {
    expect((await bookings.createAppointment(input({ appointmentTime: "11:05" }))).ok).toBe(false);
    let sunday = date;
    while (new Date(`${sunday}T00:00:00Z`).getUTCDay() !== 0) sunday = addDays(sunday, 1);
    expect((await bookings.createAppointment(input({ appointmentDate: sunday }))).ok).toBe(false);
    expect((await bookings.createAppointment(input({ service: "Free iPhone" }))).ok).toBe(false);
  });

  it("frees the slot when cancelled, and blocks re-activating a re-booked slot", async () => {
    const list = await bookings.listAppointments();
    const first = list.find((a) => a.appointment_time === "11:00")!;

    const cancelled = await bookings.updateAppointmentStatus(first.id, "Cancelled");
    expect(cancelled.ok).toBe(true);
    expect((await bookings.getSlots(date)).find((s) => s.time === "11:00")?.isAvailable).toBe(true);

    const rebook = await bookings.createAppointment(input({ fullName: "Rebooker" }));
    expect(rebook.ok).toBe(true);

    const reactivate = await bookings.updateAppointmentStatus(first.id, "Confirmed");
    expect(reactivate.ok).toBe(false);
  });

  it("respects admin-blocked slots and saves settings", async () => {
    const s = await bookings.getSettings();
    await bookings.saveSettings({ ...s, blockedSlots: [{ date, time: "15:30" }] });
    expect((await bookings.getSlots(date)).find((x) => x.time === "15:30")?.isAvailable).toBe(false);
    expect((await bookings.createAppointment(input({ appointmentTime: "15:30" }))).ok).toBe(false);
  });

  it("logs notifications and exports safe CSV", async () => {
    await bookings.logNotification({
      type: "ADMIN_ALERT",
      recipient: "a@b.c",
      subject: "s",
      content: "c",
      status: "SKIPPED",
      error: "SMTP is not configured on the server",
    });
    expect((await bookings.listNotifications())[0]?.status).toBe("SKIPPED");

    const csv = bookings.appointmentsToCsv([
      { ...(await bookings.listAppointments())[0]!, full_name: '=HYPERLINK("x")' },
    ]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
