// Admin > Products > Coupons: create, edit, pause and delete discount codes.
import { Edit3, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { adminDeleteCoupon, adminListCoupons, adminSaveCoupon } from "@/lib/order-api";
import { type AdminCoupon, describeCoupon } from "@/lib/order-types";

const input = "w-full p-2.5 rounded border border-border bg-background text-xs";
const label = "block text-xs font-bold text-charcoal mb-1";

interface Form {
  id?: number;
  code: string;
  description: string;
  type: "percent" | "fixed";
  value: string;
  minOrder: string;
  maxDiscount: string;
  startsAt: string;
  endsAt: string;
  maxUses: string;
  active: boolean;
}

const empty: Form = {
  code: "",
  description: "",
  type: "percent",
  value: "",
  minOrder: "",
  maxDiscount: "",
  startsAt: "",
  endsAt: "",
  maxUses: "",
  active: true,
};

function toForm(c: AdminCoupon): Form {
  return {
    id: c.id,
    code: c.code,
    description: c.description,
    type: c.type,
    value: String(c.value / 100),
    minOrder: c.minOrderPaise ? String(c.minOrderPaise / 100) : "",
    maxDiscount: c.maxDiscountPaise === null ? "" : String(c.maxDiscountPaise / 100),
    startsAt: c.startsAt ?? "",
    endsAt: c.endsAt ?? "",
    maxUses: c.maxUses === null ? "" : String(c.maxUses),
    active: c.active,
  };
}

export function AdminCoupons({ fail }: { fail: (msg: string) => void }) {
  const [coupons, setCoupons] = useState<AdminCoupon[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await adminListCoupons();
      if (r.ok) setCoupons(r.coupons);
      else fail(r.error);
    } catch {
      fail("Could not reach the server.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminSaveCoupon({
        data: {
          ...(form.id ? { id: form.id } : {}),
          code: form.code,
          description: form.description,
          type: form.type,
          value: Number(form.value || 0),
          minOrderRupees: Number(form.minOrder || 0),
          maxDiscountRupees: form.maxDiscount ? Number(form.maxDiscount) : null,
          startsAt: form.startsAt || null,
          endsAt: form.endsAt || null,
          maxUses: form.maxUses ? Number(form.maxUses) : null,
          active: form.active,
        },
      });
      if (!r.ok) {
        if (/session has expired/i.test(r.error)) fail(r.error);
        else setMsg(r.error);
        return;
      }
      setForm(null);
      setMsg(`Saved ${form.code.toUpperCase()}.`);
      await load();
    } catch {
      setMsg("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: AdminCoupon) {
    if (!confirm(`Delete coupon ${c.code}? Past orders keep their discount.`)) return;
    const r = await adminDeleteCoupon({ data: { id: c.id } });
    if (!r.ok) return fail(r.error);
    await load();
  }

  return (
    <div className="p-5 rounded border border-border bg-secondary/30 space-y-4 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-charcoal">Coupons</h4>
          <p className="text-muted-foreground">
            Customers enter the code at checkout. The discount is checked again on the server before
            payment.
          </p>
        </div>
        <Button
          type="button"
          variant="hero"
          className="text-xs"
          onClick={() => setForm({ ...empty })}
        >
          <Plus className="w-4 h-4 mr-1" /> New coupon
        </Button>
      </div>

      {msg && <p className="font-semibold text-charcoal">{msg}</p>}

      {form && (
        <form
          onSubmit={save}
          className="p-4 rounded border border-border bg-background grid grid-cols-1 md:grid-cols-4 gap-3"
        >
          <div>
            <label className={label} htmlFor="cp-code">
              Code
            </label>
            <input
              id="cp-code"
              className={`${input} uppercase`}
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <div>
            <label className={label} htmlFor="cp-type">
              Type
            </label>
            <select
              id="cp-type"
              className={input}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as Form["type"] })}
            >
              <option value="percent">Percentage off</option>
              <option value="fixed">Fixed amount off (₹)</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="cp-val">
              {form.type === "percent" ? "Percent (%)" : "Amount (₹)"}
            </label>
            <input
              id="cp-val"
              className={input}
              type="number"
              min="0"
              step="0.01"
              required
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>
          <div>
            <label className={label} htmlFor="cp-min">
              Minimum order (₹)
            </label>
            <input
              id="cp-min"
              className={input}
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={form.minOrder}
              onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
            />
          </div>
          {form.type === "percent" && (
            <div>
              <label className={label} htmlFor="cp-max">
                Max discount (₹, optional)
              </label>
              <input
                id="cp-max"
                className={input}
                type="number"
                min="0"
                step="1"
                value={form.maxDiscount}
                onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
              />
            </div>
          )}
          <div>
            <label className={label} htmlFor="cp-from">
              Valid from (optional)
            </label>
            <input
              id="cp-from"
              className={input}
              type="date"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
          </div>
          <div>
            <label className={label} htmlFor="cp-to">
              Valid until (optional)
            </label>
            <input
              id="cp-to"
              className={input}
              type="date"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </div>
          <div>
            <label className={label} htmlFor="cp-uses">
              Max uses (optional)
            </label>
            <input
              id="cp-uses"
              className={input}
              type="number"
              min="1"
              step="1"
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <label className={label} htmlFor="cp-desc">
              Note (for you)
            </label>
            <input
              id="cp-desc"
              className={input}
              maxLength={200}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 font-bold text-charcoal self-end pb-2.5">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active
          </label>
          <div className="md:col-span-4 flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              className="text-xs"
              onClick={() => setForm(null)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="hero" className="text-xs" disabled={busy}>
              {busy ? "Saving…" : "Save coupon"}
            </Button>
          </div>
        </form>
      )}

      {coupons === null ? (
        <p className="text-muted-foreground">Loading coupons…</p>
      ) : coupons.length === 0 ? (
        <p className="text-muted-foreground">No coupons yet.</p>
      ) : (
        <div className="overflow-x-auto border border-border rounded bg-background">
          <table className="w-full text-left">
            <thead className="bg-secondary/70 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-2.5">Code</th>
                <th className="p-2.5">Discount</th>
                <th className="p-2.5">Valid</th>
                <th className="p-2.5">Used</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="p-2.5 font-bold text-charcoal">
                    {c.code}
                    {c.isSample && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-gold-accent/40 text-[9px]">
                        SAMPLE
                      </span>
                    )}
                  </td>
                  <td className="p-2.5">
                    {describeCoupon({
                      code: c.code,
                      type: c.type,
                      value: c.value,
                      minOrderPaise: c.minOrderPaise,
                      maxDiscountPaise: c.maxDiscountPaise,
                    })}
                  </td>
                  <td className="p-2.5 whitespace-nowrap">
                    {c.startsAt || c.endsAt
                      ? `${c.startsAt ?? "…"} → ${c.endsAt ?? "…"}`
                      : "Always"}
                  </td>
                  <td className="p-2.5">
                    {c.usedCount}
                    {c.maxUses !== null ? ` / ${c.maxUses}` : ""}
                  </td>
                  <td className="p-2.5">
                    {c.active ? (
                      <span className="text-primary font-bold">Active</span>
                    ) : (
                      <span className="text-muted-foreground">Paused</span>
                    )}
                  </td>
                  <td className="p-2.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="p-1.5 text-primary"
                      title="Edit"
                      onClick={() => setForm(toForm(c))}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 text-muted-foreground hover:text-destructive"
                      title="Delete"
                      onClick={() => void remove(c)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
