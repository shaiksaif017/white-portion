// Admin roles and permissions (browser + server). The server enforces these on every
// admin action; the browser only uses them to hide tabs a person can't use.
import { z } from "zod";

export type AdminRole = "owner" | "manager" | "staff";

export type Permission =
  | "bookings" // see and confirm/cancel appointments
  | "booking_settings" // working hours and blocked slots
  | "orders" // see and fulfil orders
  | "refunds" // mark orders refunded
  | "products" // catalogue, coupons, courses, students, sample data
  | "dashboard" // sales figures
  | "settings" // payment keys, email password, WhatsApp, shipping
  | "users" // add/remove admins, roles, sign people out
  | "audit"; // read the audit log

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  owner: [
    "bookings",
    "booking_settings",
    "orders",
    "refunds",
    "products",
    "dashboard",
    "settings",
    "users",
    "audit",
  ],
  manager: ["bookings", "booking_settings", "orders", "refunds", "products", "dashboard"],
  staff: ["bookings", "orders"],
};

export const ROLE_LABEL: Record<AdminRole, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
};

export const ROLE_DESCRIPTION: Record<AdminRole, string> = {
  owner: "Everything, including payments, email, team members and the audit log.",
  manager: "Products, courses, coupons, orders and refunds, bookings and the sales dashboard.",
  staff: "Bookings and order fulfilment only.",
};

export function can(role: AdminRole, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(perm);
}

export const PASSWORD_RULE = "At least 10 characters";
// The first thing attackers try: common words with digits/symbols tacked on
// ("Password@123", "WhitePortion2025!", "qwerty12345").
const COMMON_PASSWORD_WORDS = new Set([
  "password",
  "passw",
  "pass",
  "admin",
  "administrator",
  "welcome",
  "qwerty",
  "qwertyuiop",
  "asdf",
  "asdfgh",
  "zxcvbn",
  "letmein",
  "iloveyou",
  "login",
  "secret",
  "master",
  "monkey",
  "dragon",
  "sunshine",
  "princess",
  "football",
  "cricket",
  "india",
  "abc",
  "abcd",
  "abcdef",
  "whiteportion",
  "whiteportionwellness",
  "portion",
  "wellness",
  "nutrition",
  "fitness",
  "diet",
  "health",
  "owner",
  "manager",
  "staff",
  "test",
  "default",
  "changeme",
  "",
]);

export function isWeakPassword(p: string): boolean {
  const lower = p.toLowerCase();
  const letters = lower.replace(/[^a-z]/g, "");
  if (COMMON_PASSWORD_WORDS.has(letters)) return true; // e.g. "Admin@12345", "1234567890"
  if (/^(.)\1+$/.test(p)) return true; // "aaaaaaaaaa"
  if ("01234567890123456789".includes(lower) || "9876543210987654321".includes(lower)) return true;
  return new Set(lower).size < 5; // too few different characters
}

export const PasswordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200)
  .refine(
    (p) => !isWeakPassword(p),
    "That password is too common or easy to guess. Try a short phrase of unrelated words.",
  );

export const AdminEmailSchema = z.string().trim().toLowerCase().max(254).pipe(z.string().email());

export interface AdminSessionView {
  configured: boolean;
  // none = sign in; bootstrap = first-time owner setup; ok = signed in
  state: "none" | "bootstrap" | "ok";
  user: {
    email: string;
    name: string;
    role: AdminRole;
    permissions: Permission[];
    recoveryCodesLeft: number;
  } | null;
}

export interface AdminUserView {
  id: number;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  invitePending: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  createdAt: string;
  actorEmail: string;
  action: string;
  target: string;
  details: string;
  ip: string;
  severity: "info" | "warning" | "alert";
}

export interface DashboardStats {
  includeSample: boolean;
  products: { total: number; active: number; draft: number };
  orders: { paid: number; pending: number; refunded: number; toFulfil: number };
  revenue: {
    last30Paise: number;
    prev30Paise: number;
    allTimePaise: number;
    avgOrderPaise: number;
  };
  daily: { date: string; paise: number; orders: number }[]; // last 30 days, India time
  bestSellers: { name: string; qty: number; revenuePaise: number }[];
  lowStock: { name: string; option: string | null; stock: number; productId: number }[];
  enrolments: { total: number; last30: number; topCourses: { name: string; students: number }[] };
  bookings: { pending: number; upcoming: number };
  recentOrders: {
    orderNumber: string;
    name: string;
    totalPaise: number;
    paymentStatus: string;
    fulfilmentStatus: string;
    createdAt: string;
  }[];
}
