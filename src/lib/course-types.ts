// Shared course and customer-account definitions (browser + server).
import { z } from "zod";

// ---------- video links ----------
// Lessons store the link the owner pastes. YouTube (incl. unlisted) works today;
// Vimeo and Bunny Stream links work too, so the host can change without code changes.

export interface VideoEmbed {
  provider: "youtube" | "vimeo" | "bunny";
  embedUrl: string;
}

export function parseVideoUrl(raw: string): VideoEmbed | null {
  const s = raw.trim();
  if (!s) return null;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const yt = /^[A-Za-z0-9_-]{11}$/;

  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return yt.test(id) ? youtube(id) : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (v && yt.test(v)) return youtube(v);
    const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
    return m?.[1] ? youtube(m[1]) : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = url.pathname.match(/(?:^|\/)(\d{6,12})(?:\/([0-9a-f]{6,20}))?\/?$/);
    if (!m?.[1]) return null;
    const hash = m[2] ?? url.searchParams.get("h");
    return {
      provider: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${m[1]}${hash && /^[0-9a-f]{6,20}$/.test(hash) ? `?h=${hash}` : ""}`,
    };
  }
  if (host === "iframe.mediadelivery.net" || host === "player.mediadelivery.net") {
    const m = url.pathname.match(/^\/(?:embed|play)\/(\d{1,10})\/([0-9a-f-]{36})\/?$/);
    return m
      ? { provider: "bunny", embedUrl: `https://iframe.mediadelivery.net/embed/${m[1]}/${m[2]}` }
      : null;
  }
  return null;
}

function youtube(id: string): VideoEmbed {
  // youtube-nocookie avoids tracking cookies until the viewer presses play
  return {
    provider: "youtube",
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
  };
}

// ---------- course structure ----------

export interface CourseInfo {
  instructor: string;
  instructorBio: string;
  duration: string; // free text, e.g. "6 weeks"
  level: string; // e.g. "Beginner"
}

export interface CurriculumLesson {
  id: number;
  title: string;
  durationMinutes: number;
  isPreview: boolean;
  hasVideo: boolean;
  hasAttachment: boolean;
}

export interface CurriculumModule {
  id: number;
  title: string;
  lessons: CurriculumLesson[];
}

export interface Curriculum {
  info: CourseInfo;
  modules: CurriculumModule[];
  lessonCount: number;
  totalMinutes: number;
}

// One lesson as the player receives it (video link only after the access check).
export interface LessonView {
  id: number;
  moduleTitle: string;
  title: string;
  description: string;
  video: VideoEmbed | null;
  durationMinutes: number;
  hasAttachment: boolean;
  completed: boolean;
}

export interface CourseProgress {
  productId: number;
  slug: string;
  name: string;
  imageId: number | null;
  enrolledAt: string;
  lessonCount: number;
  completedCount: number;
  nextLessonId: number | null;
}

export function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export function formatMinutes(min: number): string {
  if (min <= 0) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

// ---------- admin input ----------

const t = (max: number) => z.string().trim().max(max);

export const LessonInputSchema = z.object({
  id: z.number().int().positive().optional(),
  title: t(200).pipe(z.string().min(1, "Every lesson needs a title")),
  description: t(5000),
  videoUrl: t(500).refine((v) => v === "" || parseVideoUrl(v) !== null, {
    message: "Use a YouTube, Vimeo or Bunny Stream link (https://…)",
  }),
  durationMinutes: z.number().int().min(0).max(1000),
  isPreview: z.boolean(),
  attachmentFileId: z.number().int().positive().nullable(),
});

export const ModuleInputSchema = z.object({
  id: z.number().int().positive().optional(),
  title: t(200).pipe(z.string().min(1, "Every module needs a title")),
  lessons: z.array(LessonInputSchema).max(100),
});

export const CourseContentSchema = z.object({
  productId: z.number().int().positive(),
  info: z.object({
    instructor: t(120),
    instructorBio: t(2000),
    duration: t(60),
    level: t(40),
  }),
  modules: z.array(ModuleInputSchema).max(50),
});
export type CourseContentInput = z.input<typeof CourseContentSchema>;

export interface AdminLesson {
  id: number;
  title: string;
  description: string;
  videoUrl: string;
  durationMinutes: number;
  isPreview: boolean;
  attachmentFileId: number | null;
  attachmentName: string | null;
}

export interface AdminCourseContent {
  productId: number;
  info: CourseInfo;
  modules: { id: number; title: string; lessons: AdminLesson[] }[];
}

export interface AdminEnrolment {
  id: number;
  email: string;
  productId: number;
  courseName: string;
  orderNumber: string | null;
  source: "purchase" | "manual";
  status: "active" | "revoked";
  createdAt: string;
  completedCount: number;
  lessonCount: number;
}

// ---------- customer accounts ----------

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.string().email("Enter a valid email address"));

export const LoginCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code");

export interface CustomerView {
  email: string;
  name: string;
  phone: string;
}
