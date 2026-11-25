// Server functions for customer accounts, the course player and admin course tools.
import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getRequestIP, setCookie } from "@tanstack/react-start/server";
import type { RowDataPacket } from "mysql2/promise";
import { z } from "zod";

import { brand } from "@/lib/brand";
import {
  type AdminCourseContent,
  type AdminEnrolment,
  type CourseContentInput,
  type CourseProgress,
  type CustomerView,
  type Curriculum,
  type LessonView,
  EmailSchema,
  LoginCodeSchema,
} from "@/lib/course-types";
import { isAdminRequest } from "@/server/admin-session";
import { rateLimit } from "@/server/auth";
import * as courses from "@/server/courses";
import * as customers from "@/server/customers";
import { getDb, isDbConfigured } from "@/server/db";
import { isProduction } from "@/server/env";
import { sendEmail } from "@/server/mailer";

type Fail = { ok: false; error: string };
const UNAVAILABLE: Fail = {
  ok: false,
  error: "Accounts are temporarily unavailable. Please try again shortly.",
};
const unauthorized: Fail = { ok: false, error: "Your session has expired. Please log in again." };

function ip(): string {
  return getRequestIP({ xForwardedFor: true }) ?? "unknown";
}

async function currentCustomer() {
  if (!isDbConfigured()) return null;
  return customers.customerFromRequest();
}

// ---------- login ----------

export const requestLoginCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: EmailSchema }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    if (!isDbConfigured() || !customers.accountsAvailable()) return UNAVAILABLE;
    if (
      !rateLimit(`code-ip:${ip()}`, 10, 15 * 60_000) ||
      !rateLimit(`code-email:${data.email}`, 4, 15 * 60_000)
    ) {
      return { ok: false, error: "Too many codes requested. Please wait 15 minutes." };
    }
    try {
      const code = await customers.createLoginCode(data.email);
      const result = await sendEmail(
        {
          type: "LOGIN_CODE",
          to: data.email,
          // no code in the subject: subjects are kept in the notification log
          subject: `Your ${brand.name} login code`,
          text: [
            `Your login code is: ${code}`,
            "",
            "It works once and expires in 10 minutes.",
            "If you didn't ask for this, you can ignore this email; nobody can log in without the code.",
            "",
            `${brand.name}`,
          ].join("\n"),
        },
        undefined,
        { logText: "Login code sent (the code itself is not stored in this log)." },
      );
      if (result.status !== "SENT") {
        return {
          ok: false,
          error: "We couldn't send the email just now. Please try again shortly.",
        };
      }
      // Same answer whether or not the email has an account, so addresses can't be probed.
      return { ok: true };
    } catch (error) {
      console.error("[account] request code failed", error);
      return UNAVAILABLE;
    }
  });

export const verifyLoginCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: EmailSchema, code: LoginCodeSchema }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    if (!isDbConfigured() || !customers.accountsAvailable()) return UNAVAILABLE;
    if (!rateLimit(`verify-ip:${ip()}`, 20, 15 * 60_000)) {
      return { ok: false, error: "Too many attempts. Please wait 15 minutes." };
    }
    try {
      const r = await customers.verifyLoginCode(data.email, data.code);
      if (!r.ok) return r;
      setCookie(
        customers.CUSTOMER_COOKIE,
        customers.createCustomerToken(r.customerId, r.sessionVersion),
        {
          httpOnly: true,
          secure: isProduction(),
          sameSite: "lax", // so links from our emails arrive logged in
          path: "/",
          maxAge: customers.CUSTOMER_SESSION_DAYS * 86_400,
        },
      );
      return { ok: true };
    } catch (error) {
      console.error("[account] verify failed", error);
      return UNAVAILABLE;
    }
  });

export const logoutCustomer = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(customers.CUSTOMER_COOKIE, { path: "/" });
  return { ok: true as const };
});

export const logoutAllDevices = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true } | Fail> => {
    const me = await currentCustomer();
    if (!me) return { ok: false, error: "Please log in again." };
    await customers.logoutEverywhere(me.id);
    deleteCookie(customers.CUSTOMER_COOKIE, { path: "/" });
    return { ok: true };
  },
);

// ---------- account page ----------

export interface AccountData {
  customer: CustomerView;
  orders: customers.AccountOrder[];
  downloads: customers.AccountDownload[];
  courses: CourseProgress[];
}

export const getAccount = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ loggedIn: false } | ({ loggedIn: true } & AccountData)> => {
    const me = await currentCustomer();
    if (!me) return { loggedIn: false };
    const [orders, downloads, myCourses] = await Promise.all([
      customers.listCustomerOrders(me.email),
      customers.listCustomerDownloads(me.email),
      courses.listCustomerCourses(me.email),
    ]);
    return {
      loggedIn: true,
      customer: { email: me.email, name: me.name, phone: me.phone },
      orders,
      downloads,
      courses: myCourses,
    };
  },
);

export const getSessionSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ loggedIn: boolean; firstName: string }> => {
    const me = await currentCustomer();
    return { loggedIn: Boolean(me), firstName: me?.name.split(" ")[0] ?? "" };
  },
);

export const updateAccountProfile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().max(120),
        phone: z
          .string()
          .trim()
          .max(20)
          .regex(/^[0-9+\s()-]*$/, "Use only numbers in the phone field"),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    const me = await currentCustomer();
    if (!me) return { ok: false, error: "Please log in again." };
    await customers.updateProfile(me.id, data.name, data.phone);
    return { ok: true };
  });

// ---------- courses: public outline + player ----------

export const getCourseOutline = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ productId: z.number().int().positive() }).parse(d))
  .handler(
    async ({
      data,
    }): Promise<{ curriculum: Curriculum | null; enrolled: boolean; loggedIn: boolean }> => {
      if (!isDbConfigured()) return { curriculum: null, enrolled: false, loggedIn: false };
      try {
        const me = await currentCustomer();
        const [curriculum, enrolled] = await Promise.all([
          courses.getCurriculum(data.productId),
          me ? courses.isEnrolled(me.email, data.productId) : Promise.resolve(false),
        ]);
        return { curriculum, enrolled, loggedIn: Boolean(me) };
      } catch (error) {
        console.error("[course] outline failed", error);
        return { curriculum: null, enrolled: false, loggedIn: false };
      }
    },
  );

export type LearnPage =
  | { found: false }
  | {
      found: true;
      productId: number;
      slug: string;
      name: string;
      curriculum: Curriculum;
      loggedIn: boolean;
      enrolled: boolean;
      completed: number[];
      lesson: LessonView | null;
      blocked: "login" | "not_enrolled" | null;
    };

export const getLearnPage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
        lessonId: z.number().int().positive().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<LearnPage> => {
    if (!isDbConfigured()) return { found: false };
    const db = await getDb();
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT p.id, p.slug, p.name, p.status FROM products p JOIN product_categories c ON c.id = p.category_id
       WHERE p.slug = ? AND c.kind = 'course' AND p.status IN ('active', 'archived')`,
      [data.slug],
    );
    const p = rows[0];
    if (!p) return { found: false };
    const productId = Number(p["id"]);
    const me = await currentCustomer();
    const curriculum = await courses.getCurriculum(productId);
    if (!curriculum) return { found: false };
    const enrolled = me ? await courses.isEnrolled(me.email, productId) : false;
    // Archived courses stay available to students who bought them, but nobody else.
    if (!enrolled && (p["status"] !== "active" || !curriculum.lessonCount)) return { found: false };
    const completed = me && enrolled ? await courses.completedLessons(me.email, productId) : [];
    const all = curriculum.modules.flatMap((m) => m.lessons);
    const lessonId =
      data.lessonId ??
      (enrolled
        ? (all.find((l) => !completed.includes(l.id)) ?? all[0])?.id
        : all.find((l) => l.isPreview)?.id);
    let lesson: LessonView | null = null;
    let blocked: "login" | "not_enrolled" | null = null;
    if (lessonId) {
      const access = await courses.getLessonForViewer(productId, lessonId, me?.email ?? null);
      if (access.ok) lesson = access.lesson;
      else if (access.reason === "not_found") return { found: false };
      else blocked = access.reason;
    } else if (!enrolled) {
      blocked = me ? "not_enrolled" : "login";
    }
    return {
      found: true,
      productId,
      slug: String(p["slug"]),
      name: String(p["name"]),
      curriculum,
      loggedIn: Boolean(me),
      enrolled,
      completed,
      lesson,
      blocked,
    };
  });

export const markLesson = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        productId: z.number().int().positive(),
        lessonId: z.number().int().positive(),
        done: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    const me = await currentCustomer();
    if (!me) return { ok: false, error: "Please log in again." };
    const ok = await courses.setLessonComplete(me.email, data.productId, data.lessonId, data.done);
    return ok ? { ok: true } : { ok: false, error: "You're not enrolled in this course." };
  });

// ---------- admin: course content + enrolments ----------

export const adminGetCourseContent = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ productId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; content: AdminCourseContent } | Fail> => {
    if (!isAdminRequest()) return unauthorized;
    try {
      const content = await courses.getAdminCourseContent(data.productId);
      return content ? { ok: true, content } : { ok: false, error: "Course not found." };
    } catch (error) {
      console.error("[admin] course content failed", error);
      return { ok: false, error: "Could not load the course." };
    }
  });

export const adminSaveCourseContent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d)
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    if (!isAdminRequest()) return unauthorized;
    try {
      return await courses.saveCourseContent(data as CourseContentInput);
    } catch (error) {
      console.error("[admin] save course failed", error);
      return { ok: false, error: "Could not save the course." };
    }
  });

export const adminListEnrolments = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: true; enrolments: AdminEnrolment[] } | Fail> => {
    if (!isAdminRequest()) return unauthorized;
    try {
      return { ok: true, enrolments: await courses.listEnrolments() };
    } catch (error) {
      console.error("[admin] enrolments failed", error);
      return { ok: false, error: "Could not load enrolments." };
    }
  },
);

export const adminGrantEnrolment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ email: EmailSchema, productId: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    if (!isAdminRequest()) return unauthorized;
    try {
      return await courses.grantEnrolment(data.email, data.productId);
    } catch (error) {
      console.error("[admin] grant enrolment failed", error);
      return { ok: false, error: "Could not add the student." };
    }
  });

export const adminSetEnrolmentStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.number().int().positive(), status: z.enum(["active", "revoked"]) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    if (!isAdminRequest()) return unauthorized;
    try {
      await courses.setEnrolmentStatus(data.id, data.status);
      return { ok: true };
    } catch (error) {
      console.error("[admin] enrolment status failed", error);
      return { ok: false, error: "Could not update the enrolment." };
    }
  });
