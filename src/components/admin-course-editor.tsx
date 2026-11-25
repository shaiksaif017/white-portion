// Admin > Products > (course) > Course content: instructor details, modules and lessons.
import { ArrowDown, ArrowUp, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { adminGetCourseContent, adminSaveCourseContent } from "@/lib/account-api";
import { parseVideoUrl } from "@/lib/course-types";

const input = "w-full p-2.5 rounded border border-border bg-background text-xs";
const label = "block text-xs font-bold text-charcoal mb-1";

interface LessonForm {
  id?: number;
  key: string;
  title: string;
  description: string;
  videoUrl: string;
  durationMinutes: string;
  isPreview: boolean;
  attachmentFileId: number | null;
  attachmentName: string | null;
}
interface ModuleForm {
  id?: number;
  key: string;
  title: string;
  lessons: LessonForm[];
}

let seq = 0;
const newKey = () => `k${++seq}`;
const blankLesson = (): LessonForm => ({
  key: newKey(),
  title: "",
  description: "",
  videoUrl: "",
  durationMinutes: "",
  isPreview: false,
  attachmentFileId: null,
  attachmentName: null,
});

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

async function uploadMaterial(file: File) {
  const res = await fetch(`/api/admin/upload?kind=download&name=${encodeURIComponent(file.name)}`, {
    method: "POST",
    body: file,
    credentials: "same-origin",
  });
  const json = (await res.json().catch(() => ({ ok: false, error: "Upload failed." }))) as
    { ok: true; id: number; name: string } | { ok: false; error: string };
  if (!json.ok) throw new Error(json.error);
  return json;
}

export function AdminCourseEditor({
  productId,
  productName,
  onClose,
  fail,
}: {
  productId: number;
  productName: string;
  onClose: () => void;
  fail: (msg: string) => void;
}) {
  const [info, setInfo] = useState({ instructor: "", instructorBio: "", duration: "", level: "" });
  const [modules, setModules] = useState<ModuleForm[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    adminGetCourseContent({ data: { productId } })
      .then((r) => {
        if (!r.ok) return fail(r.error);
        setInfo(r.content.info);
        setModules(
          r.content.modules.map((m) => ({
            id: m.id,
            key: newKey(),
            title: m.title,
            lessons: m.lessons.map((l) => ({
              ...l,
              key: newKey(),
              durationMinutes: l.durationMinutes ? String(l.durationMinutes) : "",
            })),
          })),
        );
      })
      .catch(() => fail("Could not reach the server."));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per course
  }, [productId]);

  const setModule = (i: number, patch: Partial<ModuleForm>) =>
    setModules((ms) => ms && ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const setLesson = (mi: number, li: number, patch: Partial<LessonForm>) =>
    setModules(
      (ms) =>
        ms &&
        ms.map((m, j) =>
          j === mi
            ? { ...m, lessons: m.lessons.map((l, k) => (k === li ? { ...l, ...patch } : l)) }
            : m,
        ),
    );

  async function save() {
    if (!modules) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminSaveCourseContent({
        data: {
          productId,
          info,
          modules: modules.map((m) => ({
            ...(m.id ? { id: m.id } : {}),
            title: m.title,
            lessons: m.lessons.map((l) => ({
              ...(l.id ? { id: l.id } : {}),
              title: l.title,
              description: l.description,
              videoUrl: l.videoUrl,
              durationMinutes: Number(l.durationMinutes || 0),
              isPreview: l.isPreview,
              attachmentFileId: l.attachmentFileId,
            })),
          })),
        },
      });
      if (!r.ok) {
        if (/session has expired/i.test(r.error)) fail(r.error);
        else setMsg(r.error);
        return;
      }
      setMsg("Course saved.");
      // reload to pick up new ids (keeps student progress tied to the right lessons)
      const fresh = await adminGetCourseContent({ data: { productId } });
      if (fresh.ok)
        setModules(
          fresh.content.modules.map((m) => ({
            id: m.id,
            key: newKey(),
            title: m.title,
            lessons: m.lessons.map((l) => ({
              ...l,
              key: newKey(),
              durationMinutes: l.durationMinutes ? String(l.durationMinutes) : "",
            })),
          })),
        );
    } catch {
      setMsg("Please check the lessons: every module and lesson needs a title.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-charcoal/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-lg shadow-2xl p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-display text-charcoal">Course content</h3>
            <p className="text-xs text-muted-foreground">{productName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {modules === null ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={label} htmlFor="ce-ins">
                  Instructor
                </label>
                <input
                  id="ce-ins"
                  className={input}
                  maxLength={120}
                  value={info.instructor}
                  onChange={(e) => setInfo({ ...info, instructor: e.target.value })}
                />
              </div>
              <div>
                <label className={label} htmlFor="ce-dur">
                  Duration (e.g. 6 weeks)
                </label>
                <input
                  id="ce-dur"
                  className={input}
                  maxLength={60}
                  value={info.duration}
                  onChange={(e) => setInfo({ ...info, duration: e.target.value })}
                />
              </div>
              <div>
                <label className={label} htmlFor="ce-lvl">
                  Level
                </label>
                <input
                  id="ce-lvl"
                  className={input}
                  maxLength={40}
                  placeholder="Beginner / Intermediate / All levels"
                  value={info.level}
                  onChange={(e) => setInfo({ ...info, level: e.target.value })}
                />
              </div>
              <div className="md:col-span-3">
                <label className={label} htmlFor="ce-bio">
                  About the instructor
                </label>
                <textarea
                  id="ce-bio"
                  className={`${input} min-h-16`}
                  maxLength={2000}
                  value={info.instructorBio}
                  onChange={(e) => setInfo({ ...info, instructorBio: e.target.value })}
                />
              </div>
            </div>

            <div className="p-3 rounded border border-border bg-secondary/40 text-[11px] text-muted-foreground leading-relaxed">
              Paste each lesson's video link from YouTube (unlisted is fine), Vimeo or Bunny Stream.
              Only enrolled students see lesson pages, but anyone who gets hold of an unlisted
              YouTube link can watch it, so use a private host for videos that must stay protected.
              Tick <strong>Free preview</strong> to let visitors watch a lesson before buying.
            </div>

            <div className="space-y-4">
              {modules.map((m, mi) => (
                <div
                  key={m.key}
                  className="rounded border border-border p-4 space-y-3 bg-background"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary whitespace-nowrap">
                      Module {mi + 1}
                    </span>
                    <input
                      className={input}
                      aria-label={`Module ${mi + 1} title`}
                      placeholder="Module title"
                      value={m.title}
                      onChange={(e) => setModule(mi, { title: e.target.value })}
                    />
                    <button
                      type="button"
                      aria-label="Move module up"
                      className="p-1.5"
                      onClick={() => setModules(move(modules, mi, -1))}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move module down"
                      className="p-1.5"
                      onClick={() => setModules(move(modules, mi, 1))}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete module"
                      className="p-1.5 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (
                          m.lessons.length &&
                          !confirm(
                            `Delete module "${m.title || mi + 1}" and its ${m.lessons.length} lessons? Students' progress on them is lost when you save.`,
                          )
                        )
                          return;
                        setModules(modules.filter((_, j) => j !== mi));
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {m.lessons.map((l, li) => {
                    const videoOk = !l.videoUrl || parseVideoUrl(l.videoUrl) !== null;
                    return (
                      <div key={l.key} className="ml-4 pl-4 border-l-2 border-border space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {mi + 1}.{li + 1}
                          </span>
                          <input
                            className={input}
                            aria-label="Lesson title"
                            placeholder="Lesson title"
                            value={l.title}
                            onChange={(e) => setLesson(mi, li, { title: e.target.value })}
                          />
                          <button
                            type="button"
                            aria-label="Move lesson up"
                            className="p-1.5"
                            onClick={() => setModule(mi, { lessons: move(m.lessons, li, -1) })}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Move lesson down"
                            className="p-1.5"
                            onClick={() => setModule(mi, { lessons: move(m.lessons, li, 1) })}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete lesson"
                            className="p-1.5 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setModule(mi, { lessons: m.lessons.filter((_, k) => k !== li) })
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_110px_auto] gap-2 items-center">
                          <input
                            className={`${input} ${videoOk ? "" : "border-destructive"}`}
                            aria-label="Video link"
                            placeholder="https://youtu.be/…  or Vimeo / Bunny Stream link"
                            value={l.videoUrl}
                            onChange={(e) => setLesson(mi, li, { videoUrl: e.target.value })}
                          />
                          <input
                            className={input}
                            aria-label="Duration in minutes"
                            type="number"
                            min="0"
                            placeholder="Minutes"
                            value={l.durationMinutes}
                            onChange={(e) => setLesson(mi, li, { durationMinutes: e.target.value })}
                          />
                          <label className="flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={l.isPreview}
                              onChange={(e) => setLesson(mi, li, { isPreview: e.target.checked })}
                            />
                            Free preview
                          </label>
                        </div>
                        {!videoOk && (
                          <p className="text-[11px] text-destructive">
                            This doesn't look like a YouTube, Vimeo or Bunny Stream link.
                          </p>
                        )}
                        <textarea
                          className={`${input} min-h-12`}
                          aria-label="Lesson notes"
                          placeholder="Lesson notes (optional)"
                          value={l.description}
                          onChange={(e) => setLesson(mi, li, { description: e.target.value })}
                        />
                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="text-muted-foreground">Materials (students only):</span>
                          {l.attachmentName ? (
                            <span className="font-semibold">{l.attachmentName}</span>
                          ) : (
                            <span className="text-muted-foreground">none</span>
                          )}
                          <label className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border cursor-pointer hover:border-primary">
                            <Upload className="w-3 h-3" />{" "}
                            {l.attachmentName ? "Replace" : "Upload PDF/ZIP"}
                            <input
                              type="file"
                              accept=".pdf,.epub,.zip"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const r = await uploadMaterial(file);
                                  setLesson(mi, li, {
                                    attachmentFileId: r.id,
                                    attachmentName: r.name,
                                  });
                                } catch (err) {
                                  setMsg(err instanceof Error ? err.message : "Upload failed.");
                                }
                              }}
                            />
                          </label>
                          {l.attachmentName && (
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                setLesson(mi, li, { attachmentFileId: null, attachmentName: null })
                              }
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className="ml-4 text-xs font-semibold text-primary inline-flex items-center gap-1"
                    onClick={() => setModule(mi, { lessons: [...m.lessons, blankLesson()] })}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add lesson
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-primary inline-flex items-center gap-1"
                onClick={() =>
                  setModules([...modules, { key: newKey(), title: "", lessons: [blankLesson()] }])
                }
              >
                <Plus className="w-4 h-4" /> Add module
              </button>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-border">
          {msg && (
            <span className="text-xs font-semibold text-charcoal mr-auto" role="status">
              {msg}
            </span>
          )}
          <Button type="button" variant="outline" className="text-xs" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="hero"
            className="text-xs"
            disabled={busy || modules === null}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save course"}
          </Button>
        </div>
      </div>
    </div>
  );
}
