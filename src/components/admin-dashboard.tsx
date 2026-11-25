// Admin > Dashboard: sales, orders, stock and course figures at a glance.
import {
  AlertTriangle,
  CalendarClock,
  GraduationCap,
  IndianRupee,
  Package,
  ShoppingBag,
} from "lucide-react";
import { useEffect, useState } from "react";

import { adminGetDashboardStats } from "@/lib/admin-auth-api";
import type { DashboardStats } from "@/lib/admin-types";
import { FULFILMENT_LABEL, PAYMENT_LABEL } from "@/lib/order-types";
import type { FulfilmentStatus, PaymentStatus } from "@/lib/order-types";
import { formatINR } from "@/lib/shop-types";

export function AdminDashboard({
  onSessionExpired,
  goTo,
}: {
  onSessionExpired: (msg: string) => void;
  goTo: (tab: "orders" | "products" | "bookings") => void;
}) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [includeSample, setIncludeSample] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStats(null);
    adminGetDashboardStats({ data: { includeSample } })
      .then((r) => {
        if (r.ok) setStats(r.stats);
        else if (/session has expired/i.test(r.error)) onSessionExpired(r.error);
        else setError(r.error);
      })
      .catch(() => setError("Could not reach the server."));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the toggle changes
  }, [includeSample]);

  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!stats) return <p className="text-xs text-muted-foreground">Loading dashboard…</p>;

  const change = stats.revenue.prev30Paise
    ? Math.round(
        ((stats.revenue.last30Paise - stats.revenue.prev30Paise) / stats.revenue.prev30Paise) * 100,
      )
    : null;
  const maxDay = Math.max(1, ...stats.daily.map((d) => d.paise));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-display font-medium text-charcoal">Dashboard</h3>
          <p className="text-xs text-muted-foreground">
            Paid orders only; refunds excluded. Days in India time.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-charcoal">
          <input
            type="checkbox"
            checked={includeSample}
            onChange={(e) => setIncludeSample(e.target.checked)}
          />
          Include sample data
        </label>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile
          icon={<IndianRupee className="w-4 h-4" />}
          label="Revenue, last 30 days"
          value={formatINR(stats.revenue.last30Paise)}
          note={
            change === null
              ? "No sales in the 30 days before"
              : `${change >= 0 ? "+" : ""}${change}% vs previous 30 days`
          }
        />
        <Tile
          icon={<ShoppingBag className="w-4 h-4" />}
          label="Orders to fulfil"
          value={String(stats.orders.toFulfil)}
          note={`${stats.orders.paid} paid · ${stats.orders.refunded} refunded`}
          onClick={() => goTo("orders")}
        />
        <Tile
          icon={<GraduationCap className="w-4 h-4" />}
          label="Course students"
          value={String(stats.enrolments.total)}
          note={`${stats.enrolments.last30} new in 30 days`}
        />
        <Tile
          icon={<CalendarClock className="w-4 h-4" />}
          label="Bookings to confirm"
          value={String(stats.bookings.pending)}
          note={`${stats.bookings.upcoming} confirmed upcoming`}
          onClick={() => goTo("bookings")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section
          className="lg:col-span-2 border border-border rounded p-5 bg-background"
          aria-labelledby="dash-trend"
        >
          <div className="flex justify-between items-baseline mb-4">
            <h4
              id="dash-trend"
              className="text-xs font-bold tracking-widest text-primary uppercase"
            >
              Sales, last 30 days
            </h4>
            <span className="text-[11px] text-muted-foreground">
              All time {formatINR(stats.revenue.allTimePaise)} · average order{" "}
              {formatINR(stats.revenue.avgOrderPaise)}
            </span>
          </div>
          <div
            className="flex items-end gap-[3px] h-40"
            role="img"
            aria-label="Daily sales for the last 30 days"
          >
            {stats.daily.map((d) => (
              <div key={d.date} className="flex-1 h-full flex items-end group relative">
                <div
                  className={`w-full rounded-t ${d.paise ? "bg-primary" : "bg-border"}`}
                  style={{ height: `${d.paise ? Math.max(4, (d.paise / maxDay) * 100) : 2}%` }}
                />
                <span className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-charcoal text-paper text-[10px] px-1.5 py-0.5 opacity-0 group-hover:opacity-100">
                  {d.date.slice(5)}: {formatINR(d.paise)} ({d.orders})
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{stats.daily[0]?.date.slice(5)}</span>
            <span>today</span>
          </div>
        </section>

        <section
          className="border border-border rounded p-5 bg-background space-y-3"
          aria-labelledby="dash-best"
        >
          <h4 id="dash-best" className="text-xs font-bold tracking-widest text-primary uppercase">
            Best sellers (90 days)
          </h4>
          {stats.bestSellers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sales yet.</p>
          ) : (
            <ol className="space-y-2 text-xs">
              {stats.bestSellers.map((b, i) => (
                <li key={b.name} className="flex justify-between gap-3">
                  <span className="text-charcoal">
                    {i + 1}. {b.name}
                  </span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {b.qty} sold · {formatINR(b.revenuePaise)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {stats.enrolments.topCourses.length > 0 && (
            <>
              <h4 className="text-xs font-bold tracking-widest text-primary uppercase pt-2">
                Top courses
              </h4>
              <ul className="space-y-1 text-xs">
                {stats.enrolments.topCourses.map((c) => (
                  <li key={c.name} className="flex justify-between gap-3">
                    <span>{c.name}</span>
                    <span className="text-muted-foreground">{c.students} students</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section
          className="lg:col-span-2 border border-border rounded p-5 bg-background"
          aria-labelledby="dash-recent"
        >
          <div className="flex justify-between mb-3">
            <h4
              id="dash-recent"
              className="text-xs font-bold tracking-widest text-primary uppercase"
            >
              Recent orders
            </h4>
            <button
              type="button"
              className="text-[11px] text-primary font-semibold"
              onClick={() => goTo("orders")}
            >
              All orders →
            </button>
          </div>
          {stats.recentOrders.length === 0 ? (
            <p className="text-xs text-muted-foreground">No orders yet.</p>
          ) : (
            <table className="w-full text-xs">
              <tbody className="divide-y divide-border">
                {stats.recentOrders.map((o) => (
                  <tr key={o.orderNumber}>
                    <td className="py-2 font-semibold">{o.orderNumber}</td>
                    <td className="py-2">{o.name}</td>
                    <td className="py-2 text-muted-foreground whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">{formatINR(o.totalPaise)}</td>
                    <td className="py-2 pl-3 whitespace-nowrap">
                      {o.paymentStatus === "paid"
                        ? FULFILMENT_LABEL[o.fulfilmentStatus as FulfilmentStatus]
                        : PAYMENT_LABEL[o.paymentStatus as PaymentStatus]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section
          className="border border-border rounded p-5 bg-background space-y-3"
          aria-labelledby="dash-stock"
        >
          <h4
            id="dash-stock"
            className="text-xs font-bold tracking-widest text-primary uppercase flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> Low stock (5 or fewer)
          </h4>
          {stats.lowStock.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing running low.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {stats.lowStock.map((s) => (
                <li key={`${s.productId}-${s.option ?? ""}`} className="flex justify-between gap-3">
                  <span>
                    {s.name}
                    {s.option ? ` (${s.option})` : ""}
                  </span>
                  <span
                    className={
                      s.stock === 0 ? "font-bold text-destructive" : "font-semibold text-amber-700"
                    }
                  >
                    {s.stock === 0 ? "Sold out" : `${s.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
            <Package className="w-3.5 h-3.5" aria-hidden="true" />
            {stats.products.active} active products · {stats.products.draft} drafts ·{" "}
            <button
              type="button"
              className="text-primary font-semibold"
              onClick={() => goTo("products")}
            >
              Manage
            </button>
          </p>
          {stats.orders.pending > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {stats.orders.pending} checkout{stats.orders.pending === 1 ? "" : "s"} awaiting
              payment in the last 3 days.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  note,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-primary uppercase">
        {icon} {label}
      </span>
      <span className="block text-2xl font-display text-charcoal mt-2">{value}</span>
      <span className="block text-[11px] text-muted-foreground mt-1">{note}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="text-left border border-border rounded p-4 bg-background hover:border-primary transition-colors"
    >
      {body}
    </button>
  ) : (
    <div className="border border-border rounded p-4 bg-background">{body}</div>
  );
}
