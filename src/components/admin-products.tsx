// Admin > Products: manage products, images, e-book files and categories.
import { ArrowDown, ArrowUp, Edit3, ImagePlus, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  adminDeleteCategory,
  adminDeleteProduct,
  adminGetCatalogue,
  adminSaveCategory,
  adminSaveProduct,
} from "@/lib/shop-api";
import {
  type AdminProduct,
  type CategoryKind,
  type ProductCategory,
  type ProductStatus,
  formatINR,
  KIND_LABEL,
} from "@/lib/shop-types";

const input = "w-full p-2.5 rounded border border-border bg-background text-xs";
const label = "block text-xs font-bold text-charcoal mb-1";

// Shrinks photos in the browser before upload (max 1600px, WebP) so pages stay fast.
async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not process image"))),
      "image/webp",
      0.86,
    ),
  );
}

async function upload(kind: "image" | "download", body: Blob, name: string) {
  const res = await fetch(`/api/admin/upload?kind=${kind}&name=${encodeURIComponent(name)}`, {
    method: "POST",
    body,
    credentials: "same-origin",
  });
  const json = (await res.json().catch(() => ({ ok: false, error: "Upload failed." }))) as
    { ok: true; id: number; name: string } | { ok: false; error: string };
  if (!json.ok) throw new Error(json.error);
  return json;
}

interface FormState {
  id?: number;
  name: string;
  slug: string;
  categoryId: number | "";
  shortDescription: string;
  description: string;
  details: string;
  price: string;
  compareAt: string;
  stock: string;
  status: ProductStatus;
  isOtc: boolean;
  requiresPrescription: boolean;
  imageIds: number[];
  digitalFileId: number | null;
  digitalFileName: string | null;
}

const emptyForm: FormState = {
  name: "",
  slug: "",
  categoryId: "",
  shortDescription: "",
  description: "",
  details: "",
  price: "",
  compareAt: "",
  stock: "",
  status: "draft",
  isOtc: false,
  requiresPrescription: false,
  imageIds: [],
  digitalFileId: null,
  digitalFileName: null,
};

function toForm(p: AdminProduct): FormState {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    categoryId: p.categoryId,
    shortDescription: p.shortDescription,
    description: p.description,
    details: p.details,
    price: String(p.pricePaise / 100),
    compareAt: p.compareAtPaise === null ? "" : String(p.compareAtPaise / 100),
    stock: p.stock === null ? "" : String(p.stock),
    status: p.status,
    isOtc: p.isOtc,
    requiresPrescription: p.requiresPrescription,
    imageIds: p.imageIds,
    digitalFileId: p.digitalFileId,
    digitalFileName: p.digitalFileName,
  };
}

export function AdminProducts({ onSessionExpired }: { onSessionExpired: (msg: string) => void }) {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [filterCat, setFilterCat] = useState<number | "all">("all");
  const [filterStatus, setFilterStatus] = useState<ProductStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [showCategories, setShowCategories] = useState(false);

  function fail(msg: string) {
    if (/session has expired/i.test(msg)) onSessionExpired(msg);
    else setError(msg);
  }

  async function load() {
    try {
      const res = await adminGetCatalogue();
      if (!res.ok) return fail(res.error);
      setCategories(res.categories);
      setProducts(res.products);
    } catch {
      setError("Could not reach the server.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when the tab opens
  }, []);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const tops = categories.filter((c) => c.parentId === null);
  const kindOf = (categoryId: number | "") =>
    categoryId === "" ? null : (catById.get(categoryId)?.kind ?? null);

  const visible = products.filter((p) => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterCat !== "all") {
      const c = catById.get(p.categoryId);
      if (p.categoryId !== filterCat && c?.parentId !== filterCat) return false;
    }
    return !search || p.name.toLowerCase().includes(search.toLowerCase());
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminSaveProduct({
        data: {
          ...(form.id ? { id: form.id } : {}),
          name: form.name,
          slug: form.slug,
          categoryId: form.categoryId === "" ? 0 : form.categoryId,
          shortDescription: form.shortDescription,
          description: form.description,
          details: form.details,
          priceRupees: Number(form.price || 0),
          compareAtRupees: form.compareAt === "" ? null : Number(form.compareAt),
          stock: form.stock === "" ? null : Number(form.stock),
          status: form.status,
          isOtc: form.isOtc,
          requiresPrescription: form.requiresPrescription,
          imageIds: form.imageIds,
          digitalFileId: form.digitalFileId,
        },
      });
      if (!res.ok) return fail(res.error);
      setNotice(`Saved "${form.name}".`);
      setForm(null);
      await load();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(p: AdminProduct) {
    if (
      !confirm(
        `Delete "${p.name}" permanently? Its images and files are deleted too. This cannot be undone.`,
      )
    )
      return;
    const res = await adminDeleteProduct({ data: { id: p.id } });
    if (!res.ok) return fail(res.error);
    setNotice(`Deleted "${p.name}".`);
    await load();
  }

  async function handleImages(files: FileList | null) {
    if (!files || !form) return;
    setBusy(true);
    setError(null);
    try {
      const ids: number[] = [];
      for (const file of Array.from(files).slice(0, 8 - form.imageIds.length)) {
        const blob = await prepareImage(file);
        const res = await upload("image", blob, file.name.replace(/\.\w+$/, ".webp"));
        ids.push(res.id);
      }
      setForm((f) => (f ? { ...f, imageIds: [...f.imageIds, ...ids] } : f));
    } catch (err) {
      fail(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadFile(file: File | undefined) {
    if (!file || !form) return;
    setBusy(true);
    setError(null);
    try {
      const res = await upload("download", file, file.name);
      setForm((f) => (f ? { ...f, digitalFileId: res.id, digitalFileName: res.name } : f));
    } catch (err) {
      fail(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function moveImage(i: number, dir: -1 | 1) {
    setForm((f) => {
      if (!f) return f;
      const ids = [...f.imageIds];
      const j = i + dir;
      if (j < 0 || j >= ids.length) return f;
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
      return { ...f, imageIds: ids };
    });
  }

  const kind = form ? kindOf(form.categoryId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-display font-medium text-charcoal">Products</h3>
          <p className="text-xs text-muted-foreground">
            Only products with status <strong>Active</strong> appear on the website.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="text-xs"
            onClick={() => setShowCategories((v) => !v)}
          >
            {showCategories ? "Hide categories" : "Manage categories"}
          </Button>
          <Button
            type="button"
            variant="hero"
            className="text-xs"
            onClick={() => setForm({ ...emptyForm })}
          >
            <Plus className="w-4 h-4 mr-1" /> Add product
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded border border-destructive/40 bg-destructive/10 text-xs text-charcoal">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded border border-primary/30 bg-primary/10 text-xs text-charcoal flex justify-between">
          {notice}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {showCategories && <CategoryManager categories={categories} onChanged={load} fail={fail} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          className={`${input} !w-56`}
          placeholder="Search products"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={`${input} !w-56`}
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value === "all" ? "all" : Number(e.target.value))}
        >
          <option value="all">All categories</option>
          {tops.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          className={`${input} !w-40`}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ProductStatus | "all")}
        >
          <option value="all">Any status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* List */}
      <div className="bg-card border border-border rounded overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-secondary/70 border-b border-border text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
            <tr>
              <th className="py-3 px-4">Product</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Price</th>
              <th className="py-3 px-4">Stock</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted-foreground">
                  {products.length === 0
                    ? "No products yet. Click “Add product” to create your first one."
                    : "No products match these filters."}
                </td>
              </tr>
            ) : (
              visible.map((p) => {
                const c = catById.get(p.categoryId);
                return (
                  <tr key={p.id} className="hover:bg-secondary/20">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-secondary overflow-hidden flex-shrink-0">
                          {p.imageIds[0] && (
                            <img
                              src={`/media/${p.imageIds[0]}`}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-charcoal">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground">/product/{p.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{c?.name ?? "—"}</td>
                    <td className="py-3 px-4">{formatINR(p.pricePaise)}</td>
                    <td className="py-3 px-4">{p.stock === null ? "—" : p.stock}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : p.status === "draft"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {p.status === "active" && (
                        <a
                          href={`/product/${p.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline mr-3"
                        >
                          View
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setForm(toForm(p))}
                        className="p-1.5 text-primary"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        className="p-1.5 text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Product form */}
      {form && (
        <div className="fixed inset-0 z-50 bg-charcoal/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-card border border-border w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-lg shadow-2xl p-6 md:p-8 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-display text-charcoal">
                {form.id ? "Edit product" : "Add product"}
              </h3>
              <button
                type="button"
                onClick={() => setForm(null)}
                aria-label="Close"
                className="p-1 text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={label}>Product name *</label>
                <input
                  className={input}
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>Category *</label>
                <select
                  className={input}
                  required
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      categoryId: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                >
                  <option value="">Choose…</option>
                  {tops.map((t) => (
                    <optgroup key={t.id} label={t.name}>
                      <option value={t.id}>{t.name} (general)</option>
                      {categories
                        .filter((c) => c.parentId === t.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                {kind && (
                  <p className="text-[10px] text-muted-foreground mt-1">Type: {KIND_LABEL[kind]}</p>
                )}
              </div>
              <div>
                <label className={label}>Status</label>
                <select
                  className={input}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ProductStatus })}
                >
                  <option value="draft">Draft (hidden)</option>
                  <option value="active">Active (visible on website)</option>
                  <option value="archived">Archived (hidden)</option>
                </select>
              </div>
              <div>
                <label className={label}>Price (₹) *</label>
                <input
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>“Was” price (₹), optional</label>
                <input
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.compareAt}
                  onChange={(e) => setForm({ ...form, compareAt: e.target.value })}
                />
              </div>
              {kind !== "ebook" && kind !== "course" && (
                <div>
                  <label className={label}>Stock quantity</label>
                  <input
                    className={input}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Leave empty if you don't track stock"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  />
                </div>
              )}
              <div>
                <label className={label}>Web address (optional)</label>
                <input
                  className={input}
                  placeholder="created from the name"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </div>
            </div>

            {kind === "pharma" && (
              <div className="p-3 rounded border border-border bg-secondary/40 space-y-2 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isOtc}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        isOtc: e.target.checked,
                        requiresPrescription: e.target.checked ? false : form.requiresPrescription,
                      })
                    }
                  />
                  Over-the-counter (OTC): can be bought online
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.requiresPrescription}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        requiresPrescription: e.target.checked,
                        isOtc: e.target.checked ? false : form.isOtc,
                      })
                    }
                  />
                  Prescription required: enquiry only, never sold online
                </label>
                <p className="text-[10px] text-muted-foreground">
                  Pharma products that are not marked OTC are shown as enquiry-only.
                </p>
              </div>
            )}

            <div>
              <label className={label}>Short description (shown on product cards)</label>
              <input
                className={input}
                maxLength={300}
                value={form.shortDescription}
                onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
              />
            </div>
            <div>
              <label className={label}>Full description</label>
              <textarea
                className={`${input} min-h-[120px]`}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className={label}>Product details (one per line, e.g. “Weight: 1 kg”)</label>
              <textarea
                className={`${input} min-h-[90px] font-mono`}
                value={form.details}
                onChange={(e) => setForm({ ...form, details: e.target.value })}
              />
            </div>

            {/* Images */}
            <div>
              <label className={label}>Images (first image is the main one, up to 8)</label>
              <div className="flex flex-wrap gap-3">
                {form.imageIds.map((id, i) => (
                  <div
                    key={id}
                    className="relative w-24 h-24 rounded border border-border overflow-hidden bg-secondary"
                  >
                    <img src={`/media/${id}`} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex justify-between bg-charcoal/70 text-paper">
                      <button
                        type="button"
                        onClick={() => moveImage(i, -1)}
                        className="p-1"
                        aria-label="Move left"
                      >
                        <ArrowUp className="w-3 h-3 -rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, imageIds: form.imageIds.filter((x) => x !== id) })
                        }
                        className="p-1"
                        aria-label="Remove image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(i, 1)}
                        className="p-1"
                        aria-label="Move right"
                      >
                        <ArrowDown className="w-3 h-3 -rotate-90" />
                      </button>
                    </div>
                  </div>
                ))}
                {form.imageIds.length < 8 && (
                  <label className="w-24 h-24 rounded border-2 border-dashed border-border flex flex-col items-center justify-center text-[10px] text-muted-foreground cursor-pointer hover:border-primary">
                    <ImagePlus className="w-5 h-5 mb-1" />
                    Add images
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={(e) => void handleImages(e.target.files)}
                    />
                  </label>
                )}
              </div>
            </div>

            {kind === "ebook" && (
              <div>
                <label className={label}>
                  E-book file (PDF, EPUB or ZIP, max 25 MB): released only after verified payment
                </label>
                <div className="flex items-center gap-3 text-xs">
                  {form.digitalFileName ? (
                    <span className="font-semibold text-charcoal">{form.digitalFileName}</span>
                  ) : (
                    <span className="text-muted-foreground">No file uploaded</span>
                  )}
                  <label className="inline-flex items-center gap-1 px-3 py-2 rounded border border-border cursor-pointer hover:border-primary">
                    <Upload className="w-3.5 h-3.5" /> {form.digitalFileName ? "Replace" : "Upload"}
                    <input
                      type="file"
                      accept=".pdf,.epub,.zip"
                      className="hidden"
                      onChange={(e) => void handleDownloadFile(e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
            )}
            {kind === "course" && (
              <p className="text-[11px] text-muted-foreground">
                Course lessons and videos are added in the next update (course content manager).
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                className="text-xs"
                onClick={() => setForm(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="hero" className="text-xs" disabled={busy}>
                {busy ? "Working…" : "Save product"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function CategoryManager({
  categories,
  onChanged,
  fail,
}: {
  categories: ProductCategory[];
  onChanged: () => Promise<void>;
  fail: (msg: string) => void;
}) {
  const empty = {
    name: "",
    parentId: null as number | null,
    kind: "physical" as CategoryKind,
    description: "",
    sortOrder: 0,
  };
  const [edit, setEdit] = useState<(typeof empty & { id?: number }) | null>(null);
  const tops = categories.filter((c) => c.parentId === null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const res = await adminSaveCategory({ data: edit });
    if (!res.ok) return fail(res.error);
    setEdit(null);
    await onChanged();
  }

  async function remove(c: ProductCategory) {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    const res = await adminDeleteCategory({ data: { id: c.id } });
    if (!res.ok) return fail(res.error);
    await onChanged();
  }

  return (
    <div className="bg-card border border-border rounded p-5 space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-bold text-charcoal">Categories</h4>
        <Button
          type="button"
          variant="outline"
          className="text-xs"
          onClick={() => setEdit({ ...empty })}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add category
        </Button>
      </div>
      <ul className="space-y-1 text-xs">
        {tops.map((t) => (
          <li key={t.id}>
            <CategoryRow
              c={t}
              onEdit={() =>
                setEdit({
                  id: t.id,
                  name: t.name,
                  parentId: null,
                  kind: t.kind,
                  description: t.description,
                  sortOrder: t.sortOrder,
                })
              }
              onDelete={() => remove(t)}
            />
            <ul className="ml-6 border-l border-border pl-3">
              {categories
                .filter((c) => c.parentId === t.id)
                .map((c) => (
                  <li key={c.id}>
                    <CategoryRow
                      c={c}
                      onEdit={() =>
                        setEdit({
                          id: c.id,
                          name: c.name,
                          parentId: t.id,
                          kind: t.kind,
                          description: c.description,
                          sortOrder: c.sortOrder,
                        })
                      }
                      onDelete={() => remove(c)}
                    />
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
      {edit && (
        <form
          onSubmit={save}
          className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded bg-secondary/40"
        >
          <div>
            <label className={label}>Name</label>
            <input
              className={input}
              required
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Parent</label>
            <select
              className={input}
              value={edit.parentId ?? ""}
              onChange={(e) =>
                setEdit({
                  ...edit,
                  parentId: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            >
              <option value="">None (top-level category)</option>
              {tops
                .filter((t) => t.id !== edit.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>
          {edit.parentId === null && (
            <div>
              <label className={label}>Product type</label>
              <select
                className={input}
                value={edit.kind}
                onChange={(e) => setEdit({ ...edit, kind: e.target.value as CategoryKind })}
              >
                {(Object.keys(KIND_LABEL) as CategoryKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={label}>Order</label>
            <input
              className={input}
              type="number"
              min="0"
              value={edit.sortOrder}
              onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })}
            />
          </div>
          <div className="md:col-span-2">
            <label className={label}>Description</label>
            <input
              className={input}
              value={edit.description}
              onChange={(e) => setEdit({ ...edit, description: e.target.value })}
            />
          </div>
          <div className="md:col-span-2 flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              className="text-xs"
              onClick={() => setEdit(null)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="hero" className="text-xs">
              Save category
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function CategoryRow({
  c,
  onEdit,
  onDelete,
}: {
  c: ProductCategory;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span>
        <span className="font-semibold text-charcoal">{c.name}</span>{" "}
        <span className="text-muted-foreground">
          ({c.productCount} active{c.parentId === null ? ` · ${KIND_LABEL[c.kind]}` : ""})
        </span>
      </span>
      <span>
        <button type="button" onClick={onEdit} className="p-1 text-primary" title="Edit">
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1 text-muted-foreground hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </span>
    </div>
  );
}
