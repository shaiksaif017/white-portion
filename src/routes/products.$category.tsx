import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import {
  type ProductSearch,
  hasActiveFilters,
  ProductFilters,
  productSearchSchema,
  toProductQuery,
} from "@/components/product-filters";
import { KindIcon, ProductCard, TrustRow } from "@/components/shop-ui";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brand } from "@/lib/brand";
import { getCategoryPage } from "@/lib/shop-api";
import { whatsappUrl } from "@/lib/whatsapp";

export const Route = createFileRoute("/products/$category")({
  validateSearch: productSearchSchema.extend({
    sub: z
      .string()
      .regex(/^[a-z0-9-]{1,80}$/)
      .optional()
      .catch(undefined),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const data = await getCategoryPage({
      data: {
        slug: params.category,
        ...(deps.sub ? { sub: deps.sub } : {}),
        ...toProductQuery(deps),
      },
    });
    if (!data.found) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.found
      ? (loaderData.activeSub?.name ?? loaderData.category.name)
      : "Products";
    const description = loaderData?.found ? loaderData.category.description : brand.description;
    return {
      meta: [
        { title: `${name} | ${brand.name}` },
        { name: "description", content: description },
        { property: "og:title", content: `${name} | ${brand.name}` },
        { property: "og:description", content: description },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  if (!data.found) return null;
  const filters: ProductSearch = {
    q: search.q,
    sort: search.sort,
    stock: search.stock,
    min: search.min,
    max: search.max,
  };
  const filtering = hasActiveFilters(filters);
  // "Coming soon" only when the collection is really empty, not when filters hide everything.
  const collectionEmpty = (activeSubCount(data) ?? 0) === 0 && !filtering;
  const { category, subcategories, activeSub, products } = data;
  const isPharma = category.kind === "pharma";

  return (
    <main>
      <SiteHeader isSolid />

      <section className="page-hero">
        <div className="page-hero-inner">
          <Link
            to="/services-products"
            hash="products"
            className="page-hero-badge inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Services & Products
          </Link>
          <h1 className="flex items-center gap-4">{category.name.toUpperCase()}</h1>
          <p className="page-hero-desc">{activeSub?.description || category.description}</p>
        </div>
      </section>

      <section className="page-section section-wrap bg-cream">
        {subcategories.length > 0 && (
          <nav aria-label={`${category.name} categories`} className="flex flex-wrap gap-2 mb-10">
            <Link
              to="/products/$category"
              params={{ category: category.slug }}
              search={{}}
              className={`text-xs font-semibold px-4 py-2 rounded border transition-colors ${
                !activeSub
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-charcoal hover:border-primary"
              }`}
            >
              All
            </Link>
            {subcategories.map((s) => (
              <Link
                key={s.id}
                to="/products/$category"
                params={{ category: category.slug }}
                search={{ sub: s.slug }}
                className={`text-xs font-semibold px-4 py-2 rounded border transition-colors ${
                  activeSub?.id === s.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-charcoal hover:border-primary"
                }`}
              >
                {s.name}
                {s.productCount > 0 && (
                  <span className="ml-1.5 opacity-70">({s.productCount})</span>
                )}
              </Link>
            ))}
          </nav>
        )}

        {isPharma && (
          <div className="mb-8 p-4 rounded border border-border bg-secondary/50 text-xs text-charcoal leading-relaxed max-w-3xl">
            Only over-the-counter (OTC) products can be ordered online. Prescription products are
            available on enquiry and need a valid prescription. Always read the label and consult
            your doctor or pharmacist if you are unsure whether a product is right for you.
          </div>
        )}

        {!collectionEmpty && (
          <ProductFilters
            value={filters}
            resultCount={products.length}
            showStockFilter={category.kind === "physical" || category.kind === "pharma"}
            onChange={(next) =>
              void navigate({
                search: (prev) => ({ sub: prev.sub, ...next }),
                replace: true,
                resetScroll: false,
              })
            }
          />
        )}

        {products.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            <div className="mt-10">
              <TrustRow />
            </div>
          </>
        ) : !collectionEmpty ? (
          <div className="page-card !p-10 text-center max-w-xl mx-auto" role="status">
            <h2 className="text-2xl font-display text-charcoal">No matching products</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Try a different search or clear the filters.
            </p>
            <Link
              to="/products/$category"
              params={{ category: category.slug }}
              search={{ sub: search.sub }}
              className="inline-block mt-5 text-xs font-semibold text-primary underline underline-offset-4"
            >
              Clear filters
            </Link>
          </div>
        ) : (
          <div className="page-card !p-10 text-center max-w-xl mx-auto">
            <span className="w-14 h-14 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
              <KindIcon kind={category.kind} />
            </span>
            <h2 className="text-2xl font-display text-charcoal">Coming soon</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              We're preparing {activeSub ? activeSub.name.toLowerCase() : "this collection"}.
              Message us and we'll let you know when it's available.
            </p>
            <a
              href={whatsappUrl(
                `Hello White Portion Wellness! Please let me know when ${activeSub?.name ?? category.name} is available.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-5 text-xs font-semibold text-primary underline underline-offset-4"
            >
              Notify me on WhatsApp
            </a>
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}

// Number of active products in the current view (sub-category or whole category).
function activeSubCount(data: {
  category: { productCount: number };
  activeSub: { productCount: number } | null;
}): number {
  return data.activeSub ? data.activeSub.productCount : data.category.productCount;
}
