// Shared shop definitions (browser + server). Prices are stored in paise
// (1 rupee = 100 paise) as whole numbers so money maths is always exact.
import { z } from "zod";

// Every top-level category has a kind; its subcategories and products inherit it.
//  physical = shipped goods (supplements), ebook = downloadable file,
//  course   = online course access,       pharma  = healthcare products (OTC rules apply)
export type CategoryKind = "physical" | "ebook" | "course" | "pharma";
export type ProductStatus = "draft" | "active" | "archived";

export interface ProductCategory {
  id: number;
  slug: string;
  name: string;
  parentId: number | null;
  kind: CategoryKind;
  description: string;
  sortOrder: number;
  productCount: number; // active products (including subcategories for top-level)
}

export interface ProductSummary {
  id: number;
  slug: string;
  name: string;
  shortDescription: string;
  pricePaise: number;
  compareAtPaise: number | null;
  imageId: number | null;
  categorySlug: string;
  categoryName: string;
  kind: CategoryKind;
  availability: Availability;
  purchasable: boolean; // false for prescription-only pharma or out of stock
}

export interface ProductDetail extends ProductSummary {
  description: string;
  details: { label: string; value: string }[];
  imageIds: number[];
  topCategorySlug: string;
  topCategoryName: string;
  requiresPrescription: boolean;
  isOtc: boolean;
  related: ProductSummary[];
}

export type Availability = "in_stock" | "low_stock" | "out_of_stock" | "digital" | "enquiry_only";

// Admin view of a product (includes drafts, stock numbers, file ids).
export interface AdminProduct {
  id: number;
  slug: string;
  categoryId: number;
  name: string;
  shortDescription: string;
  description: string;
  details: string; // one "Label: Value" per line
  pricePaise: number;
  compareAtPaise: number | null;
  stock: number | null; // null = not tracked (digital/courses)
  status: ProductStatus;
  isOtc: boolean;
  requiresPrescription: boolean;
  imageIds: number[];
  digitalFileId: number | null;
  digitalFileName: string | null;
  updatedAt: string;
}

export const DEFAULT_CATEGORIES: {
  slug: string;
  name: string;
  kind: CategoryKind;
  description: string;
  children: { slug: string; name: string; description: string }[];
}[] = [
  {
    slug: "supplements-nutrition",
    name: "Supplements & Nutrition",
    kind: "physical",
    description:
      "Carefully selected supplements to support your training and everyday nutrition. Supplements are not a substitute for a balanced diet.",
    children: [
      { slug: "protein", name: "Protein", description: "Protein powders and protein foods." },
      {
        slug: "vitamins",
        name: "Vitamins & Minerals",
        description: "Everyday micronutrient support.",
      },
      {
        slug: "pre-workout",
        name: "Pre-workout",
        description: "Training-day energy and focus products.",
      },
      {
        slug: "other-supplements",
        name: "Other Supplements",
        description: "Recovery, hydration and more.",
      },
    ],
  },
  {
    slug: "ebooks-guides",
    name: "E-books & Guides",
    kind: "ebook",
    description:
      "Practical, downloadable guides written by our coaching team. Instant access after payment.",
    children: [
      {
        slug: "fitness-guides",
        name: "Fitness Guides",
        description: "Training structure and progression.",
      },
      {
        slug: "nutrition-guides",
        name: "Nutrition Guides",
        description: "Meal planning and nutrition basics.",
      },
      {
        slug: "wellness-guides",
        name: "Wellness Guides",
        description: "Sleep, stress and healthy habits.",
      },
    ],
  },
  {
    slug: "online-courses",
    name: "Online Courses",
    kind: "course",
    description:
      "Self-paced video courses from our coaches. Lifetime access to purchased courses from your account.",
    children: [
      {
        slug: "fitness-courses",
        name: "Fitness Courses",
        description: "Training programmes and technique.",
      },
      {
        slug: "nutrition-courses",
        name: "Nutrition Courses",
        description: "Learn to plan your own nutrition.",
      },
      {
        slug: "wellness-courses",
        name: "Wellness Courses",
        description: "Lifestyle, recovery and habits.",
      },
    ],
  },
  {
    slug: "pharmaceuticals",
    name: "Pharmaceuticals",
    kind: "pharma",
    description:
      "Healthcare products supplied under our pharmacy licence. Only over-the-counter (OTC) items can be ordered online; prescription items are available on enquiry.",
    children: [
      {
        slug: "otc-healthcare",
        name: "OTC Healthcare Essentials",
        description: "Over-the-counter healthcare products.",
      },
      {
        slug: "personal-care",
        name: "Personal Care",
        description: "Everyday personal care products.",
      },
      {
        slug: "prescription-products",
        name: "Prescription Products",
        description: "Available on enquiry only. A valid prescription is required.",
      },
    ],
  },
];

export const KIND_LABEL: Record<CategoryKind, string> = {
  physical: "Shipped product",
  ebook: "Digital download",
  course: "Online course",
  pharma: "Healthcare product",
};

export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

// "Label: Value" lines -> [{label, value}]
export function parseDetails(text: string): { label: string; value: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf(":");
      return i > 0
        ? { label: line.slice(0, i).trim(), value: line.slice(i + 1).trim() }
        : { label: "", value: line };
    });
}

const LOW_STOCK = 5;

export function availabilityOf(p: {
  kind: CategoryKind;
  stock: number | null;
  requiresPrescription: boolean;
  isOtc: boolean;
}): { availability: Availability; purchasable: boolean } {
  if (p.kind === "pharma" && (p.requiresPrescription || !p.isOtc)) {
    return { availability: "enquiry_only", purchasable: false };
  }
  if (p.kind === "ebook" || p.kind === "course")
    return { availability: "digital", purchasable: true };
  if (p.stock === null) return { availability: "in_stock", purchasable: true };
  if (p.stock <= 0) return { availability: "out_of_stock", purchasable: false };
  return { availability: p.stock <= LOW_STOCK ? "low_stock" : "in_stock", purchasable: true };
}

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  in_stock: "In stock",
  low_stock: "Only a few left",
  out_of_stock: "Out of stock",
  digital: "Instant access after payment",
  enquiry_only: "Available on enquiry",
};

// Admin form validation. Prices arrive in rupees from the form and are stored in paise.
const text = (max: number) => z.string().trim().max(max);
export const ProductInputSchema = z
  .object({
    id: z.number().int().positive().optional(),
    name: text(160).pipe(z.string().min(2, "Name is too short")),
    slug: text(120).optional(),
    categoryId: z.number().int().positive("Choose a category"),
    shortDescription: text(300),
    description: text(20000),
    details: text(5000),
    priceRupees: z.number().min(0).max(10_000_000),
    compareAtRupees: z.number().min(0).max(10_000_000).nullable(),
    stock: z.number().int().min(0).max(1_000_000).nullable(),
    status: z.enum(["draft", "active", "archived"]),
    isOtc: z.boolean(),
    requiresPrescription: z.boolean(),
    imageIds: z.array(z.number().int().positive()).max(8),
    digitalFileId: z.number().int().positive().nullable(),
  })
  .refine((p) => p.compareAtRupees === null || p.compareAtRupees > p.priceRupees, {
    message: "The 'was' price must be higher than the price",
  });
export type ProductInput = z.input<typeof ProductInputSchema>;

export const CategoryInputSchema = z.object({
  id: z.number().int().positive().optional(),
  name: text(120).pipe(z.string().min(2)),
  slug: text(80).optional(),
  parentId: z.number().int().positive().nullable(),
  kind: z.enum(["physical", "ebook", "course", "pharma"]),
  description: text(1000),
  sortOrder: z.number().int().min(0).max(1000),
});
export type CategoryInput = z.input<typeof CategoryInputSchema>;
