import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { useState } from "react";

import { Price, ProductCard, ProductImage, TrustRow } from "@/components/shop-ui";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brand } from "@/lib/brand";
import { getProductPage } from "@/lib/shop-api";
import { AVAILABILITY_LABEL, KIND_LABEL, formatINR } from "@/lib/shop-types";
import { whatsappUrl } from "@/lib/whatsapp";

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params }) => {
    const { product } = await getProductPage({ data: { slug: params.slug } });
    if (!product) throw notFound();
    return { product };
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
  const { product: p } = Route.useLoaderData();
  const [active, setActive] = useState(0);
  const images = p.imageIds.length ? p.imageIds : [null];
  const enquiry = whatsappUrl(
    `Hello White Portion Wellness! I'm interested in "${p.name}"${p.availability === "enquiry_only" ? "" : ` (${formatINR(p.pricePaise)})`}.`,
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
            <span className="text-[10px] font-bold tracking-widest text-primary uppercase">
              {p.categoryName} · {KIND_LABEL[p.kind]}
            </span>
            <h1 className="text-4xl md:text-5xl font-display font-medium text-charcoal leading-tight">
              {p.name}
            </h1>
            {p.availability !== "enquiry_only" && (
              <div className="text-2xl">
                <Price pricePaise={p.pricePaise} compareAtPaise={p.compareAtPaise} />
              </div>
            )}
            <p
              className={`text-xs font-semibold ${p.availability === "out_of_stock" ? "text-destructive" : "text-primary"}`}
            >
              {AVAILABILITY_LABEL[p.availability]}
            </p>
            {p.shortDescription && (
              <p className="text-sm text-muted-foreground leading-relaxed">{p.shortDescription}</p>
            )}

            <div data-purchase-area className="pt-2 space-y-3">
              {p.purchasable ? (
                <p className="text-xs text-muted-foreground">
                  Online checkout is opening soon. Message us to order now.
                </p>
              ) : p.availability === "enquiry_only" ? (
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
                className="inline-flex items-center gap-2 px-5 py-3 rounded bg-primary text-primary-foreground text-xs font-bold tracking-wider hover:bg-olive-deep transition-colors"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" /> ENQUIRE ON WHATSAPP
              </a>
            </div>

            <TrustRow />
          </div>
        </div>

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
