// Real-database test for customer login codes, enrolments, lesson access and progress.
// Runs only with DB_TEST=1 against an EMPTY throwaway database.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env["DB_TEST"] === "1";

describe.skipIf(!enabled)("accounts and courses against a real database", async () => {
  process.env["SESSION_SECRET"] ??= "y".repeat(40);
  process.env["ADMIN_PASSWORD_HASH"] ??= "scrypt:00:00";
  const customers = await import("@/server/customers");
  const courses = await import("@/server/courses");
  const catalogue = await import("@/server/catalogue");
  const orders = await import("@/server/orders");
  const files = await import("@/server/files");
  const { getDb } = await import("@/server/db");

  const email = "student@example.com";
  let courseId = 0;
  let guideId = 0;

  beforeAll(async () => {
    const db = await getDb();
    for (const t of [
      "lesson_progress",
      "enrolments",
      "course_lessons",
      "course_modules",
      "customer_login_codes",
      "customers",
      "order_items",
      "orders",
      "product_variants",
      "product_images",
      "products",
    ])
      await db.query(`DELETE FROM ${t}`);
    const cats = await catalogue.listCategories();
    const id = (slug: string) => cats.find((c) => c.slug === slug)!.id;
    const base = {
      shortDescription: "",
      description: "",
      details: "",
      compareAtRupees: null,
      stock: null,
      isOtc: false,
      requiresPrescription: false,
      imageIds: [] as number[],
      status: "active" as const,
    };
    const c = await catalogue.saveProduct({
      ...base,
      name: "Strength Course",
      categoryId: id("fitness-courses"),
      priceRupees: 1000,
      digitalFileId: null,
    });
    const pdf = await files.saveFile("g.pdf", "application/pdf", Buffer.from("%PDF-1.4 x"), false);
    const g = await catalogue.saveProduct({
      ...base,
      name: "Guide",
      categoryId: id("nutrition-guides"),
      priceRupees: 300,
      digitalFileId: pdf,
    });
    if (!c.ok || !g.ok) throw new Error("setup");
    courseId = c.id;
    guideId = g.id;
  });

  afterAll(async () => {
    await (await getDb()).end();
  });

  it("logs in with a one-time code: wrong codes count, codes are single use", async () => {
    const code = await customers.createLoginCode(email);
    expect(code).toMatch(/^\d{6}$/);
    const wrong = code === "000000" ? "111111" : "000000";
    expect((await customers.verifyLoginCode(email, wrong)).ok).toBe(false);
    const ok = await customers.verifyLoginCode(email, code);
    if (!ok.ok) throw new Error(ok.error);
    expect(await customers.verifyLoginCode(email, code)).toMatchObject({ ok: false }); // reused

    const token = customers.createCustomerToken(ok.customerId, ok.sessionVersion);
    expect((await customers.customerFromToken(token))?.email).toBe(email);
    await customers.logoutEverywhere(ok.customerId);
    expect(await customers.customerFromToken(token)).toBeNull();
  });

  it("locks a code after 5 wrong tries and only the newest code works", async () => {
    const first = await customers.createLoginCode(email);
    const second = await customers.createLoginCode(email);
    expect((await customers.verifyLoginCode(email, first)).ok).toBe(first === second);
    const bad = second === "999999" ? "888888" : "999999";
    for (let i = 0; i < 5; i++) await customers.verifyLoginCode(email, bad);
    expect(await customers.verifyLoginCode(email, second)).toEqual({
      ok: false,
      error: "Too many wrong codes. Please request a new one.",
    });
  });

  it("saves course content, keeping lesson ids on edit", async () => {
    const save = (
      lessonsB: { id?: number; title: string }[],
      ids: { m1?: number; l1?: number } = {},
    ) =>
      courses.saveCourseContent({
        productId: courseId,
        info: {
          instructor: "Coach A",
          instructorBio: "Bio",
          duration: "6 weeks",
          level: "Beginner",
        },
        modules: [
          {
            ...(ids.m1 ? { id: ids.m1 } : {}),
            title: "Start",
            lessons: [
              {
                ...(ids.l1 ? { id: ids.l1 } : {}),
                title: "Welcome",
                description: "",
                videoUrl: "https://youtu.be/dQw4w9WgXcQ",
                durationMinutes: 5,
                isPreview: true,
                attachmentFileId: null,
              },
              ...lessonsB.map((l) => ({
                ...l,
                description: "",
                videoUrl: "https://vimeo.com/123456789",
                durationMinutes: 10,
                isPreview: false,
                attachmentFileId: null,
              })),
            ],
          },
        ],
      });
    expect(await save([{ title: "Squat" }, { title: "Deadlift" }])).toEqual({ ok: true });
    const c1 = await courses.getAdminCourseContent(courseId);
    const m1 = c1!.modules[0]!;
    expect(m1.lessons.map((l) => l.title)).toEqual(["Welcome", "Squat", "Deadlift"]);
    expect(
      await save([{ id: m1.lessons[1]!.id, title: "Squat v2" }], {
        m1: m1.id,
        l1: m1.lessons[0]!.id,
      }),
    ).toEqual({ ok: true });
    const c2 = await courses.getAdminCourseContent(courseId);
    expect(c2!.modules[0]!.id).toBe(m1.id);
    expect(c2!.modules[0]!.lessons.map((l) => [l.id, l.title])).toEqual([
      [m1.lessons[0]!.id, "Welcome"],
      [m1.lessons[1]!.id, "Squat v2"],
    ]);
    const outline = await courses.getCurriculum(courseId);
    expect(outline).toMatchObject({
      lessonCount: 2,
      totalMinutes: 15,
      info: { instructor: "Coach A" },
    });
    expect(JSON.stringify(outline)).not.toContain("youtu"); // no video links in the public outline
  });

  it("enrols on payment, guards locked lessons, tracks progress, and revokes on refund", async () => {
    const outline = (await courses.getCurriculum(courseId))!;
    const [preview, locked] = outline.modules[0]!.lessons;

    // before buying: preview open (no materials), locked lesson blocked
    const anon = await courses.getLessonForViewer(courseId, preview!.id, null);
    expect(anon.ok && anon.lesson.video?.provider).toBe("youtube");
    expect(await courses.getLessonForViewer(courseId, locked!.id, null)).toEqual({
      ok: false,
      reason: "login",
    });
    expect(await courses.getLessonForViewer(courseId, locked!.id, email)).toEqual({
      ok: false,
      reason: "not_enrolled",
    });
    expect(await courses.setLessonComplete(email, courseId, locked!.id, true)).toBe(false);

    const res = await orders.createPendingOrder(
      {
        items: [
          { productId: courseId, variantId: null, qty: 1 },
          { productId: guideId, variantId: null, qty: 1 },
        ],
        name: "Stu Dent",
        email: "Student@Example.com", // different case at checkout
        phone: "9876543210",
        address: null,
        notes: "",
        couponCode: null,
        acceptTerms: true,
      },
      { shippingFeePaise: 0, freeShippingFromPaise: null },
    );
    if (!res.ok) throw new Error(res.error);
    await orders.setRazorpayOrderId(res.order.id, "order_ACCOUNTS1");
    await orders.markOrderPaid("order_ACCOUNTS1", "pay_ACCOUNTS1", res.order.totalPaise);

    expect(await courses.isEnrolled(email, courseId)).toBe(true);
    const open = await courses.getLessonForViewer(courseId, locked!.id, email);
    expect(open.ok && open.lesson.video?.provider).toBe("vimeo");
    expect(await courses.setLessonComplete(email, courseId, locked!.id, true)).toBe(true);
    const mine = await courses.listCustomerCourses(email);
    expect(mine[0]).toMatchObject({ lessonCount: 2, completedCount: 1, nextLessonId: preview!.id });

    // account pages see the order and the e-book download
    expect((await customers.listCustomerOrders(email)).map((o) => o.orderNumber)).toEqual([
      res.order.orderNumber,
    ]);
    expect((await customers.listCustomerDownloads(email)).map((d) => d.name)).toEqual(["Guide"]);
    expect(await customers.listCustomerOrders("someone-else@example.com")).toEqual([]);

    await courses.revokeForOrder(res.order.id);
    expect(await courses.isEnrolled(email, courseId)).toBe(false);
    await courses.grantEnrolment(email, courseId);
    expect(await courses.isEnrolled(email, courseId)).toBe(true);
    const list = await courses.listEnrolments();
    expect(list[0]).toMatchObject({ email, completedCount: 1, lessonCount: 2, status: "active" });
  });

  it("deleting the course removes its lessons, progress and enrolments", async () => {
    await catalogue.deleteProduct(courseId);
    const db = await getDb();
    const [rows] = await db.query<import("mysql2").RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM course_lessons WHERE product_id = ?) +
              (SELECT COUNT(*) FROM enrolments WHERE product_id = ?) +
              (SELECT COUNT(*) FROM lesson_progress) AS n`,
      [courseId, courseId],
    );
    expect(Number(rows[0]?.["n"])).toBe(0);
  });
});
