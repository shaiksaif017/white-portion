// Course content, enrolments and progress. A lesson's video link and materials are
// only returned after checking the viewer is enrolled (or the lesson is a free preview).
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import {
  type AdminCourseContent,
  type AdminEnrolment,
  type CourseContentInput,
  type CourseInfo,
  type CourseProgress,
  type Curriculum,
  type LessonView,
  CourseContentSchema,
  parseVideoUrl,
} from "@/lib/course-types";
import { getDb } from "./db";

const lower = (email: string) => email.trim().toLowerCase();
const iso = (v: unknown) => `${String(v).replace(" ", "T")}Z`;

// ---------- reading course structure ----------

async function courseProduct(productId: number) {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT p.id, p.slug, p.name, p.status, p.course_instructor, p.course_instructor_bio,
            p.course_duration, p.course_level, c.kind
     FROM products p JOIN product_categories c ON c.id = p.category_id WHERE p.id = ?`,
    [productId],
  );
  const r = rows[0];
  if (!r || r["kind"] !== "course") return null;
  return r;
}

function infoOf(r: RowDataPacket): CourseInfo {
  return {
    instructor: String(r["course_instructor"] ?? ""),
    instructorBio: String(r["course_instructor_bio"] ?? ""),
    duration: String(r["course_duration"] ?? ""),
    level: String(r["course_level"] ?? ""),
  };
}

async function modulesAndLessons(productId: number) {
  const db = await getDb();
  const [mods] = await db.query<RowDataPacket[]>(
    "SELECT id, title FROM course_modules WHERE product_id = ? ORDER BY sort_order, id",
    [productId],
  );
  const [lessons] = await db.query<RowDataPacket[]>(
    `SELECT l.*, f.name AS attachment_name FROM course_lessons l
     LEFT JOIN files f ON f.id = l.attachment_file_id
     WHERE l.product_id = ? ORDER BY l.sort_order, l.id`,
    [productId],
  );
  return mods.map((m) => ({
    id: Number(m["id"]),
    title: String(m["title"]),
    lessons: lessons.filter((l) => Number(l["module_id"]) === Number(m["id"])),
  }));
}

// Public outline for the course page: titles and durations only, never video links.
export async function getCurriculum(productId: number): Promise<Curriculum | null> {
  const p = await courseProduct(productId);
  if (!p) return null;
  const modules = (await modulesAndLessons(productId)).map((m) => ({
    id: m.id,
    title: m.title,
    lessons: m.lessons.map((l) => ({
      id: Number(l["id"]),
      title: String(l["title"]),
      durationMinutes: Number(l["duration_minutes"]),
      isPreview: Boolean(l["is_preview"]),
      hasVideo: Boolean(l["video_url"]),
      hasAttachment: l["attachment_file_id"] !== null,
    })),
  }));
  const all = modules.flatMap((m) => m.lessons);
  return {
    info: infoOf(p),
    modules,
    lessonCount: all.length,
    totalMinutes: all.reduce((n, l) => n + l.durationMinutes, 0),
  };
}

// ---------- enrolments ----------

export async function isEnrolled(email: string, productId: number): Promise<boolean> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT 1 FROM enrolments WHERE email = ? AND product_id = ? AND status = 'active'",
    [lower(email), productId],
  );
  return rows.length > 0;
}

// Called inside the "order paid" transaction: every course in the order becomes
// available to the buyer's email. A revoked enrolment is re-activated by a new purchase.
export async function enrolFromOrder(conn: PoolConnection, orderId: number): Promise<void> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT o.email, i.product_id FROM orders o JOIN order_items i ON i.order_id = o.id
     WHERE o.id = ? AND i.kind = 'course' AND i.product_id IS NOT NULL`,
    [orderId],
  );
  for (const r of rows) {
    await conn.query(
      `INSERT INTO enrolments (email, product_id, order_id, source) VALUES (?, ?, ?, 'purchase')
       ON DUPLICATE KEY UPDATE status = 'active', order_id = VALUES(order_id), source = 'purchase'`,
      [lower(String(r["email"])), Number(r["product_id"]), orderId],
    );
  }
}

// Refunds remove access that came from that order.
export async function revokeForOrder(orderId: number): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE enrolments SET status = 'revoked' WHERE order_id = ?", [orderId]);
}

export async function grantEnrolment(
  email: string,
  productId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await courseProduct(productId))) return { ok: false, error: "Course not found." };
  const db = await getDb();
  await db.query(
    `INSERT INTO enrolments (email, product_id, source) VALUES (?, ?, 'manual')
     ON DUPLICATE KEY UPDATE status = 'active'`,
    [lower(email), productId],
  );
  return { ok: true };
}

export async function setEnrolmentStatus(id: number, status: "active" | "revoked"): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE enrolments SET status = ? WHERE id = ?", [status, id]);
}

async function lessonCounts(productIds: number[]): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (productIds.length === 0) return map;
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT l.id, l.product_id FROM course_lessons l JOIN course_modules m ON m.id = l.module_id
     WHERE l.product_id IN (?) ORDER BY m.sort_order, m.id, l.sort_order, l.id`,
    [productIds],
  );
  for (const r of rows) {
    const list = map.get(Number(r["product_id"])) ?? [];
    list.push(Number(r["id"]));
    map.set(Number(r["product_id"]), list);
  }
  return map;
}

async function completedSet(email: string, lessonIds: number[]): Promise<Set<number>> {
  if (lessonIds.length === 0) return new Set();
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT lesson_id FROM lesson_progress WHERE email = ? AND lesson_id IN (?)",
    [lower(email), lessonIds],
  );
  return new Set(rows.map((r) => Number(r["lesson_id"])));
}

export async function listCustomerCourses(email: string): Promise<CourseProgress[]> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT e.product_id, e.created_at, p.slug, p.name,
            (SELECT file_id FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order, i.id LIMIT 1) AS image_id
     FROM enrolments e JOIN products p ON p.id = e.product_id
     WHERE e.email = ? AND e.status = 'active' ORDER BY e.created_at DESC`,
    [lower(email)],
  );
  const lessons = await lessonCounts(rows.map((r) => Number(r["product_id"])));
  const done = await completedSet(email, [...lessons.values()].flat());
  return rows.map((r) => {
    const ids = lessons.get(Number(r["product_id"])) ?? [];
    return {
      productId: Number(r["product_id"]),
      slug: String(r["slug"]),
      name: String(r["name"]),
      imageId: r["image_id"] === null ? null : Number(r["image_id"]),
      enrolledAt: iso(r["created_at"]),
      lessonCount: ids.length,
      completedCount: ids.filter((id) => done.has(id)).length,
      nextLessonId: ids.find((id) => !done.has(id)) ?? ids[0] ?? null,
    };
  });
}

// ---------- the lesson player ----------

export type LessonAccess =
  | { ok: true; lesson: LessonView; enrolled: boolean }
  | { ok: false; reason: "not_found" | "login" | "not_enrolled" };

export async function getLessonForViewer(
  productId: number,
  lessonId: number,
  email: string | null,
): Promise<LessonAccess> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT l.*, m.title AS module_title FROM course_lessons l JOIN course_modules m ON m.id = l.module_id
     WHERE l.id = ? AND l.product_id = ?`,
    [lessonId, productId],
  );
  const l = rows[0];
  if (!l) return { ok: false, reason: "not_found" };
  const enrolled = email ? await isEnrolled(email, productId) : false;
  if (!enrolled && !l["is_preview"]) return { ok: false, reason: email ? "not_enrolled" : "login" };
  const completed = email ? (await completedSet(email, [lessonId])).has(lessonId) : false;
  return {
    ok: true,
    enrolled,
    lesson: {
      id: Number(l["id"]),
      moduleTitle: String(l["module_title"]),
      title: String(l["title"]),
      description: String(l["description"] ?? ""),
      video: parseVideoUrl(String(l["video_url"] ?? "")),
      durationMinutes: Number(l["duration_minutes"]),
      // materials are for enrolled students only, even on preview lessons
      hasAttachment: enrolled && l["attachment_file_id"] !== null,
      completed,
    },
  };
}

export async function completedLessons(email: string, productId: number): Promise<number[]> {
  const ids = (await lessonCounts([productId])).get(productId) ?? [];
  return [...(await completedSet(email, ids))];
}

export async function setLessonComplete(
  email: string,
  productId: number,
  lessonId: number,
  done: boolean,
): Promise<boolean> {
  if (!(await isEnrolled(email, productId))) return false;
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT 1 FROM course_lessons WHERE id = ? AND product_id = ?",
    [lessonId, productId],
  );
  if (!rows[0]) return false;
  if (done) {
    await db.query("INSERT IGNORE INTO lesson_progress (email, lesson_id) VALUES (?, ?)", [
      lower(email),
      lessonId,
    ]);
  } else {
    await db.query("DELETE FROM lesson_progress WHERE email = ? AND lesson_id = ?", [
      lower(email),
      lessonId,
    ]);
  }
  return true;
}

// File for a lesson's materials, only for enrolled students.
export async function lessonAttachmentFor(email: string, lessonId: number): Promise<number | null> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT product_id, attachment_file_id FROM course_lessons WHERE id = ?",
    [lessonId],
  );
  const r = rows[0];
  if (!r || r["attachment_file_id"] === null) return null;
  if (!(await isEnrolled(email, Number(r["product_id"])))) return null;
  return Number(r["attachment_file_id"]);
}

// ---------- admin ----------

export async function getAdminCourseContent(productId: number): Promise<AdminCourseContent | null> {
  const p = await courseProduct(productId);
  if (!p) return null;
  const modules = await modulesAndLessons(productId);
  return {
    productId,
    info: infoOf(p),
    modules: modules.map((m) => ({
      id: m.id,
      title: m.title,
      lessons: m.lessons.map((l) => ({
        id: Number(l["id"]),
        title: String(l["title"]),
        description: String(l["description"] ?? ""),
        videoUrl: String(l["video_url"] ?? ""),
        durationMinutes: Number(l["duration_minutes"]),
        isPreview: Boolean(l["is_preview"]),
        attachmentFileId: l["attachment_file_id"] === null ? null : Number(l["attachment_file_id"]),
        attachmentName: l["attachment_name"] ? String(l["attachment_name"]) : null,
      })),
    })),
  };
}

// Replaces the course outline. Existing module/lesson ids are kept (so students'
// progress survives edits); anything left out is deleted with its progress.
export async function saveCourseContent(
  input: CourseContentInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = CourseContentSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the course." };
  const c = parsed.data;
  if (!(await courseProduct(c.productId))) return { ok: false, error: "Course not found." };

  const db = await getDb();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE products SET course_instructor = ?, course_instructor_bio = ?, course_duration = ?, course_level = ?
       WHERE id = ?`,
      [c.info.instructor, c.info.instructorBio, c.info.duration, c.info.level, c.productId],
    );
    const [oldMods] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM course_modules WHERE product_id = ?",
      [c.productId],
    );
    const [oldLessons] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM course_lessons WHERE product_id = ?",
      [c.productId],
    );
    const modIds = new Set(oldMods.map((r) => Number(r["id"])));
    const lessonIds = new Set(oldLessons.map((r) => Number(r["id"])));
    const keepMods = new Set<number>();
    const keepLessons = new Set<number>();

    for (const [mi, m] of c.modules.entries()) {
      let moduleId = m.id && modIds.has(m.id) ? m.id : 0;
      if (moduleId) {
        await conn.query("UPDATE course_modules SET title = ?, sort_order = ? WHERE id = ?", [
          m.title,
          mi,
          moduleId,
        ]);
      } else {
        const [res] = await conn.query<import("mysql2").ResultSetHeader>(
          "INSERT INTO course_modules (product_id, title, sort_order) VALUES (?, ?, ?)",
          [c.productId, m.title, mi],
        );
        moduleId = res.insertId;
      }
      keepMods.add(moduleId);
      for (const [li, l] of m.lessons.entries()) {
        const values = [
          moduleId,
          l.title,
          l.description,
          l.videoUrl,
          l.durationMinutes,
          l.isPreview ? 1 : 0,
          l.attachmentFileId,
          li,
        ];
        if (l.id && lessonIds.has(l.id)) {
          await conn.query(
            `UPDATE course_lessons SET module_id = ?, title = ?, description = ?, video_url = ?, duration_minutes = ?,
             is_preview = ?, attachment_file_id = ?, sort_order = ? WHERE id = ?`,
            [...values, l.id],
          );
          keepLessons.add(l.id);
        } else {
          await conn.query(
            `INSERT INTO course_lessons (module_id, title, description, video_url, duration_minutes, is_preview,
             attachment_file_id, sort_order, product_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [...values, c.productId],
          );
        }
      }
    }
    const dropLessons = [...lessonIds].filter((id) => !keepLessons.has(id));
    if (dropLessons.length) {
      await conn.query("DELETE FROM lesson_progress WHERE lesson_id IN (?)", [dropLessons]);
      await conn.query("DELETE FROM course_lessons WHERE id IN (?)", [dropLessons]);
    }
    const dropMods = [...modIds].filter((id) => !keepMods.has(id));
    if (dropMods.length) await conn.query("DELETE FROM course_modules WHERE id IN (?)", [dropMods]);
    await conn.commit();
    return { ok: true };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// Returns lesson attachment file ids so the caller can delete the files too.
export async function deleteCourseContent(productId: number): Promise<number[]> {
  const db = await getDb();
  const [files] = await db.query<RowDataPacket[]>(
    "SELECT attachment_file_id FROM course_lessons WHERE product_id = ? AND attachment_file_id IS NOT NULL",
    [productId],
  );
  await db.query(
    "DELETE FROM lesson_progress WHERE lesson_id IN (SELECT id FROM course_lessons WHERE product_id = ?)",
    [productId],
  );
  await db.query("DELETE FROM course_lessons WHERE product_id = ?", [productId]);
  await db.query("DELETE FROM course_modules WHERE product_id = ?", [productId]);
  await db.query("DELETE FROM enrolments WHERE product_id = ?", [productId]);
  return files.map((f) => Number(f["attachment_file_id"]));
}

export async function listEnrolments(): Promise<AdminEnrolment[]> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT e.*, p.name AS course_name, o.order_number,
            (SELECT COUNT(*) FROM course_lessons l WHERE l.product_id = e.product_id) AS lesson_count,
            (SELECT COUNT(*) FROM lesson_progress lp JOIN course_lessons l ON l.id = lp.lesson_id
               WHERE lp.email = e.email AND l.product_id = e.product_id) AS done_count
     FROM enrolments e JOIN products p ON p.id = e.product_id
     LEFT JOIN orders o ON o.id = e.order_id
     ORDER BY e.created_at DESC LIMIT 2000`,
  );
  return rows.map((r) => ({
    id: Number(r["id"]),
    email: String(r["email"]),
    productId: Number(r["product_id"]),
    courseName: String(r["course_name"]),
    orderNumber: r["order_number"] ? String(r["order_number"]) : null,
    source: String(r["source"]) as AdminEnrolment["source"],
    status: String(r["status"]) as AdminEnrolment["status"],
    createdAt: iso(r["created_at"]),
    completedCount: Number(r["done_count"]),
    lessonCount: Number(r["lesson_count"]),
  }));
}
