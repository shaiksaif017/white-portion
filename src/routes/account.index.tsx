import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { BookOpen, Download, LogOut, Package, PlayCircle, User } from "lucide-react";
import { useState } from "react";

import { ProductImage } from "@/components/shop-ui";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  getAccount,
  logoutAllDevices,
  logoutCustomer,
  updateAccountProfile,
} from "@/lib/account-api";
import { brand } from "@/lib/brand";
import { percent } from "@/lib/course-types";
import { FULFILMENT_LABEL, PAYMENT_LABEL } from "@/lib/order-types";
import type { FulfilmentStatus, PaymentStatus } from "@/lib/order-types";
import { formatINR } from "@/lib/shop-types";

export const Route = createFileRoute("/account/")({
  loader: async () => {
    const data = await getAccount();
    if (!data.loggedIn) throw redirect({ to: "/account/login", search: { redirect: undefined } });
    return data;
  },
  head: () => ({
    meta: [{ title: `My account | ${brand.name}` }, { name: "robots", content: "noindex" }],
  }),
  component: AccountPage,
});

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function AccountPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [name, setName] = useState(data.customer.name);
  const [phone, setPhone] = useState(data.customer.phone);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await updateAccountProfile({ data: { name, phone } });
      setMsg(r.ok ? "Saved." : r.error);
    } catch {
      setMsg("Please check the phone number.");
    }
  }

  async function logout(all: boolean) {
    if (all) await logoutAllDevices();
    else await logoutCustomer();
    await router.invalidate();
    window.location.assign("/");
  }

  return (
    <main>
      <SiteHeader isSolid />
      <section className="page-section section-wrap bg-cream !pt-10 min-h-[60vh] space-y-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-primary uppercase">
              My account
            </p>
            <h1 className="text-4xl md:text-5xl font-display font-medium text-charcoal">
              {data.customer.name ? `Hello, ${data.customer.name.split(" ")[0]}` : "Welcome"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{data.customer.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout(false)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" /> Log out
          </button>
        </div>

        {/* Courses */}
        <section aria-labelledby="my-courses" className="space-y-4">
          <h2
            id="my-courses"
            className="text-xs font-bold tracking-widest text-primary uppercase flex items-center gap-2"
          >
            <PlayCircle className="w-4 h-4" aria-hidden="true" /> My courses
          </h2>
          {data.courses.length === 0 ? (
            <Empty text="You haven't enrolled in a course yet.">
              <Link
                to="/products/$category"
                params={{ category: "online-courses" }}
                className="text-primary font-semibold underline"
              >
                Browse online courses
              </Link>
            </Empty>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.courses.map((c) => {
                const pct = percent(c.completedCount, c.lessonCount);
                return (
                  <div key={c.productId} className="page-card !p-0 overflow-hidden flex flex-col">
                    <div className="aspect-video bg-secondary">
                      <ProductImage imageId={c.imageId} alt="" kind="course" />
                    </div>
                    <div className="p-5 space-y-3 flex-1 flex flex-col">
                      <h3 className="font-display text-xl text-charcoal leading-tight">{c.name}</h3>
                      <div>
                        <div
                          className="h-1.5 rounded bg-secondary overflow-hidden"
                          aria-hidden="true"
                        >
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {c.lessonCount === 0
                            ? "Lessons coming soon"
                            : `${c.completedCount} of ${c.lessonCount} lessons complete (${pct}%)`}
                        </p>
                      </div>
                      <Link
                        to="/learn/$slug"
                        params={{ slug: c.slug }}
                        search={c.nextLessonId ? { lesson: c.nextLessonId } : {}}
                        className="mt-auto inline-flex justify-center px-4 py-2.5 rounded bg-primary text-primary-foreground text-xs font-bold tracking-wider hover:bg-olive-deep"
                      >
                        {c.completedCount === 0
                          ? "START COURSE"
                          : pct === 100
                            ? "REVIEW COURSE"
                            : "CONTINUE"}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Downloads */}
        <section aria-labelledby="my-downloads" className="space-y-4">
          <h2
            id="my-downloads"
            className="text-xs font-bold tracking-widest text-primary uppercase flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" aria-hidden="true" /> My downloads
          </h2>
          {data.downloads.length === 0 ? (
            <Empty text="No e-books yet." />
          ) : (
            <ul className="page-card !p-0 divide-y divide-border">
              {data.downloads.map((d) => (
                <li
                  key={d.itemId}
                  className="p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold text-charcoal text-sm">{d.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Order {d.orderNumber} · {fmtDate(d.purchasedAt)}
                    </p>
                  </div>
                  <a
                    href={`/api/download?o=${encodeURIComponent(d.orderNumber)}&t=${encodeURIComponent(d.accessToken)}&i=${d.itemId}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-primary text-primary text-[11px] font-bold tracking-wider hover:bg-primary hover:text-primary-foreground"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" /> DOWNLOAD
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Orders */}
        <section aria-labelledby="my-orders" className="space-y-4">
          <h2
            id="my-orders"
            className="text-xs font-bold tracking-widest text-primary uppercase flex items-center gap-2"
          >
            <Package className="w-4 h-4" aria-hidden="true" /> Order history
          </h2>
          {data.orders.length === 0 ? (
            <Empty text="No orders yet.">
              <Link to="/products" className="text-primary font-semibold underline">
                Shop products
              </Link>
            </Empty>
          ) : (
            <div className="page-card !p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/70 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-3">Order</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Items</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.orders.map((o) => (
                    <tr key={o.orderNumber}>
                      <td className="p-3">
                        <Link
                          to="/order/$number"
                          params={{ number: o.orderNumber }}
                          search={{ t: o.accessToken }}
                          className="font-bold text-primary underline-offset-2 hover:underline"
                        >
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="p-3 whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                      <td className="p-3 max-w-xs truncate" title={o.summary}>
                        {o.summary}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap font-semibold">
                        {formatINR(o.totalPaise)}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {o.paymentStatus === "paid"
                          ? FULFILMENT_LABEL[o.fulfilmentStatus as FulfilmentStatus]
                          : PAYMENT_LABEL[o.paymentStatus as PaymentStatus]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Profile */}
        <section aria-labelledby="my-profile" className="space-y-4 max-w-xl">
          <h2
            id="my-profile"
            className="text-xs font-bold tracking-widest text-primary uppercase flex items-center gap-2"
          >
            <User className="w-4 h-4" aria-hidden="true" /> Profile
          </h2>
          <form
            onSubmit={saveProfile}
            className="page-card !p-6 grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <div>
              <label htmlFor="pf-name" className="block text-xs font-bold text-charcoal mb-1">
                Name
              </label>
              <input
                id="pf-name"
                className="w-full p-2.5 rounded border border-border bg-background text-sm"
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="pf-phone" className="block text-xs font-bold text-charcoal mb-1">
                Phone
              </label>
              <input
                id="pf-phone"
                type="tel"
                className="w-full p-2.5 rounded border border-border bg-background text-sm"
                maxLength={20}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
              <button
                type="submit"
                className="px-4 py-2.5 rounded bg-primary text-primary-foreground text-xs font-bold tracking-wider hover:bg-olive-deep"
              >
                SAVE
              </button>
              {msg && (
                <span className="text-xs text-charcoal" role="status">
                  {msg}
                </span>
              )}
              <button
                type="button"
                onClick={() => void logout(true)}
                className="text-[11px] text-muted-foreground hover:text-destructive"
              >
                Log out on all devices
              </button>
            </div>
          </form>
        </section>
      </section>
      <SiteFooter />
    </main>
  );
}

function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="page-card !p-6 text-sm text-muted-foreground">
      {text} {children}
    </div>
  );
}
