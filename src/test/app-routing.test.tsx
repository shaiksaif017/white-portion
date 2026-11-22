import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches all dedicated multi-pages cleanly", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const pages = [
      "/about",
      "/services",
      "/mens-coaching",
      "/womens-wellness",
      "/pcos-nutrition",
      "/bodybuilding-prep",
      "/approach",
      "/stories",
      "/blog",
      "/services-products",
      "/products/supplements-nutrition",
      "/product/example-product",
      "/contact",
      "/book-appointment",
      "/admin",
    ];

    for (const page of pages) {
      const matches = router.matchRoutes(page);
      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    }
  });
});
