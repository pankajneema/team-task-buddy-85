import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(80),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
});
const loginSchema = signupSchema.pick({ email: true, password: true });

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) { navigate("/", { replace: true }); }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse({ name, email, password });
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { name: parsed.data.name },
          },
        });
        if (error) { toast.error(error.message); return; }
        toast.success("Welcome to Inkboard");
        navigate("/", { replace: true });
      } else {
        const parsed = loginSchema.safeParse({ email, password });
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) { toast.error(error.message); return; }
        navigate("/", { replace: true });
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Editorial pane */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-foreground text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "linear-gradient(hsl(var(--primary-foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary-foreground)) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div className="relative">
          <div className="display text-2xl flex items-center gap-3">
            <span className="inline-block w-2 h-7 bg-primary-foreground" /> Inkboard
          </div>
          <p className="text-xs uppercase tracking-[0.3em] mt-2 opacity-60">Vol. 01 · Team Edition</p>
        </div>
        <div className="relative space-y-6">
          <h1 className="display text-5xl xl:text-6xl leading-[0.95]">
            Make work<br/>
            <span className="italic font-normal">legible.</span>
          </h1>
          <div className="rule bg-primary-foreground/30" />
          <p className="text-sm opacity-70 max-w-sm leading-relaxed">
            A quietly powerful task manager for small teams.
            Projects, roles, deadlines — set on paper, shipped on time.
          </p>
        </div>
        <div className="relative text-[11px] uppercase tracking-widest opacity-50">
          Est. 2026 — Stockholm
        </div>
      </div>

      {/* Form pane */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6 animate-fade-up">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{mode === "login" ? "Sign in" : "Create account"}</p>
            <h2 className="display text-3xl mt-1">
              {mode === "login" ? "Welcome back." : "Join the team."}
            </h2>
          </div>
          <div className="rule" />
          <div className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Ada Lovelace" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@studio.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>

          <Button type="submit" disabled={busy} className="w-full ink-button h-11 rounded-sm">
            {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>

          <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">
            {mode === "login" ? "No account? Sign up" : "Have an account? Sign in"}
          </button>

          <Link to="/" className="block text-[11px] uppercase tracking-widest text-muted-foreground mt-8">← Back home</Link>
        </form>
      </div>
    </div>
  );
}
