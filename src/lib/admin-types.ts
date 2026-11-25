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
export const PasswordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200)
  .refine((p) => !/^(.)\1+$/.test(p), "Choose a less predictable password");

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
