// Pure booking rules shared by the browser and the server. No storage, no I/O.
import type { BookingSettings, PublicBookingSettings } from "./booking-types";

// All dates and times are interpreted in the studio's own time zone, never the
// server's (Hostinger runs in UTC) or the visitor's.
export const BUSINESS_TZ = "Asia/Kolkata";

// Bookings can be made at most this far ahead.
export const MAX_DAYS_AHEAD = 120;

// A slot must start at least this many minutes from now to be bookable.
export const MIN_LEAD_MINUTES = 15;

export interface SlotAvailability {
  time: string;
  isAvailable: boolean;
  reason?: string;
}

export interface ZonedNow {
  date: string; // YYYY-MM-DD in BUSINESS_TZ
  minutes: number; // minutes since midnight in BUSINESS_TZ
}

export function nowInBusinessTz(now: Date = new Date(), timeZone: string = BUSINESS_TZ): ZonedNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function toMinutes(hhmm: string): number {
  const [h = "0", m = "0"] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Day of week (0 = Sunday) of a calendar date, independent of any time zone.
export function dayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dateStr;
}

export function generateDayTimeSlots(
  settings: Pick<
    BookingSettings,
    "startHour" | "endHour" | "slotDurationMinutes" | "bufferTimeMinutes"
  >,
): string[] {
  const startMinutes = toMinutes(settings.startHour);
  const endMinutes = toMinutes(settings.endHour);
  const step = settings.slotDurationMinutes + settings.bufferTimeMinutes;
  if (step <= 0) return [];

  const slots: string[] = [];
  for (let m = startMinutes; m + settings.slotDurationMinutes <= endMinutes; m += step) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

// Is this whole day open for booking (ignores individual slots)?
export function isBookableDate(
  dateStr: string,
  settings: Pick<PublicBookingSettings, "workingDays" | "blockedDates">,
  now: ZonedNow,
): boolean {
  if (!isValidCalendarDate(dateStr)) return false;
  if (dateStr < now.date) return false;
  if (dateStr > addDays(now.date, MAX_DAYS_AHEAD)) return false;
  if (!settings.workingDays.includes(dayOfWeek(dateStr))) return false;
  if (settings.blockedDates.includes(dateStr)) return false;
  return true;
}

export function computeSlots(
  dateStr: string,
  settings: BookingSettings,
  takenTimes: ReadonlySet<string>,
  now: ZonedNow,
): SlotAvailability[] {
  if (!isBookableDate(dateStr, settings, now)) return [];

  return generateDayTimeSlots(settings).map((time) => {
    if (dateStr === now.date && toMinutes(time) <= now.minutes + MIN_LEAD_MINUTES) {
      return { time, isAvailable: false, reason: "Time has passed" };
    }
    if (settings.blockedSlots.some((bs) => bs.date === dateStr && bs.time === time)) {
      return { time, isAvailable: false, reason: "Unavailable" };
    }
    if (takenTimes.has(time)) {
      return { time, isAvailable: false, reason: "Fully booked" };
    }
    return { time, isAvailable: true };
  });
}
