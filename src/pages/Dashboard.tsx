import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { statusLabel, statusDot } from "@/lib/format";

type TaskRow = {
  id: string; title: string; status: string; priority: string;
  due_date: string | null; assignee_id: string | null; project_id: string;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [projectCount, setProjectCount] = useState(0);
  const [people, setPeople] = useState<Record<string, string>>({});
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { count: pc }, { data: ps }, { data: pr }] = await Promise.all([
        supabase.from("tasks").select("id,title,status,priority,due_date,assignee_id,project_id").limit(1000),
        supabase.from("projects").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("id,name"),
        supabase.from("projects").select("id,name"),
      ]);
      setTasks(t ?? []);
      setProjectCount(pc ?? 0);
      setPeople(Object.fromEntries((ps ?? []).map(p => [p.id, p.name || "Unknown"])));
      setProjects(Object.fromEntries((pr ?? []).map(p => [p.id, p.name])));
      setLoading(false);
    })();
  }, []);

  const total = tasks.length;
  const byStatus = (s: string) => tasks.filter(t => t.status === s).length;
  const overdue = tasks.filter(t => t.due_date && t.status !== "done" && new Date(t.due_date) < new Date(new Date().toDateString())).length;
  const myTasks = tasks.filter(t => t.assignee_id === user?.id);

  const byUser: Record<string, number> = {};
  for (const t of tasks) {
    const k = t.assignee_id ?? "_unassigned";
    byUser[k] = (byUser[k] ?? 0) + 1;
  }

  return (
    <div className="px-6 lg:px-12 py-10 max-w-6xl mx-auto animate-fade-up">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-2">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">The Daily</p>
          <h1 className="display text-4xl lg:text-5xl mt-1">Dashboard</h1>
        </div>
        <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
      </div>
      <div className="rule mb-10" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border mb-12">
        {[
          { label: "Projects", value: projectCount },
          { label: "Total tasks", value: total },
          { label: "In progress", value: byStatus("in_progress") },
          { label: "Overdue", value: overdue, accent: overdue > 0 },
        ].map((s) => (
          <div key={s.label} className="bg-card p-5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className={`display text-4xl mt-2 ${s.accent ? "text-destructive" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="display text-xl">Tasks by status</h2>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{total} total</p>
          </div>
          <div className="space-y-2">
            {(["todo","in_progress","done"] as const).map(s => {
              const c = byStatus(s);
              const pct = total ? (c / total) * 100 : 0;
              return (
                <div key={s} className="editorial-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${statusDot(s)}`} />
                      <span className="text-sm font-medium">{statusLabel(s)}</span>
                    </div>
                    <span className="text-sm tabular-nums text-muted-foreground">{c}</span>
                  </div>
                  <div className="h-1 bg-muted overflow-hidden">
                    <div className="h-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-6">
            <h2 className="display text-xl mb-3">Assigned to me</h2>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : myTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing on your desk. Enjoy the quiet.</p>
            ) : (
              <ul className="divide-y divide-border border border-border bg-card">
                {myTasks.slice(0, 8).map(t => (
                  <li key={t.id} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <Link to={`/projects/${t.project_id}`} className="text-sm font-medium hover:underline truncate block">{t.title}</Link>
                      <p className="text-xs text-muted-foreground truncate">{projects[t.project_id]}</p>
                    </div>
                    <span className="chip"><span className={`w-1.5 h-1.5 rounded-full ${statusDot(t.status)}`} />{statusLabel(t.status)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2 className="display text-xl mb-3">Tasks per person</h2>
          {Object.keys(byUser).length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
          ) : (
            <ul className="divide-y divide-border border border-border bg-card">
              {Object.entries(byUser).sort((a,b) => b[1]-a[1]).map(([uid, n]) => (
                <li key={uid} className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm truncate">{uid === "_unassigned" ? "Unassigned" : people[uid] ?? "—"}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
