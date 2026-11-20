// Booking data access. Every rule that matters (valid slot, no double booking)
// is enforced here on the server; the browser is never trusted.
import { randomBytes, randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { computeSlots, nowInBusinessTz, type SlotAvailability } from "@/lib/booking-logic";
import {
  type AppointmentRecord,
  type AppointmentType,
  type BookingSettings,
  type BookingStatus,
  BookingSchema,
  BookingSettingsSchema,
  defaultBookingSettings,
  FITNESS_GOALS,
  SERVICES_LIST,
} from "@/lib/booking-types";
import type { NotificationLog } from "@/lib/notifications";
import { getDb, isDuplicateKeyError } from "./db";

type ParsedBooking = ReturnType<typeof BookingSchema.parse>;

// ---------- settings ----------

export async function getSettings(): Promise<BookingSettings> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>("SELECT data FROM booking_settings WHERE id = 1");
  const raw = rows[0]?.["data"];
  if (typeof raw !== "string") return { ...defaultBookingSettings };
  try {
    const parsed = BookingSettingsSchema.safeParse({
      ...defaultBookingSettings,
      ...JSON.parse(raw),
    });
    return parsed.success ? parsed.data : { ...defaultBookingSettings };
  } catch {
    return { ...defaultBookingSettings };
  }
}

export async function saveSettings(settings: BookingSettings): Promise<BookingSettings> {
  const valid = BookingSettingsSchema.parse(settings);
  const db = await getDb();
  await db.query(
    "INSERT INTO booking_settings (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)",
    [JSON.stringify(valid)],
  );
  return valid;
}

// ---------- availability ----------

async function takenTimesOn(date: string): Promise<Set<string>> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT appointment_time FROM appointments WHERE appointment_date = ? AND booking_status <> 'Cancelled'",
    [date],
  );
  return new Set(rows.map((r) => String(r["appointment_time"])));
}

export async function getSlots(
  date: string,
  settings?: BookingSettings,
): Promise<SlotAvailability[]> {
  const s = settings ?? (await getSettings());
  return computeSlots(date, s, await takenTimesOn(date), nowInBusinessTz());
}

// ---------- appointments ----------

function str(v: unknown): string | undefined {
  return v === null || v === undefined || v === "" ? undefined : String(v);
}

function toRecord(r: RowDataPacket): AppointmentRecord {
  return {
    id: String(r["id"]),
    booking_reference: String(r["booking_reference"]),
    full_name: String(r["full_name"]),
    phone: String(r["phone"]),
    whatsapp_number: str(r["whatsapp_number"]),
    email: String(r["email"]),
    age: str(r["age"]),
    gender: str(r["gender"]),
    service: String(r["service"]),
    fitness_goal: String(r["fitness_goal"]),
    current_weight: str(r["current_weight"]),
    height: str(r["height"]),
    training_experience: str(r["training_experience"]),
    dietary_preferences: str(r["dietary_preferences"]),
    additional_information: str(r["additional_information"]),
    appointment_type: String(r["appointment_type"]) as AppointmentType,
    appointment_date: String(r["appointment_date"]).slice(0, 10),
    appointment_time: String(r["appointment_time"]),
    timezone: String(r["timezone"]),
    booking_status: String(r["booking_status"]) as BookingStatus,
    // stored as UTC "YYYY-MM-DD HH:MM:SS"
    created_at: `${String(r["created_at"]).replace(" ", "T")}Z`,
    notes: str(r["notes"]),
  };
}

export async function listAppointments(limit = 1000): Promise<AppointmentRecord[]> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM appointments ORDER BY appointment_date DESC, appointment_time DESC LIMIT ?",
    [limit],
  );
  return rows.map(toRecord);
}

export async function getAppointment(id: string): Promise<AppointmentRecord | null> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM appointments WHERE id = ?", [id]);
  return rows[0] ? toRecord(rows[0]) : null;
}

function newReference(): string {
  const year = new Date().getUTCFullYear();
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return `WPW-${year}-${String(n).padStart(6, "0")}`;
}

export type CreateResult =
  | { ok: true; appointment: AppointmentRecord; settings: BookingSettings }
  | { ok: false; error: string };

export async function createAppointment(input: ParsedBooking): Promise<CreateResult> {
  if (!SERVICES_LIST.some((s) => s.title === input.service)) {
    return { ok: false, error: "Please choose a service from the list." };
  }
  if (!(FITNESS_GOALS as readonly string[]).includes(input.fitnessGoal)) {
    return { ok: false, error: "Please choose a fitness goal from the list." };
  }

  const settings = await getSettings();
  const slots = await getSlots(input.appointmentDate, settings);
  const slot = slots.find((s) => s.time === input.appointmentTime);
  if (!slot) {
    return {
      ok: false,
      error: "That date or time is not open for booking. Please choose another slot.",
    };
  }
  if (!slot.isAvailable) {
    return { ok: false, error: "This time slot was just booked. Please select another slot." };
  }

  const db = await getDb();
  const id = randomUUID();

  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = newReference();
    try {
      await db.query(
        `INSERT INTO appointments (
          id, booking_reference, full_name, phone, whatsapp_number, email, age, gender,
          service, fitness_goal, current_weight, height, training_experience,
          dietary_preferences, additional_information, appointment_type,
          appointment_date, appointment_time, timezone, booking_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
        [
          id,
          reference,
          input.fullName,
          input.phone,
          input.whatsappNumber || input.phone,
          input.email.toLowerCase(),
          input.age || null,
          input.gender || null,
          input.service,
          input.fitnessGoal,
          input.currentWeight || null,
          input.height || null,
          input.trainingExperience || null,
          input.dietaryPreferences || null,
          input.additionalInformation || null,
          input.appointmentType,
          input.appointmentDate,
          input.appointmentTime,
          settings.businessTimezone,
        ],
      );
      const appointment = await getAppointment(id);
      if (!appointment)
        return { ok: false, error: "Booking could not be saved. Please try again." };
      return { ok: true, appointment, settings };
    } catch (error) {
      if (isDuplicateKeyError(error, "uniq_active_slot")) {
        return { ok: false, error: "This time slot was just booked. Please select another slot." };
      }
      if (isDuplicateKeyError(error, "uniq_booking_reference")) continue; // retry with a new reference
      throw error;
    }
  }
  return { ok: false, error: "Booking could not be saved. Please try again." };
}

export type UpdateResult =
  | { ok: true; appointment: AppointmentRecord; previousStatus: BookingStatus }
  | { ok: false; error: string };

export async function updateAppointmentStatus(
  id: string,
  status: BookingStatus,
): Promise<UpdateResult> {
  const before = await getAppointment(id);
  if (!before) return { ok: false, error: "Booking not found." };
  const db = await getDb();
  try {
    await db.query("UPDATE appointments SET booking_status = ? WHERE id = ?", [status, id]);
  } catch (error) {
    if (isDuplicateKeyError(error, "uniq_active_slot")) {
      return { ok: false, error: "Another active booking already holds this date and time." };
    }
    throw error;
  }
  const appointment = await getAppointment(id);
  if (!appointment) return { ok: false, error: "Booking not found." };
  return { ok: true, appointment, previousStatus: before.booking_status };
}

export async function updateAppointmentNotes(id: string, notes: string): Promise<boolean> {
  const db = await getDb();
  const [result] = await db.query<ResultSetHeader>(
    "UPDATE appointments SET notes = ? WHERE id = ?",
    [notes || null, id],
  );
  return result.affectedRows > 0;
}

// ---------- notification log ----------

export async function logNotification(
  entry: Omit<NotificationLog, "id" | "sentAt">,
): Promise<void> {
  const db = await getDb();
  await db.query(
    "INSERT INTO notification_log (type, recipient, subject, content, status, error) VALUES (?, ?, ?, ?, ?, ?)",
    [
      entry.type,
      entry.recipient.slice(0, 254),
      entry.subject.slice(0, 300),
      entry.content,
      entry.status,
      entry.error?.slice(0, 500) ?? null,
    ],
  );
}

export async function listNotifications(limit = 100): Promise<NotificationLog[]> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM notification_log ORDER BY id DESC LIMIT ?",
    [limit],
  );
  return rows.map((r) => ({
    id: String(r["id"]),
    type: String(r["type"]) as NotificationLog["type"],
    recipient: String(r["recipient"]),
    subject: String(r["subject"]),
    content: String(r["content"]),
    status: String(r["status"]) as NotificationLog["status"],
    error: str(r["error"]),
    sentAt: `${String(r["created_at"]).replace(" ", "T")}Z`,
  }));
}

// ---------- CSV ----------

function csvCell(value: unknown): string {
  let s = value === undefined || value === null ? "" : String(value);
  // Stop spreadsheet apps from treating a cell as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function appointmentsToCsv(appointments: AppointmentRecord[]): string {
  const headers = [
    "Reference",
    "Date",
    "Time",
    "Status",
    "Type",
    "Client Name",
    "Email",
    "Phone",
    "WhatsApp",
    "Service",
    "Goal",
    "Notes",
    "Created At",
  ];
  const rows = appointments.map((a) =>
    [
      a.booking_reference,
      a.appointment_date,
      a.appointment_time,
      a.booking_status,
      a.appointment_type,
      a.full_name,
      a.email,
      a.phone,
      a.whatsapp_number,
      a.service,
      a.fitness_goal,
      a.notes,
      a.created_at,
    ]
      .map(csvCell)
      .join(","),
  );
  return [headers.map(csvCell).join(","), ...rows].join("\r\n");
}
