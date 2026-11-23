import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { ProductCategoriesGrid } from "@/components/product-categories-grid";
import { TrustRow } from "@/components/shop-ui";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";
import { getShopCategories } from "@/lib/shop-api";

export const Route = createFileRoute("/products/")({
  loader: () => getShopCategories(),
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
  const { categories } = Route.useLoaderData();

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
