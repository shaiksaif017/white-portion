import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { ProductCategoriesGrid } from "@/components/product-categories-grid";
import {
  hasActiveFilters,
  ProductFilters,
  productSearchSchema,
  toProductQuery,
} from "@/components/product-filters";
import { ProductCard, TrustRow } from "@/components/shop-ui";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";
import { getFeaturedProducts, getShopCategories, searchProducts } from "@/lib/shop-api";

export const Route = createFileRoute("/products/")({
  validateSearch: productSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const searching = hasActiveFilters(deps) || Boolean(deps.sort);
    const [{ categories }, { products: featured }, results] = await Promise.all([
      getShopCategories(),
      getFeaturedProducts(),
      searching ? searchProducts({ data: toProductQuery(deps) }) : Promise.resolve(null),
    ]);
    return { categories, featured, results: results?.products ?? null };
  },
  head: () => ({
    meta: [
      { title: `Products | ${brand.name}` },
      {
        name: "description",
        content: `Supplements, e-books, online courses and healthcare products from ${brand.name}.`,
      },
      { property: "og:title", content: `Products | ${brand.name}` },
      { property: "og:description", content: brand.description },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { categories, featured, results } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <main>
      <SiteHeader isSolid />

      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-badge">Products</span>
          <h1>
            SUPPORT YOUR PROGRESS,
            <br />
            <em>between every check-in.</em>
          </h1>
          <p className="page-hero-desc">
            Carefully selected supplements, practical guides, self-paced courses and healthcare
            essentials, chosen by our coaching team.
          </p>
        </div>
      </section>

      <section className="page-section section-wrap bg-cream !pb-6">
        <h2 className="text-3xl md:text-4xl font-display font-medium text-charcoal mb-6">
          Search all products
        </h2>
        <ProductFilters
          value={search}
          resultCount={results?.length ?? 0}
          onChange={(next) => void navigate({ search: next, replace: true, resetScroll: false })}
        />
        {results && (
          <div className="pb-10">
            {results.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {results.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground" role="status">
                No products match your search. Try another word, or browse the categories below.
              </p>
            )}
          </div>
        )}
        {!results && featured.length > 0 && (
          <div className="pb-10">
            <h3 className="text-xs font-bold tracking-widest text-primary uppercase mb-5">
              Featured
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="page-section section-wrap bg-secondary">
        <div className="mb-10 max-w-2xl space-y-3">
          <h2 className="text-3xl md:text-4xl font-display font-medium text-charcoal">
            Shop by category
          </h2>
          <TrustRow />
        </div>
        <ProductCategoriesGrid categories={categories} />
      </section>

      <section className="page-section section-wrap bg-olive-deep text-paper">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <p className="text-xs font-bold tracking-widest text-gold-accent uppercase">
            Want personal guidance?
          </p>
          <h2 className="text-4xl md:text-5xl font-display font-medium">
            Pair products with coaching.
          </h2>
          <p className="text-sm text-paper-soft leading-relaxed max-w-xl mx-auto">
            Our coaches can recommend what fits your goals as part of a one-to-one programme.
          </p>
          <div className="pt-4 flex flex-wrap justify-center gap-3">
            <Button asChild variant="hero">
              <Link to="/book-appointment">
                Book a consultation <ArrowUpRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="heroOutline">
              <Link to="/services">View coaching services</Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
