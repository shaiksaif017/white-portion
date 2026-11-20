import {
  type AppointmentRecord,
  type BookingInput,
  type BookingSettings,
  type BookingStatus,
  defaultBookingSettings,
} from "./booking-types";

// In-memory cache synced with localStorage or filesystem
let memoryAppointments: AppointmentRecord[] = [];
let memorySettings: BookingSettings = { ...defaultBookingSettings };

// Seed initial sample appointments for realistic preview/testing if empty
const sampleAppointments: AppointmentRecord[] = [
  {
    id: "sample-1",
    booking_reference: "WPW-2026-94821",
    full_name: "Alexander Wright",
    phone: "+91 98765 12345",
    whatsapp_number: "+91 98765 12345",
    email: "alexander.wright@example.com",
    age: "31",
    gender: "Male",
    service: "Muscle Building & Body Recomposition",
    fitness_goal: "Muscle Building",
    current_weight: "78 kg",
    height: "182 cm",
    training_experience: "3-5 years serious resistance training",
    dietary_preferences: "High protein, gluten conscious",
    additional_information: "Looking to break through plateau in lean mass accretion before summer.",
    appointment_type: "Online Consultation",
    appointment_date: getFutureDate(2),
    appointment_time: "11:00",
    timezone: "Asia/Kolkata (IST)",
    booking_status: "Confirmed",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "sample-2",
    booking_reference: "WPW-2026-83190",
    full_name: "Priya Sundaram",
    phone: "+91 98450 67890",
    whatsapp_number: "+91 98450 67890",
    email: "priya.sundaram@example.com",
    age: "28",
    gender: "Female",
    service: "PCOS/PCOD Nutrition Support",
    fitness_goal: "PCOS/PCOD Nutrition Support",
    training_experience: "Beginner / Yoga & brisk walking",
    dietary_preferences: "Vegetarian with dairy restriction",
    additional_information: "Diagnosed with insulin-resistant PCOS. Struggling with fatigue and irregular cycles.",
    appointment_type: "In-Person Consultation",
    appointment_date: getFutureDate(3),
    appointment_time: "14:30",
    timezone: "Asia/Kolkata (IST)",
    booking_status: "Pending",
    created_at: new Date(Date.now() - 43200000).toISOString(),
  },
];

function getFutureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split("T")[0];
}

const STORAGE_KEY_APPOINTMENTS = "wpw_appointments_store_v1";
const STORAGE_KEY_SETTINGS = "wpw_booking_settings_v1";

export function loadAppointments(): AppointmentRecord[] {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_APPOINTMENTS);
      if (stored) {
        memoryAppointments = JSON.parse(stored);
        return memoryAppointments;
      }
    } catch (e) {
      console.warn("Could not read localStorage for appointments", e);
    }
  }

  if (memoryAppointments.length === 0) {
    memoryAppointments = [...sampleAppointments];
    saveAppointments(memoryAppointments);
  }
  return memoryAppointments;
}

export function saveAppointments(records: AppointmentRecord[]): void {
  memoryAppointments = records;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_APPOINTMENTS, JSON.stringify(records));
    } catch (e) {
      console.warn("Could not write localStorage for appointments", e);
    }
  }
}

export function loadSettings(): BookingSettings {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (stored) {
        memorySettings = { ...defaultBookingSettings, ...JSON.parse(stored) };
        return memorySettings;
      }
    } catch (e) {
      console.warn("Could not read localStorage for settings", e);
    }
  }
  return memorySettings;
}

export function saveSettings(settings: BookingSettings): void {
  memorySettings = settings;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn("Could not write localStorage for settings", e);
    }
  }
}

// Generate time slots based on startHour, endHour, duration, and buffer
export function generateDayTimeSlots(settings: BookingSettings): string[] {
  const [startH, startM] = settings.startHour.split(":").map(Number);
  const [endH, endM] = settings.endHour.split(":").map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const step = settings.slotDurationMinutes + settings.bufferTimeMinutes;

  const slots: string[] = [];
  for (let m = startMinutes; m + settings.slotDurationMinutes <= endMinutes; m += step) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

export interface SlotAvailability {
  time: string;
  isAvailable: boolean;
  reason?: string;
}

export function getAvailableSlots(dateStr: string): SlotAvailability[] {
  const settings = loadSettings();
  const appointments = loadAppointments();

  // Validate date format YYYY-MM-DD
  const dateObj = new Date(`${dateStr}T00:00:00`);
  if (isNaN(dateObj.getTime())) {
    return [];
  }

  const todayStr = new Date().toISOString().split("T")[0];

  // Past dates are unavailable
  if (dateStr < todayStr) {
    return [];
  }

  // Check working day
  const dayOfWeek = dateObj.getDay();
  if (!settings.workingDays.includes(dayOfWeek)) {
    return [];
  }

  // Check blocked dates
  if (settings.blockedDates.includes(dateStr)) {
    return [];
  }

  const allSlots = generateDayTimeSlots(settings);
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();

  return allSlots.map((time) => {
    // If today, check if time has already passed
    if (dateStr === todayStr) {
      const [slotH, slotM] = time.split(":").map(Number);
      if (slotH < currentHours || (slotH === currentHours && slotM <= currentMinutes + 15)) {
        return { time, isAvailable: false, reason: "Time has passed" };
      }
    }

    // Check if slot is explicitly blocked
    const isBlocked = settings.blockedSlots.some(
      (bs) => bs.date === dateStr && bs.time === time,
    );
    if (isBlocked) {
      return { time, isAvailable: false, reason: "Blocked by administrator" };
    }

    // Check count of active bookings
    const activeBookingsCount = appointments.filter(
      (a) =>
        a.appointment_date === dateStr &&
        a.appointment_time === time &&
        a.booking_status !== "Cancelled",
    ).length;

    if (activeBookingsCount >= settings.maxBookingsPerSlot) {
      return { time, isAvailable: false, reason: "Fully booked" };
    }

    return { time, isAvailable: true };
  });
}

export function createAppointment(input: BookingInput): {
  success: boolean;
  appointment?: AppointmentRecord;
  error?: string;
} {
  const appointments = loadAppointments();
  const settings = loadSettings();

  // Check if slot is still available (double-booking protection)
  const activeBookingsCount = appointments.filter(
    (a) =>
      a.appointment_date === input.appointmentDate &&
      a.appointment_time === input.appointmentTime &&
      a.booking_status !== "Cancelled",
  ).length;

  if (activeBookingsCount >= settings.maxBookingsPerSlot) {
    return {
      success: false,
      error: "This time slot was just booked by another client. Please select another slot.",
    };
  }

  const randomRef = Math.floor(10000 + Math.random() * 90000);
  const year = new Date().getFullYear();
  const bookingReference = `WPW-${year}-${randomRef}`;
  const id = `apt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newRecord: AppointmentRecord = {
    id,
    booking_reference: bookingReference,
    full_name: input.fullName.trim(),
    phone: input.phone.trim(),
    whatsapp_number: input.whatsappNumber?.trim() || input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    age: input.age?.trim(),
    gender: input.gender?.trim(),
    service: input.service,
    fitness_goal: input.fitnessGoal,
    current_weight: input.currentWeight?.trim(),
    height: input.height?.trim(),
    training_experience: input.trainingExperience?.trim(),
    dietary_preferences: input.dietaryPreferences?.trim(),
    additional_information: input.additionalInformation?.trim(),
    appointment_type: input.appointmentType,
    appointment_date: input.appointmentDate,
    appointment_time: input.appointmentTime,
    timezone: settings.businessTimezone,
    booking_status: "Pending",
    created_at: new Date().toISOString(),
  };

  const updated = [newRecord, ...appointments];
  saveAppointments(updated);

  return {
    success: true,
    appointment: newRecord,
  };
}

export function updateAppointmentStatus(
  id: string,
  newStatus: BookingStatus,
  notes?: string,
): boolean {
  const appointments = loadAppointments();
  const index = appointments.findIndex((a) => a.id === id);
  if (index === -1) return false;

  appointments[index] = {
    ...appointments[index],
    booking_status: newStatus,
    ...(notes !== undefined ? { notes } : {}),
  };
  saveAppointments(appointments);
  return true;
}

export function blockSlot(date: string, time: string): void {
  const settings = loadSettings();
  const exists = settings.blockedSlots.some((s) => s.date === date && s.time === time);
  if (!exists) {
    settings.blockedSlots.push({ date, time });
    saveSettings(settings);
  }
}

export function unblockSlot(date: string, time: string): void {
  const settings = loadSettings();
  settings.blockedSlots = settings.blockedSlots.filter(
    (s) => !(s.date === date && s.time === time),
  );
  saveSettings(settings);
}

export function exportAppointmentsCSV(): string {
  const appointments = loadAppointments();
  const headers = [
    "Reference",
    "Date",
    "Time",
    "Status",
    "Type",
    "Client Name",
    "Email",
    "Phone",
    "Service",
    "Goal",
    "Created At",
  ];

  const rows = appointments.map((a) => [
    `"${a.booking_reference}"`,
    `"${a.appointment_date}"`,
    `"${a.appointment_time}"`,
    `"${a.booking_status}"`,
    `"${a.appointment_type}"`,
    `"${a.full_name}"`,
    `"${a.email}"`,
    `"${a.phone}"`,
    `"${a.service}"`,
    `"${a.fitness_goal}"`,
    `"${a.created_at}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
