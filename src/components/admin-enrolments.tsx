// Admin > Products > Students: who can access which course, their progress, and
// manual access (e.g. for a coaching client or a bank-transfer purchase).
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  adminGrantEnrolment,
  adminListEnrolments,
  adminSetEnrolmentStatus,
} from "@/lib/account-api";
import { type AdminEnrolment, percent } from "@/lib/course-types";

const input = "p-2.5 rounded border border-border bg-background text-xs";

export function AdminEnrolments({
  courses,
  fail,
}: {
  courses: { id: number; name: string }[];
  fail: (msg: string) => void;
}) {
  const [list, setList] = useState<AdminEnrolment[] | null>(null);
  const [email, setEmail] = useState("");
  const [courseId, setCourseId] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      const r = await adminListEnrolments();
      if (r.ok) setList(r.enrolments);
      else fail(r.error);
    } catch {
      fail("Could not reach the server.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list ?? []).filter(
      (e) => !q || e.email.includes(q) || e.courseName.toLowerCase().includes(q),
    );
  }, [list, search]);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    if (courseId === "") return;
    setMsg(null);
    try {
      const r = await adminGrantEnrolment({ data: { email, productId: courseId } });
      if (!r.ok) return setMsg(r.error);
      setMsg(
        `Access given to ${email.trim().toLowerCase()}. They log in with that email to start.`,
      );
      setEmail("");
      await load();
    } catch {
      setMsg("Enter a valid email address.");
    }
  }

  async function setStatus(e: AdminEnrolment, status: "active" | "revoked") {
    if (status === "revoked" && !confirm(`Remove ${e.email}'s access to ${e.courseName}?`)) return;
    const r = await adminSetEnrolmentStatus({ data: { id: e.id, status } });
    if (!r.ok) return fail(r.error);
    await load();
  }

  return (
    <div className="p-5 rounded border border-border bg-secondary/30 space-y-4 text-xs">
      <div>
        <h4 className="text-sm font-bold text-charcoal">Course students</h4>
        <p className="text-muted-foreground">
          Buyers get access automatically when payment is confirmed; refunds remove it. You can also
          give or remove access by hand.
        </p>
      </div>
      <form onSubmit={grant} className="flex flex-wrap gap-2 items-end">
        <input
          type="email"
          required
          aria-label="Student email"
          placeholder="student@email.com"
          className={`${input} w-64`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select
          required
          aria-label="Course"
          className={`${input} w-64`}
          value={courseId}
          onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Choose a course…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="hero" className="text-xs">
          Give access
        </Button>
        <input
          type="search"
          aria-label="Search students"
          placeholder="Search email or course"
          className={`${input} w-56 ml-auto`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>
      {msg && <p className="font-semibold text-charcoal">{msg}</p>}
      {list === null ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground">No students yet.</p>
      ) : (
        <div className="overflow-x-auto border border-border rounded bg-background">
          <table className="w-full text-left">
            <thead className="bg-secondary/70 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-2.5">Student</th>
                <th className="p-2.5">Course</th>
                <th className="p-2.5">Since</th>
                <th className="p-2.5">How</th>
                <th className="p-2.5">Progress</th>
                <th className="p-2.5">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((e) => (
                <tr key={e.id}>
                  <td className="p-2.5 font-semibold text-charcoal">{e.email}</td>
                  <td className="p-2.5">{e.courseName}</td>
                  <td className="p-2.5 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="p-2.5">
                    {e.source === "purchase" ? `Order ${e.orderNumber ?? ""}` : "Given by admin"}
                  </td>
                  <td className="p-2.5 whitespace-nowrap">
                    {e.completedCount}/{e.lessonCount} ({percent(e.completedCount, e.lessonCount)}%)
                  </td>
                  <td className="p-2.5 whitespace-nowrap">
                    {e.status === "active" ? (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => void setStatus(e, "revoked")}
                      >
                        Active · remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-primary font-semibold"
                        onClick={() => void setStatus(e, "active")}
                      >
                        Removed · restore
                      </button>
                    )}
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
