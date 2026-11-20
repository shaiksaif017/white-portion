import { z } from "zod";

export type BookingStatus = "Pending" | "Confirmed" | "Cancelled" | "Completed";
export type AppointmentType = "Online Consultation" | "In-Person Consultation";

export const BookingSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().min(6, "Valid phone number is required"),
  whatsappNumber: z.string().optional(),
  email: z.string().email("Please provide a valid email address"),
  age: z.string().optional(),
  gender: z.string().optional(),
  service: z.string().min(1, "Please select a service"),
  fitnessGoal: z.string().min(1, "Please select your primary fitness goal"),
  currentWeight: z.string().optional(),
  height: z.string().optional(),
  trainingExperience: z.string().optional(),
  dietaryPreferences: z.string().optional(),
  additionalInformation: z.string().optional(),
  appointmentType: z.enum(["Online Consultation", "In-Person Consultation"]),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Valid date required (YYYY-MM-DD)"),
  appointmentTime: z.string().regex(/^\d{2}:\d{2}$/, "Valid time required (HH:MM)"),
  timezone: z.string().default("Asia/Kolkata"),
  privacyConsent: z.boolean().refine((val) => val === true, {
    message: "You must agree to the privacy consent to proceed",
  }),
});

export type BookingInput = z.infer<typeof BookingSchema>;

export interface AppointmentRecord {
  id: string;
  booking_reference: string;
  full_name: string;
  phone: string;
  whatsapp_number?: string;
  email: string;
  age?: string;
  gender?: string;
  service: string;
  fitness_goal: string;
  current_weight?: string;
  height?: string;
  training_experience?: string;
  dietary_preferences?: string;
  additional_information?: string;
  appointment_type: AppointmentType;
  appointment_date: string;
  appointment_time: string;
  timezone: string;
  booking_status: BookingStatus;
  created_at: string;
  notes?: string;
}

export interface BookingSettings {
  workingDays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  startHour: string; // "09:00"
  endHour: string; // "19:00"
  slotDurationMinutes: number; // 30
  bufferTimeMinutes: number; // 15
  maxBookingsPerSlot: number; // 1
  businessTimezone: string;
  businessLocation: string;
  businessWhatsapp: string;
  adminNotificationEmail: string;
  blockedDates: string[]; // ["2026-12-25"]
  blockedSlots: { date: string; time: string }[];
}

export const defaultBookingSettings: BookingSettings = {
  workingDays: [1, 2, 3, 4, 5, 6], // Monday to Saturday
  startHour: "09:30",
  endHour: "18:30",
  slotDurationMinutes: 30,
  bufferTimeMinutes: 15,
  maxBookingsPerSlot: 1,
  businessTimezone: "Asia/Kolkata (IST)",
  businessLocation: "White Portion Wellness Private Coaching Studio, Indiranagar, Bangalore",
  businessWhatsapp: "+919876543210",
  adminNotificationEmail: "concierge@whiteportionwellness.com",
  blockedDates: [],
  blockedSlots: [],
};

export const SERVICES_LIST = [
  {
    id: "personalised-diet",
    title: "Personalised Diet & Nutrition Planning",
    tagline: "Macronutrient periodization & bio-individual strategy",
    description: "Detailed metabolic evaluation, personalized meal blueprints, and tailored grocery protocols for sustained physique and vitality.",
  },
  {
    id: "bodybuilding-prep",
    title: "Bodybuilding & Contest Preparation",
    tagline: "Stage conditioning & surgical peak week protocols",
    description: "Strict 16-24 week staged deficit, carb/water/sodium manipulation, posing critique, and endocrine reverse recovery.",
  },
  {
    id: "muscle-building",
    title: "Muscle Building & Body Recomposition",
    tagline: "Lean hypertrophy, leucine thresholds & strength progression",
    description: "Caloric periodization engineered to build dense muscle mass while keeping adipose storage strictly minimal.",
  },
  {
    id: "fat-loss",
    title: "Fat Loss & Weight Management",
    tagline: "Metabolic rate protection & muscle sparing",
    description: "A calculated, comfortable deficit with regular diet breaks and structured refeeds to safeguard thyroid and hormonal function.",
  },
  {
    id: "womens-nutrition",
    title: "Women's Nutrition & Wellness",
    tagline: "Cycle-synced nutrition & hormonal equilibrium",
    description: "Infradian rhythm nutrition, adrenal cortisol balancing, thyroid recovery, and sustainable feminine body recomposition.",
  },
  {
    id: "pcos-pcod",
    title: "PCOS/PCOD Nutrition Support",
    tagline: "Insulin sensitivity & root-cause endocrine care",
    description: "Clinical low-glycemic meal structures, androgen regulation, anti-inflammatory protocols, and ovulatory restoration.",
  },
  {
    id: "sports-nutrition",
    title: "Sports & Performance Nutrition",
    tagline: "High power output & accelerated muscular recovery",
    description: "Intra-workout glycogen fueling, electrolyte optimization, and athletic endurance recovery systems.",
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
