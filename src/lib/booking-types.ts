import { z } from "zod";

export type BookingStatus = "Pending" | "Confirmed" | "Cancelled" | "Completed";
export type AppointmentType = "Online Consultation" | "In-Person Consultation";

// No control characters (blocks header injection in emails) and sensible lengths.
const safeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
    .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), "Contains invalid characters");
const safeMultiline = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
      (v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v),
      "Contains invalid characters",
    );
const optionalText = (max: number) => safeText(max).optional();

export const BookingSchema = z.object({
  fullName: safeText(120).pipe(z.string().min(2, "Full name must be at least 2 characters")),
  phone: safeText(30).pipe(
    z.string().regex(/^[+0-9 ()-]{6,30}$/, "Valid phone number is required"),
  ),
  whatsappNumber: safeText(30)
    .pipe(z.string().regex(/^[+0-9 ()-]{0,30}$/, "Valid WhatsApp number is required"))
    .optional(),
  email: safeText(254).pipe(z.string().email("Please provide a valid email address")),
  age: optionalText(10),
  gender: optionalText(30),
  service: safeText(120).pipe(z.string().min(1, "Please select a service")),
  fitnessGoal: safeText(80).pipe(z.string().min(1, "Please select your primary fitness goal")),
  currentWeight: optionalText(30),
  height: optionalText(30),
  trainingExperience: safeMultiline(500).optional(),
  dietaryPreferences: safeMultiline(500).optional(),
  additionalInformation: safeMultiline(2000).optional(),
  appointmentType: z.enum(["Online Consultation", "In-Person Consultation"]),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Valid date required (YYYY-MM-DD)"),
  appointmentTime: z.string().regex(/^\d{2}:\d{2}$/, "Valid time required (HH:MM)"),
  timezone: z.string().max(60).optional(),
  privacyConsent: z.boolean().refine((val) => val === true, {
    message: "You must agree to the privacy consent to proceed",
  }),
});

export type BookingInput = z.input<typeof BookingSchema>;

export interface AppointmentRecord {
  id: string;
  booking_reference: string;
  full_name: string;
  phone: string;
  whatsapp_number?: string | undefined;
  email: string;
  age?: string | undefined;
  gender?: string | undefined;
  service: string;
  fitness_goal: string;
  current_weight?: string | undefined;
  height?: string | undefined;
  training_experience?: string | undefined;
  dietary_preferences?: string | undefined;
  additional_information?: string | undefined;
  appointment_type: AppointmentType;
  appointment_date: string;
  appointment_time: string;
  timezone: string;
  booking_status: BookingStatus;
  created_at: string;
  notes?: string | undefined;
}

export interface BookingSettings {
  workingDays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  startHour: string; // "09:00"
  endHour: string; // "19:00"
  slotDurationMinutes: number; // 30
  bufferTimeMinutes: number; // 15
  businessTimezone: string; // display label, e.g. "Asia/Kolkata (IST)"
  businessLocation: string;
  adminNotificationEmail: string;
  blockedDates: string[]; // ["2026-12-25"]
  blockedSlots: { date: string; time: string }[];
}

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const BookingSettingsSchema = z
  .object({
    workingDays: z.array(z.number().int().min(0).max(6)).max(7),
    startHour: hhmm,
    endHour: hhmm,
    slotDurationMinutes: z.number().int().min(10).max(240),
    bufferTimeMinutes: z.number().int().min(0).max(120),
    businessTimezone: safeText(60),
    businessLocation: safeText(300),
    adminNotificationEmail: safeText(254).pipe(z.string().email("Enter a valid admin email")),
    blockedDates: z.array(ymd).max(500),
    blockedSlots: z.array(z.object({ date: ymd, time: hhmm })).max(2000),
  })
  .refine((s) => s.startHour < s.endHour, { message: "Start time must be before end time" });

// What the public booking page is allowed to see (no admin email, no blocked-slot list).
export type PublicBookingSettings = Omit<
  BookingSettings,
  "adminNotificationEmail" | "blockedSlots"
>;

export function toPublicSettings(s: BookingSettings): PublicBookingSettings {
  const { adminNotificationEmail: _a, blockedSlots: _b, ...rest } = s;
  return rest;
}

export const defaultBookingSettings: BookingSettings = {
  workingDays: [1, 2, 3, 4, 5, 6], // Monday to Saturday
  startHour: "09:30",
  endHour: "18:30",
  slotDurationMinutes: 30,
  bufferTimeMinutes: 15,
  businessTimezone: "Asia/Kolkata (IST)",
  businessLocation: "White Portion Wellness Private Coaching Studio, Indiranagar, Bangalore",
  adminNotificationEmail: "concierge@whiteportionwellness.com",
  blockedDates: [],
  blockedSlots: [],
};

export const SERVICES_LIST = [
  {
    id: "personalised-diet",
    title: "Personalised Diet & Nutrition Planning",
    tagline: "Macronutrient periodization & bio-individual strategy",
    description:
      "Detailed metabolic evaluation, personalized meal blueprints, and tailored grocery protocols for sustained physique and vitality.",
  },
  {
    id: "bodybuilding-prep",
    title: "Bodybuilding & Contest Preparation",
    tagline: "Stage conditioning & surgical peak week protocols",
    description:
      "Strict 16-24 week staged deficit, carb/water/sodium manipulation, posing critique, and endocrine reverse recovery.",
  },
  {
    id: "muscle-building",
    title: "Muscle Building & Body Recomposition",
    tagline: "Lean hypertrophy, leucine thresholds & strength progression",
    description:
      "Caloric periodization engineered to build dense muscle mass while keeping adipose storage strictly minimal.",
  },
  {
    id: "fat-loss",
    title: "Fat Loss & Weight Management",
    tagline: "Metabolic rate protection & muscle sparing",
    description:
      "A calculated, comfortable deficit with regular diet breaks and structured refeeds to safeguard thyroid and hormonal function.",
  },
  {
    id: "womens-nutrition",
    title: "Women's Nutrition & Wellness",
    tagline: "Cycle-synced nutrition & hormonal equilibrium",
    description:
      "Infradian rhythm nutrition, adrenal cortisol balancing, thyroid recovery, and sustainable feminine body recomposition.",
  },
  {
    id: "pcos-pcod",
    title: "PCOS/PCOD Nutrition Support",
    tagline: "Insulin sensitivity & root-cause endocrine care",
    description:
      "Clinical low-glycemic meal structures, androgen regulation, anti-inflammatory protocols, and ovulatory restoration.",
  },
  {
    id: "sports-nutrition",
    title: "Sports & Performance Nutrition",
    tagline: "High power output & accelerated muscular recovery",
    description:
      "Intra-workout glycogen fueling, electrolyte optimization, and athletic endurance recovery systems.",
  },
] as const;

export const FITNESS_GOALS = [
  "Fat Loss",
  "Muscle Building",
  "Body Recomposition",
  "Bodybuilding Competition Preparation",
  "General Fitness",
  "Nutrition & Wellness",
  "PCOS/PCOD Nutrition Support",
  "Other",
] as const;
