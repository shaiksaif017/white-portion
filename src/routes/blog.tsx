// The Journal page was replaced by Services & Products. Old links redirect permanently.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/blog")({
  beforeLoad: () => {
    throw redirect({ to: "/services-products", statusCode: 301 });
  },
});
