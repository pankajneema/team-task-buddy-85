import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, UserPlus, Trash2, ArrowLeft, Calendar } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { statusLabel, statusDot, priorityClass, initials } from "@/lib/format";

type Project = { id: string; name: string; description: string | null; created_by: string };
type Member = { id: string; user_id: string; role: "admin" | "member"; project_id: string };
type Profile = { id: string; name: string; email: string | null };
type Task = {
  id: string; title: string; description: string | null;
  status: "todo" | "in_progress" | "done"; priority: "low" | "medium" | "high";
  due_date: string | null; assignee_id: string | null; created_by: string; project_id: string;
};

const STATUSES: Task["status"][] = ["todo", "in_progress", "done"];

const taskSchema = z.object({
  title: z.string().trim().min(1, "Title required").max(120),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(["low", "medium", "high"]),
  due_date: z.string().optional(),
  assignee_id: z.string().optional(),
});

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // task dialog
  const [tOpen, setTOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [tTitle, setTTitle] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tPriority, setTPriority] = useState<Task["priority"]>("medium");
  const [tDue, setTDue] = useState("");
  const [tAssignee, setTAssignee] = useState<string>("none");

  // member dialog
  const [mOpen, setMOpen] = useState(false);
  const [mEmail, setMEmail] = useState("");
  const [mRole, setMRole] = useState<"admin" | "member">("member");

  const myMembership = members.find(m => m.user_id === user?.id);
  const isAdmin = myMembership?.role === "admin";

  const load = async () => {
    if (!id) return;
    const [{ data: p }, { data: ms }, { data: ts }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).maybeSingle(),
      supabase.from("project_members").select("*").eq("project_id", id),
      supabase.from("tasks").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    ]);
    setProject(p as Project | null);
    setMembers((ms ?? []) as Member[]);
    setTasks((ts ?? []) as Task[]);
    const userIds = Array.from(new Set([...(ms ?? []).map(m => m.user_id), ...(ts ?? []).map(t => t.assignee_id).filter(Boolean) as string[]]));
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id,name,email").in("id", userIds);
      setProfiles(Object.fromEntries((profs ?? []).map(p => [p.id, p as Profile])));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const openNewTask = () => {
    setEditTask(null);
    setTTitle(""); setTDesc(""); setTPriority("medium"); setTDue(""); setTAssignee("none");
    setTOpen(true);
  };
  const openEditTask = (t: Task) => {
    setEditTask(t);
    setTTitle(t.title); setTDesc(t.description ?? "");
    setTPriority(t.priority); setTDue(t.due_date ?? ""); setTAssignee(t.assignee_id ?? "none");
    setTOpen(true);
  };

  const saveTask = async () => {
    const parsed = taskSchema.safeParse({
      title: tTitle, description: tDesc, priority: tPriority,
      due_date: tDue || undefined, assignee_id: tAssignee === "none" ? undefined : tAssignee,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!user || !id) return;

    const payload = {
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      due_date: parsed.data.due_date || null,
      assignee_id: parsed.data.assignee_id || null,
    };

    if (editTask) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", editTask.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Task updated");
    } else {
      const { error } = await supabase.from("tasks").insert({ ...payload, project_id: id, created_by: user.id, status: "todo" });
      if (error) { toast.error(error.message); return; }
      toast.success("Task created");
    }
    setTOpen(false); load();
  };

  const updateStatus = async (t: Task, status: Task["status"]) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status } : x));
  };

  const deleteTask = async (t: Task) => {
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Task deleted"); load();
  };

  const addMember = async () => {
    if (!id) return;
    const email = mEmail.trim().toLowerCase();
    if (!email) { toast.error("Email required"); return; }
    const { data: prof, error: pe } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (pe) { toast.error(pe.message); return; }
    if (!prof) { toast.error("No user with that email. Ask them to sign up first."); return; }
    const { error } = await supabase.from("project_members").insert({ project_id: id, user_id: prof.id, role: mRole });
    if (error) { toast.error(error.message); return; }
    toast.success("Member added");
    setMOpen(false); setMEmail(""); setMRole("member"); load();
  };

  const removeMember = async (m: Member) => {
    if (m.user_id === project?.created_by) { toast.error("Can't remove the project creator"); return; }
    if (!confirm("Remove this member?")) return;
    const { error } = await supabase.from("project_members").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removed"); load();
  };

  const tasksByStatus = useMemo(() => {
    const map: Record<string, Task[]> = { todo: [], in_progress: [], done: [] };
    for (const t of tasks) map[t.status].push(t);
    return map;
  }, [tasks]);

  const canEditTask = (t: Task) => isAdmin || t.created_by === user?.id || t.assignee_id === user?.id;

  if (loading) return <div className="p-12 text-muted-foreground">Loading…</div>;
  if (!project) return <div className="p-12">Project not found. <Link to="/projects" className="underline">Back</Link></div>;

  return (
    <div className="px-6 lg:px-12 py-10 max-w-7xl mx-auto animate-fade-up">
      <Link to="/projects" className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-3 h-3" /> All projects
      </Link>

      <div className="flex items-end justify-between flex-wrap gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="chip">{isAdmin ? "Admin" : "Member"}</span>
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Project</span>
          </div>
          <h1 className="display text-4xl lg:text-5xl">{project.name}</h1>
          {project.description && <p className="text-muted-foreground mt-3 leading-relaxed">{project.description}</p>}
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Dialog open={mOpen} onOpenChange={setMOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-sm"><UserPlus className="w-4 h-4" /> Add member</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="display text-2xl">Add team member</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input value={mEmail} onChange={e => setMEmail(e.target.value)} placeholder="teammate@studio.com" />
                    <p className="text-xs text-muted-foreground">They must already have an account.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Select value={mRole} onValueChange={(v: "admin" | "member") => setMRole(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={addMember} className="ink-button rounded-sm">Add</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button onClick={openNewTask} className="ink-button rounded-sm gap-2"><Plus className="w-4 h-4" /> New task</Button>
        </div>
      </div>

      <div className="rule my-8" />

      {/* Members strip */}
      <div className="mb-10">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Team — {members.length}</p>
        <div className="flex flex-wrap gap-2">
          {members.map(m => {
            const p = profiles[m.user_id];
            return (
              <div key={m.id} className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-sm">
                <div className="w-6 h-6 rounded-full bg-foreground text-primary-foreground grid place-items-center text-[10px] font-medium uppercase">
                  {initials(p?.name)}
                </div>
                <span className="text-sm">{p?.name || p?.email || "—"}</span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{m.role}</span>
                {isAdmin && m.user_id !== project.created_by && (
                  <button onClick={() => removeMember(m)} className="text-muted-foreground hover:text-destructive ml-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Board */}
      <div className="grid lg:grid-cols-3 gap-px bg-border border border-border">
        {STATUSES.map(s => (
          <div key={s} className="bg-background min-h-[300px]">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${statusDot(s)}`} />
                <h3 className="display text-sm uppercase tracking-wider">{statusLabel(s)}</h3>
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">{tasksByStatus[s].length}</span>
            </div>
            <div className="p-3 space-y-3">
              {tasksByStatus[s].map(t => {
                const overdue = t.due_date && t.status !== "done" && new Date(t.due_date) < new Date(new Date().toDateString());
                const editable = canEditTask(t);
                return (
                  <div key={t.id} className="editorial-card p-3 group">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => editable && openEditTask(t)}
                        className={`text-left text-sm font-medium leading-snug ${editable ? "hover:underline" : ""}`}
                      >
                        {t.title}
                      </button>
                      {(isAdmin) && (
                        <button onClick={() => deleteTask(t)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className={`chip ${priorityClass(t.priority)}`}>{t.priority}</span>
                      {t.due_date && (
                        <span className={`chip gap-1 ${overdue ? "text-destructive border-destructive/40" : ""}`}>
                          <Calendar className="w-2.5 h-2.5" />
                          {new Date(t.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      )}
                      {t.assignee_id && (
                        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="w-5 h-5 rounded-full bg-foreground text-primary-foreground grid place-items-center text-[9px] uppercase">
                            {initials(profiles[t.assignee_id]?.name)}
                          </span>
                          {profiles[t.assignee_id]?.name?.split(" ")[0]}
                        </span>
                      )}
                    </div>
                    {editable && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <Select value={t.status} onValueChange={(v) => updateStatus(t, v as Task["status"])}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                );
              })}
              {tasksByStatus[s].length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No tasks</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Task dialog */}
      <Dialog open={tOpen} onOpenChange={setTOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="display text-2xl">{editTask ? "Edit task" : "New task"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={tTitle} onChange={e => setTTitle(e.target.value)} placeholder="Design the cover" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={tDesc} onChange={e => setTDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={tPriority} onValueChange={(v: Task["priority"]) => setTPriority(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input type="date" value={tDue} onChange={e => setTDue(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select value={tAssignee} onValueChange={setTAssignee}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {profiles[m.user_id]?.name || profiles[m.user_id]?.email || "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={saveTask} className="ink-button rounded-sm">{editTask ? "Save" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
