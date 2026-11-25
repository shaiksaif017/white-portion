import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Download,
  Lock,
  PlayCircle,
} from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getLearnPage, markLesson } from "@/lib/account-api";
import { brand } from "@/lib/brand";
import { formatMinutes, percent } from "@/lib/course-types";

export const Route = createFileRoute("/learn/$slug")({
  validateSearch: z.object({ lesson: z.number().int().positive().optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ lesson: search.lesson }),
  loader: async ({ params, deps }) => {
    const data = await getLearnPage({
      data: { slug: params.slug, ...(deps.lesson ? { lessonId: deps.lesson } : {}) },
    });
    if (!data.found) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.found ? loaderData.name : "Course"} | ${brand.name}` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LearnPage,
});

function LearnPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  if (!data.found) return null;
  const { curriculum, lesson, enrolled, completed, blocked } = data;
  const all = curriculum.modules.flatMap((m) => m.lessons);
  const index = lesson ? all.findIndex((l) => l.id === lesson.id) : -1;
  const prev = index > 0 ? all[index - 1] : undefined;
  const next = index >= 0 ? all[index + 1] : undefined;
  const pct = percent(completed.length, all.length);
  const canOpen = (l: (typeof all)[number]) => enrolled || l.isPreview;

  async function toggleComplete() {
    if (!lesson) return;
    setSaving(true);
    try {
      await markLesson({
        data: {
          productId: data.found ? data.productId : 0,
          lessonId: lesson.id,
          done: !lesson.completed,
        },
      });
      // Stay on this lesson (without a lesson in the address the page opens the next unfinished one).
      await router.navigate({
        to: "/learn/$slug",
        params: { slug: data.found ? data.slug : "" },
        search: { lesson: lesson.id },
        replace: true,
        resetScroll: false,
      });
      await router.invalidate();
    } finally {
      setSaving(false);
    }
  }

  const loginHref = `/account/login?redirect=${encodeURIComponent(`/learn/${data.slug}${lesson ? `?lesson=${lesson.id}` : ""}`)}`;

  return (
    <main>
      <SiteHeader isSolid />
      <section className="page-section section-wrap bg-cream !pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Link
            to={enrolled ? "/account" : "/product/$slug"}
            params={{ slug: data.slug }}
            className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" aria-hidden="true" />{" "}
            {enrolled ? "My account" : "Course details"}
          </Link>
          {enrolled && all.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              Progress: {completed.length}/{all.length} lessons ({pct}%)
            </span>
          )}
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-medium text-charcoal mb-6">
          {data.name}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
          {/* Lesson */}
          <div className="space-y-5 min-w-0">
            {blocked ? (
              <div className="page-card !p-8 text-center space-y-4">
                <Lock className="w-8 h-8 mx-auto text-primary/70" aria-hidden="true" />
                <h2 className="text-2xl font-display text-charcoal">
                  {blocked === "login" ? "Log in to continue" : "Enrol to watch this lesson"}
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {blocked === "login"
                    ? "If you've bought this course, log in with the email you used at checkout."
                    : "This lesson is for enrolled students. Lessons marked Free preview can be watched by anyone."}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {blocked === "login" && (
                    <a
                      href={loginHref}
                      className="px-5 py-3 rounded bg-primary text-primary-foreground text-xs font-bold tracking-wider hover:bg-olive-deep"
                    >
                      LOG IN
                    </a>
                  )}
                  <Link
                    to="/product/$slug"
                    params={{ slug: data.slug }}
                    className="px-5 py-3 rounded border border-primary text-primary text-xs font-bold tracking-wider hover:bg-primary hover:text-primary-foreground"
                  >
                    VIEW COURSE &amp; PRICE
                  </Link>
                </div>
              </div>
            ) : lesson ? (
              <>
                <div className="aspect-video rounded overflow-hidden bg-charcoal border border-border">
                  {lesson.video ? (
                    <iframe
                      key={lesson.id}
                      src={lesson.video.embedUrl}
                      title={lesson.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-paper/70 gap-2">
                      <PlayCircle className="w-10 h-10" aria-hidden="true" />
                      <p className="text-sm">Video coming soon</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold tracking-widest text-primary uppercase">
                    {lesson.moduleTitle}
                    {lesson.durationMinutes > 0 && ` · ${formatMinutes(lesson.durationMinutes)}`}
                  </p>
                  <h2 className="text-2xl font-display text-charcoal">{lesson.title}</h2>
                  {lesson.description && (
                    <p className="text-sm text-charcoal leading-relaxed whitespace-pre-line">
                      {lesson.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {enrolled && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void toggleComplete()}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded text-xs font-bold tracking-wider ${
                        lesson.completed
                          ? "border border-primary text-primary"
                          : "bg-primary text-primary-foreground hover:bg-olive-deep"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      {lesson.completed ? "COMPLETED · UNDO" : "MARK AS COMPLETE"}
                    </button>
                  )}
                  {lesson.hasAttachment && (
                    <a
                      href={`/api/lesson-file?l=${lesson.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline underline-offset-4"
                    >
                      <Download className="w-4 h-4" aria-hidden="true" /> Lesson materials
                    </a>
                  )}
                  {!enrolled && (
                    <Link
                      to="/product/$slug"
                      params={{ slug: data.slug }}
                      className="text-xs font-semibold text-primary underline underline-offset-4"
                    >
                      Free preview · Enrol for the full course
                    </Link>
                  )}
                </div>
                <div className="flex justify-between gap-3 pt-4 border-t border-border">
                  {prev && canOpen(prev) ? (
                    <Link
                      to="/learn/$slug"
                      params={{ slug: data.slug }}
                      search={{ lesson: prev.id }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-charcoal hover:text-primary"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> {prev.title}
                    </Link>
                  ) : (
                    <span />
                  )}
                  {next && canOpen(next) && (
                    <Link
                      to="/learn/$slug"
                      params={{ slug: data.slug }}
                      search={{ lesson: next.id }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-charcoal hover:text-primary text-right"
                    >
                      {next.title} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <div className="page-card !p-8 text-sm text-muted-foreground">
                Lessons are coming soon.
              </div>
            )}
          </div>

          {/* Curriculum */}
          <aside
            className="page-card !p-0 lg:sticky lg:top-6 max-h-[80vh] overflow-y-auto"
            aria-label="Course contents"
          >
            {curriculum.modules.map((m, mi) => (
              <div key={m.id} className={mi ? "border-t border-border" : ""}>
                <p className="px-4 pt-4 pb-2 text-[10px] font-bold tracking-widest text-primary uppercase">
                  {m.title}
                </p>
                <ul>
                  {m.lessons.map((l) => {
                    const active = lesson?.id === l.id;
                    const done = completed.includes(l.id);
                    const open = canOpen(l);
                    const content = (
                      <>
                        {done ? (
                          <CheckCircle2
                            className="w-4 h-4 text-primary shrink-0"
                            aria-label="Completed"
                          />
                        ) : open ? (
                          <Circle
                            className="w-4 h-4 text-muted-foreground shrink-0"
                            aria-hidden="true"
                          />
                        ) : (
                          <Lock
                            className="w-4 h-4 text-muted-foreground shrink-0"
                            aria-label="Locked"
                          />
                        )}
                        <span className="flex-1 min-w-0">
                          {l.title}
                          {!enrolled && l.isPreview && (
                            <span className="ml-1.5 text-[10px] font-bold text-primary">
                              FREE PREVIEW
                            </span>
                          )}
                        </span>
                        {l.durationMinutes > 0 && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatMinutes(l.durationMinutes)}
                          </span>
                        )}
                      </>
                    );
                    return (
                      <li key={l.id}>
                        {open ? (
                          <Link
                            to="/learn/$slug"
                            params={{ slug: data.slug }}
                            search={{ lesson: l.id }}
                            aria-current={active ? "page" : undefined}
                            className={`flex items-center gap-2.5 px-4 py-2.5 text-xs ${active ? "bg-primary/10 text-charcoal font-semibold" : "text-charcoal hover:bg-secondary"}`}
                          >
                            {content}
                          </Link>
                        ) : (
                          <span className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-muted-foreground">
                            {content}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </aside>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
