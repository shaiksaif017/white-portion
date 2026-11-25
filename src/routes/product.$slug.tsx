import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Lock,
  MessageCircle,
  Minus,
  PlayCircle,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { useState } from "react";

import { Price, ProductCard, ProductImage, SampleBadge, TrustRow } from "@/components/shop-ui";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brand } from "@/lib/brand";
import { cart } from "@/lib/cart";
import { getCourseOutline } from "@/lib/account-api";
import { type Curriculum, formatMinutes } from "@/lib/course-types";
import { getShopStatus } from "@/lib/order-api";
import { MAX_QTY } from "@/lib/order-types";
import { getProductPage } from "@/lib/shop-api";
import { AVAILABILITY_LABEL, KIND_LABEL, formatINR } from "@/lib/shop-types";
import { whatsappUrl } from "@/lib/whatsapp";

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params }) => {
    const [{ product }, status] = await Promise.all([
      getProductPage({ data: { slug: params.slug } }),
      getShopStatus(),
    ]);
    if (!product) throw notFound();
    const course =
      product.kind === "course"
        ? await getCourseOutline({ data: { productId: product.id } })
        : null;
    return { product, paymentsEnabled: status.paymentsEnabled, course };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.product;
    const title = p ? `${p.name} | ${brand.name}` : `Product | ${brand.name}`;
    const description = p?.shortDescription || brand.description;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { product: p, paymentsEnabled, course } = Route.useLoaderData();
  const [active, setActive] = useState(0);
  // Products sold in several options: start on the first one that can be bought.
  const [variantId, setVariantId] = useState<number | null>(
    () => (p.variants.find((v) => v.purchasable) ?? p.variants[0])?.id ?? null,
  );
  const variant = p.variants.find((v) => v.id === variantId) ?? null;
  const price = variant
    ? { pricePaise: variant.pricePaise, compareAtPaise: variant.compareAtPaise }
    : { pricePaise: p.pricePaise, compareAtPaise: p.compareAtPaise };
  const availability = variant ? variant.availability : p.availability;
  const purchasable = variant ? variant.purchasable : p.purchasable;
  const sku = variant?.sku ?? p.sku;
  const images = p.imageIds.length ? p.imageIds : [null];
  const enquiry = whatsappUrl(
    `Hello White Portion Wellness! I'm interested in "${p.name}${variant ? ` (${variant.name})` : ""}"${availability === "enquiry_only" ? "" : ` (${formatINR(price.pricePaise)})`}.`,
  );

  return (
    <main>
      <SiteHeader isSolid />

      <section className="page-section section-wrap bg-cream !pt-10">
        <nav
          aria-label="Breadcrumb"
          className="text-[11px] text-muted-foreground mb-8 flex flex-wrap items-center gap-1.5"
        >
          <Link
            to="/services-products"
            hash="products"
            className="hover:text-primary inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" aria-hidden="true" /> Services & Products
          </Link>
          <span>/</span>
          <Link
            to="/products/$category"
            params={{ category: p.topCategorySlug }}
            className="hover:text-primary"
          >
            {p.topCategoryName}
          </Link>
          {p.categorySlug !== p.topCategorySlug && (
            <>
              <span>/</span>
              <Link
                to="/products/$category"
                params={{ category: p.topCategorySlug }}
                search={{ sub: p.categorySlug }}
                className="hover:text-primary"
              >
                {p.categoryName}
              </Link>
            </>
          )}
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          {/* Gallery */}
          <div>
            <div className="aspect-square rounded overflow-hidden border border-border bg-secondary">
              <ProductImage imageId={images[active] ?? null} alt={p.name} kind={p.kind} />
            </div>
            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {images.map((id, i) => (
                  <button
                    key={id ?? i}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`Show image ${i + 1}`}
                    className={`aspect-square rounded overflow-hidden border-2 transition-colors ${i === active ? "border-primary" : "border-transparent hover:border-border"}`}
                  >
                    <ProductImage imageId={id} alt="" kind={p.kind} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold tracking-widest text-primary uppercase">
                {p.categoryName} · {KIND_LABEL[p.kind]}
              </span>
              {p.isSample && <SampleBadge />}
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-medium text-charcoal leading-tight">
              {p.name}
            </h1>
            {availability !== "enquiry_only" && (
              <div className="space-y-1">
                <div className="text-2xl">
                  <Price pricePaise={price.pricePaise} compareAtPaise={price.compareAtPaise} />
                </div>
                {p.gstRateBps > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Inclusive of {p.gstRateBps / 100}% GST
                  </p>
                )}
              </div>
            )}
            <p
              className={`text-xs font-semibold ${availability === "out_of_stock" ? "text-destructive" : "text-primary"}`}
            >
              {AVAILABILITY_LABEL[availability]}
              {sku && <span className="ml-3 font-normal text-muted-foreground">SKU {sku}</span>}
            </p>
            {p.shortDescription && (
              <p className="text-sm text-muted-foreground leading-relaxed">{p.shortDescription}</p>
            )}

            {p.variants.length > 0 && (
              <fieldset>
                <legend className="text-xs font-bold text-charcoal mb-2">Choose an option</legend>
                <div className="flex flex-wrap gap-2">
                  {p.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={v.id === variantId}
                      onClick={() => setVariantId(v.id)}
                      className={`px-4 py-2 rounded border text-xs font-semibold transition-colors ${
                        v.id === variantId
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-charcoal hover:border-primary"
                      } ${v.purchasable ? "" : "opacity-50 line-through"}`}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {p.previewFileId && (
              <a
                href={`/media/${p.previewFileId}`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 text-xs font-semibold text-primary underline underline-offset-4"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" /> Read a free preview (PDF)
              </a>
            )}

            {course?.curriculum && <CourseFacts course={course.curriculum} />}

            <div data-purchase-area className="pt-2 space-y-3">
              {course?.enrolled ? (
                <Link
                  to="/learn/$slug"
                  params={{ slug: p.slug }}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded bg-primary text-primary-foreground text-xs font-bold tracking-wider hover:bg-olive-deep"
                >
                  <PlayCircle className="w-4 h-4" aria-hidden="true" /> YOU'RE ENROLLED · GO TO
                  COURSE
                </Link>
              ) : purchasable && paymentsEnabled ? (
                <AddToCart
                  productId={p.id}
                  variantId={variant?.id ?? null}
                  digital={p.kind === "ebook" || p.kind === "course"}
                />
              ) : purchasable ? (
                <p className="text-xs text-muted-foreground">
                  Online checkout is opening soon. Message us to order now.
                </p>
              ) : availability === "enquiry_only" ? (
                <p className="text-xs text-muted-foreground">
                  {p.requiresPrescription
                    ? "This product requires a valid prescription and is available on enquiry only."
                    : "This product is available on enquiry only."}
                </p>
              ) : null}
              <a
                href={enquiry}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  purchasable && paymentsEnabled
                    ? "inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
                    : "inline-flex items-center gap-2 px-5 py-3 rounded bg-primary text-primary-foreground text-xs font-bold tracking-wider hover:bg-olive-deep transition-colors"
                }
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />{" "}
                {purchasable && paymentsEnabled
                  ? "Questions? Ask us on WhatsApp"
                  : "ENQUIRE ON WHATSAPP"}
              </a>
            </div>

            <TrustRow />
          </div>
        </div>

        {course?.curriculum && course.curriculum.modules.length > 0 && (
          <CourseOutline slug={p.slug} course={course.curriculum} enrolled={course.enrolled} />
        )}

        {/* Description + details */}
        <div className="mt-14 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {p.description && (
            <div className="lg:col-span-2 page-card !p-7">
              <h2 className="text-xs font-bold tracking-widest text-primary uppercase mb-4">
                Description
              </h2>
              <div className="text-sm text-charcoal leading-relaxed whitespace-pre-line">
                {p.description}
              </div>
            </div>
          )}
          {p.details.length > 0 && (
            <div className="page-card !p-7">
              <h2 className="text-xs font-bold tracking-widest text-primary uppercase mb-4">
                Product details
              </h2>
              <dl className="divide-y divide-border text-sm">
                {p.details.map((d, i) => (
                  <div key={i} className="py-2.5 flex justify-between gap-4">
                    {d.label && <dt className="text-muted-foreground">{d.label}</dt>}
                    <dd className="text-charcoal font-medium text-right">{d.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        {p.kind === "pharma" && (
          <p className="mt-8 text-[11px] text-muted-foreground max-w-3xl leading-relaxed">
            Always read the label before use. Consult your doctor or pharmacist if you are pregnant,
            breastfeeding, taking other medicines or unsure whether this product is suitable for
            you.
          </p>
        )}
        {p.kind === "physical" && (
          <p className="mt-8 text-[11px] text-muted-foreground max-w-3xl leading-relaxed">
            Food supplements are not a substitute for a varied, balanced diet and a healthy
            lifestyle.
          </p>
        )}
      </section>

      {p.related.length > 0 && (
        <section className="page-section section-wrap bg-secondary">
          <h2 className="text-3xl font-display font-medium text-charcoal mb-8">Related products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {p.related.map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      )}

      <SiteFooter />
    </main>
  );
}

function AddToCart({
  productId,
  variantId,
  digital,
}: {
  productId: number;
  variantId: number | null;
  digital: boolean;
}) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const navigate = useNavigate();

  function add() {
    cart.add({ productId, variantId }, qty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {!digital && (
          <div className="inline-flex items-center border border-border rounded bg-background">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="p-3 text-charcoal hover:text-primary disabled:opacity-40"
              disabled={qty <= 1}
            >
              <Minus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <span className="w-8 text-center text-sm font-semibold" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
              className="p-3 text-charcoal hover:text-primary disabled:opacity-40"
              disabled={qty >= MAX_QTY}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-2 px-5 py-3 rounded border border-primary text-primary text-xs font-bold tracking-wider hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          {added ? (
            <Check className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
          )}
          {added ? "ADDED TO CART" : "ADD TO CART"}
        </button>
        <button
          type="button"
          onClick={() => {
            cart.add({ productId, variantId }, qty);
            void navigate({ to: "/checkout" });
          }}
          className="inline-flex items-center gap-2 px-5 py-3 rounded bg-primary text-primary-foreground text-xs font-bold tracking-wider hover:bg-olive-deep transition-colors"
        >
          BUY NOW
        </button>
      </div>
      {added && (
        <p className="text-xs text-primary" role="status">
          Added.{" "}
          <Link to="/cart" className="font-semibold underline">
            View cart
          </Link>
        </p>
      )}
    </div>
  );
}

function CourseFacts({ course }: { course: Curriculum }) {
  const facts = [
    course.info.instructor && ["Instructor", course.info.instructor],
    course.info.duration && ["Duration", course.info.duration],
    course.info.level && ["Level", course.info.level],
    course.lessonCount > 0 && [
      "Lessons",
      `${course.lessonCount}${course.totalMinutes ? ` · ${formatMinutes(course.totalMinutes)} of video` : ""}`,
    ],
  ].filter(Boolean) as [string, string][];
  if (facts.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs border-y border-border py-3">
      {facts.map(([k, v]) => (
        <div key={k}>
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-semibold text-charcoal">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function CourseOutline({
  slug,
  course,
  enrolled,
}: {
  slug: string;
  course: Curriculum;
  enrolled: boolean;
}) {
  return (
    <div className="mt-14 grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 page-card !p-7 space-y-5">
        <h2 className="text-xs font-bold tracking-widest text-primary uppercase">
          Course curriculum
        </h2>
        {course.modules.map((m, i) => (
          <div key={m.id}>
            <h3 className="font-display text-xl text-charcoal mb-2">
              {i + 1}. {m.title}
            </h3>
            <ul className="divide-y divide-border text-sm">
              {m.lessons.map((l) => (
                <li key={l.id} className="py-2 flex items-center gap-3">
                  {enrolled || l.isPreview ? (
                    <PlayCircle className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                  ) : (
                    <Lock className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  )}
                  {enrolled || l.isPreview ? (
                    <Link
                      to="/learn/$slug"
                      params={{ slug }}
                      search={{ lesson: l.id }}
                      className="flex-1 text-charcoal hover:text-primary"
                    >
                      {l.title}
                      {!enrolled && (
                        <span className="ml-2 text-[10px] font-bold text-primary">
                          FREE PREVIEW
                        </span>
                      )}
                    </Link>
                  ) : (
                    <span className="flex-1 text-charcoal">{l.title}</span>
                  )}
                  {l.durationMinutes > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {formatMinutes(l.durationMinutes)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {course.info.instructor && (
        <div className="page-card !p-7 space-y-3">
          <h2 className="text-xs font-bold tracking-widest text-primary uppercase">
            Your instructor
          </h2>
          <p className="font-display text-2xl text-charcoal">{course.info.instructor}</p>
          {course.info.instructorBio && (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {course.info.instructorBio}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
