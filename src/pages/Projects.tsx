import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

type Project = { id: string; name: string; description: string | null; created_at: string; created_by: string };
type MemberRow = { project_id: string; role: string; user_id: string };

const projectSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(80),
  description: z.string().trim().max(500).optional(),
});

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: ps }, { data: ms }] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("project_members").select("project_id,role,user_id"),
    ]);
    setProjects(ps ?? []);
    setMembers(ms ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    const parsed = projectSchema.safeParse({ name, description });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("projects").insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      created_by: user.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project created");
    setOpen(false); setName(""); setDescription("");
    load();
  };

  const memberCount = (pid: string) => members.filter(m => m.project_id === pid).length;
  const myRole = (pid: string) => members.find(m => m.project_id === pid && m.user_id === user?.id)?.role;

  return (
    <div className="px-6 lg:px-12 py-10 max-w-6xl mx-auto animate-fade-up">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-2">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Section II</p>
          <h1 className="display text-4xl lg:text-5xl mt-1">Projects</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="ink-button rounded-sm gap-2"><Plus className="w-4 h-4" /> New project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="display text-2xl">New project</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="pname">Name</Label>
                <Input id="pname" value={name} onChange={e => setName(e.target.value)} placeholder="Q3 Launch" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pdesc">Description</Label>
                <Textarea id="pdesc" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this about?" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={create} disabled={busy} className="ink-button rounded-sm">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rule mb-10" />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="border border-dashed border-border p-16 text-center">
          <p className="display text-2xl mb-2">No projects yet</p>
          <p className="text-sm text-muted-foreground mb-6">Create your first project to start assigning work.</p>
          <Button onClick={() => setOpen(true)} className="ink-button rounded-sm">Create project</Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border">
          {projects.map(p => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="group bg-card p-6 hover:bg-secondary/40 transition-colors flex flex-col min-h-[180px]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="chip">{myRole(p.id) ?? "member"}</span>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <h3 className="display text-2xl mt-4 leading-tight">{p.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-2 flex-1">{p.description || "No description"}</p>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>{memberCount(p.id)} member{memberCount(p.id) === 1 ? "" : "s"}</span>
                <span>{new Date(p.created_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
