// Demo catalogue, coupons and orders so the whole shop can be tested before real
// inventory exists. Everything created here is flagged is_sample = 1, labelled
// "SAMPLE" on the site, and removed in one go by removeSampleData().
import type { RowDataPacket } from "mysql2/promise";

import type { CheckoutSchema } from "@/lib/order-types";
import type { ProductInput } from "@/lib/shop-types";
import type { z } from "zod";
import { saveProduct, deleteProduct, listCategories } from "./catalogue";
import { saveCoupon } from "./coupons";
import { saveCourseContent } from "./courses";
import { getDb } from "./db";
import { saveFile } from "./files";
import { createPendingOrder, getShopSettings, markPaidWithin } from "./orders";

const NOTE = "Sample product for testing — not a real item. ";

// A small valid one-page PDF (Helvetica text), used for sample e-books and previews.
export function makePdf(title: string, lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const text = [
    "BT /F1 22 Tf 72 770 Td",
    `(${esc(title)}) Tj`,
    "/F1 12 Tf 0 -36 Td",
    ...lines.map((l) => `(${esc(l)}) Tj 0 -18 Td`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

type SampleProduct = Omit<
  ProductInput,
  "categoryId" | "status" | "imageIds" | "digitalFileId" | "isOtc" | "requiresPrescription"
> & {
  category: string;
  isOtc?: boolean;
  requiresPrescription?: boolean;
  ebook?: boolean;
};

const base = { compareAtRupees: null, stock: null, details: "", variants: [] };

const PRODUCTS: SampleProduct[] = [
  {
    ...base,
    category: "protein",
    name: "Sample Whey Protein Isolate",
    slug: "sample-whey-protein-isolate",
    sku: "SMP-WHEY",
    isFeatured: true,
    shortDescription: "25 g protein per scoop, low in sugar. Choose size and flavour.",
    description: `${NOTE}A fast-digesting whey isolate to help you reach your daily protein target.`,
    details: "Protein per serving: 25 g\nServings: 33 (1 kg)\nDietary: Vegetarian",
    priceRupees: 2899,
    variants: [
      {
        name: "1 kg / Chocolate",
        sku: "SMP-WHEY-1K-CHOC",
        priceRupees: 2899,
        compareAtRupees: 3299,
        stock: 40,
      },
      {
        name: "1 kg / Vanilla",
        sku: "SMP-WHEY-1K-VAN",
        priceRupees: 2899,
        compareAtRupees: 3299,
        stock: 4,
      },
      {
        name: "2 kg / Chocolate",
        sku: "SMP-WHEY-2K-CHOC",
        priceRupees: 5299,
        compareAtRupees: null,
        stock: 0,
      },
    ],
  },
  {
    ...base,
    category: "vitamins",
    name: "Sample Daily Multivitamin",
    slug: "sample-daily-multivitamin",
    sku: "SMP-MULTI-60",
    shortDescription: "A once-daily multivitamin and mineral tablet. 60 tablets.",
    description: `${NOTE}Everyday micronutrient support for active adults.`,
    details: "Pack: 60 tablets\nServing: 1 tablet daily",
    priceRupees: 649,
    compareAtRupees: 799,
    stock: 120,
  },
  {
    ...base,
    category: "pre-workout",
    name: "Sample Pre-Workout Focus",
    slug: "sample-pre-workout-focus",
    sku: "SMP-PRE",
    shortDescription: "Caffeine and citrulline blend for training days.",
    description: `${NOTE}Contains caffeine. Not suitable for children or pregnant women.`,
    priceRupees: 1499,
    variants: [
      {
        name: "Watermelon",
        sku: "SMP-PRE-WM",
        priceRupees: 1499,
        compareAtRupees: null,
        stock: 25,
      },
      {
        name: "Blue Raspberry",
        sku: "SMP-PRE-BR",
        priceRupees: 1499,
        compareAtRupees: null,
        stock: 18,
      },
    ],
  },
  {
    ...base,
    category: "post-workout",
    name: "Sample Creatine Monohydrate",
    slug: "sample-creatine-monohydrate",
    sku: "SMP-CREA-250",
    isFeatured: true,
    shortDescription: "Micronised creatine monohydrate, 3 g per serving. 250 g.",
    description: `${NOTE}Supports strength and recovery as part of a training programme.`,
    priceRupees: 899,
    stock: 3,
  },
  {
    ...base,
    category: "sports-nutrition",
    name: "Sample Electrolyte Hydration Mix",
    slug: "sample-electrolyte-hydration-mix",
    sku: "SMP-ELEC-20",
    shortDescription: "Sugar-free electrolyte sachets for long sessions. 20 sachets.",
    description: `${NOTE}Sodium, potassium and magnesium to support hydration.`,
    priceRupees: 499,
    stock: 60,
  },
  {
    ...base,
    category: "general-wellness",
    name: "Sample Omega-3 Fish Oil",
    slug: "sample-omega-3-fish-oil",
    sku: "SMP-OMEGA-90",
    shortDescription: "1000 mg fish oil softgels. 90 softgels.",
    description: `${NOTE}EPA and DHA as part of a balanced diet.`,
    priceRupees: 799,
    stock: 0,
  },
  {
    ...base,
    category: "nutrition-guides",
    ebook: true,
    name: "Sample: The Flexible Meal Planning Guide",
    slug: "sample-flexible-meal-planning-guide",
    sku: "SMP-EB-MEAL",
    isFeatured: true,
    shortDescription: "Build balanced meals without strict diets. 48-page PDF.",
    description: `${NOTE}Learn portion guides, simple swaps and a 7-day template.`,
    details: "Format: PDF\nPages: 48\nLevel: Beginner",
    priceRupees: 499,
    compareAtRupees: 799,
  },
  {
    ...base,
    category: "muscle-building-guides",
    ebook: true,
    name: "Sample: Hypertrophy Fundamentals",
    slug: "sample-hypertrophy-fundamentals",
    sku: "SMP-EB-HYP",
    shortDescription: "A 12-week muscle-building plan with progress tracking. PDF.",
    description: `${NOTE}Training splits, progression rules and nutrition targets.`,
    details: "Format: PDF\nPages: 64\nLevel: Intermediate",
    priceRupees: 699,
  },
  {
    ...base,
    category: "beginner-fitness-guides",
    ebook: true,
    name: "Sample: Your First 30 Days in the Gym",
    slug: "sample-first-30-days-gym",
    sku: "SMP-EB-30D",
    shortDescription: "Step-by-step plan for complete beginners. PDF.",
    description: `${NOTE}Equipment basics, three full-body workouts and a habit tracker.`,
    details: "Format: PDF\nPages: 36\nLevel: Beginner",
    priceRupees: 299,
  },
  {
    ...base,
    category: "fitness-courses",
    name: "Sample Course: Strength Foundations",
    slug: "sample-course-strength-foundations",
    sku: "SMP-CRS-STR",
    isFeatured: true,
    shortDescription: "6-week self-paced video course on the main lifts.",
    description: `${NOTE}Squat, hinge, push and pull technique with weekly programming.`,
    details: "Duration: 6 weeks\nLessons: 18\nLevel: Beginner",
    priceRupees: 2499,
    compareAtRupees: 3499,
  },
  {
    ...base,
    category: "nutrition-courses",
    name: "Sample Course: Nutrition Made Simple",
    slug: "sample-course-nutrition-made-simple",
    sku: "SMP-CRS-NUT",
    shortDescription: "Learn to set calories, macros and plan your own meals.",
    description: `${NOTE}Five modules with worksheets and quizzes.`,
    details: "Duration: 4 weeks\nLessons: 15\nLevel: All levels",
    priceRupees: 1999,
  },
  {
    ...base,
    category: "otc-healthcare",
    isOtc: true,
    name: "Sample ORS Electrolyte Sachets",
    slug: "sample-ors-sachets",
    sku: "SMP-ORS-10",
    gstRateBps: 1200,
    shortDescription: "Oral rehydration salts, orange flavour. Pack of 10.",
    description: `${NOTE}Read the label before use.`,
    priceRupees: 199,
    stock: 80,
  },
  {
    ...base,
    category: "personal-care",
    isOtc: true,
    name: "Sample Sunscreen SPF 50",
    slug: "sample-sunscreen-spf50",
    sku: "SMP-SPF50",
    gstRateBps: 1800,
    shortDescription: "Broad-spectrum, non-greasy sunscreen. 50 g.",
    description: `${NOTE}For external use only.`,
    priceRupees: 449,
    stock: 35,
  },
  {
    ...base,
    category: "prescription-products",
    requiresPrescription: true,
    name: "Sample Prescription Medicine",
    slug: "sample-prescription-medicine",
    sku: "SMP-RX-01",
    gstRateBps: 1200,
    shortDescription: "Prescription-only item: shown on enquiry, never sold online.",
    description: `${NOTE}Demonstrates how prescription products are restricted.`,
    priceRupees: 350,
    stock: 10,
  },
];

export async function hasSampleData(): Promise<boolean> {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT (SELECT COUNT(*) FROM products WHERE is_sample = 1) + (SELECT COUNT(*) FROM orders WHERE is_sample = 1) + (SELECT COUNT(*) FROM coupons WHERE is_sample = 1) AS n",
  );
  return Number(rows[0]?.["n"]) > 0;
}

export async function sampleCounts() {
  const db = await getDb();
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT (SELECT COUNT(*) FROM products WHERE is_sample = 1) AS products,
            (SELECT COUNT(*) FROM orders WHERE is_sample = 1) AS orders,
            (SELECT COUNT(*) FROM coupons WHERE is_sample = 1) AS coupons`,
  );
  const r = rows[0];
  return {
    products: Number(r?.["products"] ?? 0),
    orders: Number(r?.["orders"] ?? 0),
    coupons: Number(r?.["coupons"] ?? 0),
  };
}

type Checkout = z.output<typeof CheckoutSchema>;

export async function loadSampleData(): Promise<
  { ok: true; products: number; orders: number; coupons: number } | { ok: false; error: string }
> {
  if (await hasSampleData()) {
    return { ok: false, error: "Sample data is already loaded. Remove it first to load it again." };
  }
  const cats = await listCategories();
  const catId = (slug: string) => cats.find((c) => c.slug === slug)?.id;
  const ids = new Map<string, number>();

  for (const p of PRODUCTS) {
    const categoryId = catId(p.category);
    if (!categoryId) continue; // owner removed this category
    let digitalFileId: number | null = null;
    let previewFileId: number | null = null;
    if (p.ebook) {
      digitalFileId = await saveFile(
        `${p.slug}.pdf`,
        "application/pdf",
        makePdf(p.name, ["Sample e-book for testing downloads.", "Replace with your real guide."]),
        false,
      );
      previewFileId = await saveFile(
        `${p.slug}-preview.pdf`,
        "application/pdf",
        makePdf(`${p.name} - free preview`, ["Chapter 1 preview (sample)."]),
        true,
      );
    }
    const { category: _c, ebook: _e, isOtc, requiresPrescription, ...rest } = p;
    const res = await saveProduct(
      {
        ...rest,
        categoryId,
        status: "active",
        imageIds: [],
        digitalFileId,
        previewFileId,
        isOtc: Boolean(isOtc),
        requiresPrescription: Boolean(requiresPrescription),
      },
      { isSample: true },
    );
    if (!res.ok) throw new Error(`Sample product "${p.name}": ${res.error}`);
    ids.set(p.slug ?? "", res.id);
  }

  // Course outlines for the sample courses (videos left empty: "coming soon").
  const lesson = (title: string, minutes: number, isPreview = false) => ({
    title,
    description:
      "Sample lesson. Replace with your own video link and notes in Admin → Products → Lessons.",
    videoUrl: "",
    durationMinutes: minutes,
    isPreview,
    attachmentFileId: null,
  });
  const strength = ids.get("sample-course-strength-foundations");
  if (strength) {
    await saveCourseContent({
      productId: strength,
      info: {
        instructor: "Sample Coach",
        instructorBio:
          "Sample instructor profile. Replace with your coach's experience and qualifications.",
        duration: "6 weeks",
        level: "Beginner",
      },
      modules: [
        {
          title: "Getting started",
          lessons: [
            lesson("Welcome and how the course works", 6, true),
            lesson("Warm-up and mobility routine", 14),
          ],
        },
        {
          title: "The main lifts",
          lessons: [
            lesson("Squat technique", 18),
            lesson("Deadlift and hinge", 20),
            lesson("Bench press and push-ups", 16),
          ],
        },
        {
          title: "Your programme",
          lessons: [
            lesson("Weekly plan and progression", 12),
            lesson("Tracking and next steps", 9),
          ],
        },
      ],
    });
  }
  const nutrition = ids.get("sample-course-nutrition-made-simple");
  if (nutrition) {
    await saveCourseContent({
      productId: nutrition,
      info: {
        instructor: "Sample Nutritionist",
        instructorBio: "Sample instructor profile.",
        duration: "4 weeks",
        level: "All levels",
      },
      modules: [
        {
          title: "Foundations",
          lessons: [
            lesson("Calories and energy balance", 11, true),
            lesson("Protein, carbs and fats", 15),
          ],
        },
        {
          title: "Planning meals",
          lessons: [lesson("Building a balanced plate", 13), lesson("A simple weekly plan", 17)],
        },
      ],
    });
  }

  await saveCoupon(
    {
      code: "SAMPLE10",
      description: "Sample coupon: 10% off orders over ₹500 (up to ₹300)",
      type: "percent",
      value: 10,
      minOrderRupees: 500,
      maxDiscountRupees: 300,
      startsAt: null,
      endsAt: null,
      maxUses: null,
      active: true,
    },
    { isSample: true },
  );
  await saveCoupon(
    {
      code: "SAMPLEWELCOME",
      description: "Sample coupon: ₹200 off orders over ₹1,500, first 100 uses",
      type: "fixed",
      value: 200,
      minOrderRupees: 1500,
      maxDiscountRupees: null,
      startsAt: null,
      endsAt: null,
      maxUses: 100,
      active: true,
    },
    { isSample: true },
  );

  // Orders spread over the last few weeks, in different states, so the Orders
  // tab and reports have something to show. No emails are sent for these.
  const db = await getDb();
  const [variantRows] = await db.query<RowDataPacket[]>(
    "SELECT id, product_id FROM product_variants WHERE product_id = ? ORDER BY sort_order",
    [ids.get("sample-whey-protein-isolate") ?? 0],
  );
  const wheyVariant = variantRows[0] ? Number(variantRows[0]["id"]) : null;
  const item = (slug: string, qty = 1, variantId: number | null = null) => ({
    productId: ids.get(slug) ?? 0,
    variantId,
    qty,
  });
  const address = {
    line1: "12 Sample Street",
    line2: "Test Layout",
    city: "Bengaluru",
    state: "Karnataka" as const,
    pincode: "560038",
  };
  const plans: {
    customer: string;
    items: Checkout["items"];
    coupon?: string;
    daysAgo: number;
    pay: "paid" | "pending" | "refunded";
    status: "new" | "processing" | "shipped" | "delivered" | "completed" | "cancelled";
    tracking?: string;
  }[] = [
    {
      customer: "Sample Customer One",
      items: [
        item("sample-whey-protein-isolate", 1, wheyVariant),
        item("sample-creatine-monohydrate"),
      ],
      coupon: "SAMPLE10",
      daysAgo: 21,
      pay: "paid",
      status: "delivered",
      tracking: "Sample Courier SMP123456",
    },
    {
      customer: "Sample Customer Two",
      items: [item("sample-flexible-meal-planning-guide")],
      daysAgo: 14,
      pay: "paid",
      status: "completed",
    },
    {
      customer: "Sample Customer Three",
      items: [item("sample-course-strength-foundations")],
      coupon: "SAMPLEWELCOME",
      daysAgo: 9,
      pay: "paid",
      status: "completed",
    },
    {
      customer: "Sample Customer Four",
      items: [item("sample-daily-multivitamin", 2), item("sample-ors-sachets", 3)],
      daysAgo: 5,
      pay: "paid",
      status: "shipped",
      tracking: "Sample Courier SMP654321",
    },
    {
      customer: "Sample Customer Five",
      items: [item("sample-electrolyte-hydration-mix")],
      daysAgo: 2,
      pay: "paid",
      status: "new",
    },
    {
      customer: "Sample Customer Six",
      items: [item("sample-hypertrophy-fundamentals")],
      daysAgo: 1,
      pay: "pending",
      status: "new",
    },
    {
      customer: "Sample Customer Seven",
      items: [item("sample-sunscreen-spf50")],
      daysAgo: 12,
      pay: "refunded",
      status: "cancelled",
    },
  ];

  const settings = await getShopSettings();
  let orders = 0;
  for (const [i, plan] of plans.entries()) {
    if (plan.items.some((it) => !it.productId)) continue;
    const needsAddress = plan.items.some((it) =>
      PRODUCTS.find(
        (p) => ids.get(p.slug ?? "") === it.productId && !p.ebook && !p.category.includes("course"),
      ),
    );
    const res = await createPendingOrder(
      {
        items: plan.items,
        name: plan.customer,
        email: `sample${i + 1}@example.com`,
        phone: `98765000${String(i + 10).padStart(2, "0")}`,
        address: needsAddress ? address : null,
        notes: "Sample order for testing.",
        couponCode: plan.coupon ?? null,
        acceptTerms: true,
      },
      settings,
      { isSample: true },
    );
    if (!res.ok) throw new Error(`Sample order ${i + 1}: ${res.error}`);
    const id = res.order.id;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      if (plan.pay !== "pending") {
        await markPaidWithin(
          conn,
          id,
          `pay_SAMPLE${String(i + 1).padStart(6, "0")}`,
          res.order.couponCode,
        );
      }
      await conn.query(
        `UPDATE orders SET payment_status = ?, fulfilment_status = ?, tracking_info = ?,
           created_at = UTC_TIMESTAMP() - INTERVAL ? DAY,
           paid_at = IF(paid_at IS NULL, NULL, UTC_TIMESTAMP() - INTERVAL ? DAY)
         WHERE id = ?`,
        [plan.pay, plan.status, plan.tracking ?? "", plan.daysAgo, plan.daysAgo, id],
      );
      await conn.commit();
      orders++;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  return { ok: true, products: ids.size, orders, coupons: 2 };
}

export async function removeSampleData(): Promise<{
  products: number;
  orders: number;
  coupons: number;
}> {
  const db = await getDb();
  const counts = await sampleCounts();
  // Orders first, so their e-book files are no longer "in use" when products go.
  await db.query(
    "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE is_sample = 1)",
  );
  await db.query("DELETE FROM orders WHERE is_sample = 1");
  const [prods] = await db.query<RowDataPacket[]>("SELECT id FROM products WHERE is_sample = 1");
  for (const p of prods) await deleteProduct(Number(p["id"]));
  await db.query("DELETE FROM coupons WHERE is_sample = 1");
  return counts;
}
