// Figures for the admin dashboard. Revenue counts paid orders only; refunded orders
// are excluded. Days are India time. Sample data is left out unless asked for.
import type { RowDataPacket } from "mysql2/promise";

import type { DashboardStats } from "@/lib/admin-types";
import { getDb } from "./db";

const IST = "'+00:00', '+05:30'";

export async function getDashboardStats(includeSample: boolean): Promise<DashboardStats> {
  const db = await getDb();
  const realOrder = includeSample ? "1 = 1" : "o.is_sample = 0";
  const realProduct = includeSample ? "1 = 1" : "p.is_sample = 0";
  const q = async (sql: string, params: unknown[] = []) =>
    (await db.query<RowDataPacket[]>(sql, params))[0];

  const [prod] = await q(
    `SELECT COUNT(*) AS total, SUM(p.status = 'active') AS active, SUM(p.status = 'draft') AS draft
     FROM products p WHERE ${realProduct}`,
  );
  const [ord] = await q(
    `SELECT SUM(o.payment_status = 'paid') AS paid,
            SUM(o.payment_status = 'pending' AND o.created_at > UTC_TIMESTAMP() - INTERVAL 3 DAY) AS pending,
            SUM(o.payment_status = 'refunded') AS refunded,
            SUM(o.payment_status = 'paid' AND o.fulfilment_status IN ('new', 'processing')) AS to_fulfil
     FROM orders o WHERE ${realOrder}`,
  );
  const [rev] = await q(
    `SELECT
       COALESCE(SUM(IF(o.paid_at > UTC_TIMESTAMP() - INTERVAL 30 DAY, o.total_paise, 0)), 0) AS last30,
       COALESCE(SUM(IF(o.paid_at <= UTC_TIMESTAMP() - INTERVAL 30 DAY AND o.paid_at > UTC_TIMESTAMP() - INTERVAL 60 DAY, o.total_paise, 0)), 0) AS prev30,
       COALESCE(SUM(o.total_paise), 0) AS all_time,
       COUNT(*) AS n
     FROM orders o WHERE o.payment_status = 'paid' AND ${realOrder}`,
  );
  const dailyRows = await q(
    `SELECT DATE(CONVERT_TZ(o.paid_at, ${IST})) AS d, SUM(o.total_paise) AS paise, COUNT(*) AS n
     FROM orders o
     WHERE o.payment_status = 'paid' AND o.paid_at > UTC_TIMESTAMP() - INTERVAL 31 DAY AND ${realOrder}
     GROUP BY d`,
  );
  const byDay = new Map(dailyRows.map((r) => [String(r["d"]).slice(0, 10), r]));
  const daily: DashboardStats["daily"] = [];
  const todayIst = new Date(Date.now() + 5.5 * 3_600_000);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayIst.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    const r = byDay.get(d);
    daily.push({ date: d, paise: Number(r?.["paise"] ?? 0), orders: Number(r?.["n"] ?? 0) });
  }

  const best = await q(
    `SELECT i.name, SUM(i.qty) AS qty, SUM(i.qty * i.unit_paise) AS revenue
     FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE o.payment_status = 'paid' AND o.paid_at > UTC_TIMESTAMP() - INTERVAL 90 DAY AND ${realOrder}
     GROUP BY i.name ORDER BY qty DESC, revenue DESC LIMIT 5`,
  );
  const low = await q(
    `SELECT p.id, p.name, NULL AS opt, p.stock FROM products p
     WHERE p.status = 'active' AND p.stock IS NOT NULL AND p.stock <= 5 AND ${realProduct}
       AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id)
     UNION ALL
     SELECT p.id, p.name, v.name AS opt, v.stock FROM product_variants v JOIN products p ON p.id = v.product_id
     WHERE p.status = 'active' AND v.stock IS NOT NULL AND v.stock <= 5 AND ${realProduct}
     ORDER BY stock ASC LIMIT 15`,
  );
  const [enr] = await q(
    `SELECT COUNT(*) AS total, SUM(e.created_at > UTC_TIMESTAMP() - INTERVAL 30 DAY) AS last30
     FROM enrolments e JOIN products p ON p.id = e.product_id WHERE e.status = 'active' AND ${realProduct}`,
  );
  const topCourses = await q(
    `SELECT p.name, COUNT(*) AS n FROM enrolments e JOIN products p ON p.id = e.product_id
     WHERE e.status = 'active' AND ${realProduct} GROUP BY p.id, p.name ORDER BY n DESC LIMIT 3`,
  );
  const [book] = await q(
    `SELECT SUM(booking_status = 'Pending') AS pending,
            SUM(booking_status = 'Confirmed' AND appointment_date >= DATE(CONVERT_TZ(UTC_TIMESTAMP(), ${IST}))) AS upcoming
     FROM appointments`,
  );
  const recent = await q(
    `SELECT o.order_number, o.name, o.total_paise, o.payment_status, o.fulfilment_status, o.created_at
     FROM orders o WHERE o.payment_status IN ('paid', 'refunded') AND ${realOrder}
     ORDER BY o.created_at DESC LIMIT 6`,
  );

  const n = (v: unknown) => Number(v ?? 0);
  return {
    includeSample,
    products: { total: n(prod?.["total"]), active: n(prod?.["active"]), draft: n(prod?.["draft"]) },
    orders: {
      paid: n(ord?.["paid"]),
      pending: n(ord?.["pending"]),
      refunded: n(ord?.["refunded"]),
      toFulfil: n(ord?.["to_fulfil"]),
    },
    revenue: {
      last30Paise: n(rev?.["last30"]),
      prev30Paise: n(rev?.["prev30"]),
      allTimePaise: n(rev?.["all_time"]),
      avgOrderPaise: n(rev?.["n"]) ? Math.round(n(rev?.["all_time"]) / n(rev?.["n"])) : 0,
    },
    daily,
    bestSellers: best.map((r) => ({
      name: String(r["name"]),
      qty: n(r["qty"]),
      revenuePaise: n(r["revenue"]),
    })),
    lowStock: low.map((r) => ({
      productId: n(r["id"]),
      name: String(r["name"]),
      option: r["opt"] ? String(r["opt"]) : null,
      stock: n(r["stock"]),
    })),
    enrolments: {
      total: n(enr?.["total"]),
      last30: n(enr?.["last30"]),
      topCourses: topCourses.map((r) => ({ name: String(r["name"]), students: n(r["n"]) })),
    },
    bookings: { pending: n(book?.["pending"]), upcoming: n(book?.["upcoming"]) },
    recentOrders: recent.map((r) => ({
      orderNumber: String(r["order_number"]),
      name: String(r["name"]),
      totalPaise: n(r["total_paise"]),
      paymentStatus: String(r["payment_status"]),
      fulfilmentStatus: String(r["fulfilment_status"]),
      createdAt: `${String(r["created_at"]).replace(" ", "T")}Z`,
    })),
  };
}
