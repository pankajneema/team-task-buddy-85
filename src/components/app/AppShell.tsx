import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FolderKanban, LogOut } from "lucide-react";

export default function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 text-sm border-l-2 transition-colors ${
      isActive ? "border-foreground text-foreground bg-secondary/60" : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card/60">
        <div className="px-5 py-6 border-b border-border">
          <Link to="/" className="display text-xl tracking-tight flex items-center gap-2">
            <span className="inline-block w-2 h-6 bg-foreground" />
            Inkboard
          </Link>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1">Team Task Manager</p>
        </div>
        <nav className="flex-1 py-4">
          <NavLink to="/" end className={linkClass}>
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </NavLink>
          <NavLink to="/projects" className={linkClass}>
            <FolderKanban className="w-4 h-4" /> Projects
          </NavLink>
        </nav>
        <div className="border-t border-border p-4 text-xs">
          <div className="font-medium truncate">{user?.email}</div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start gap-2 px-2 text-muted-foreground"
            onClick={async () => { await signOut(); navigate("/auth"); }}
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </Button>
        </div>
      </aside>

      <header className="md:hidden fixed top-0 inset-x-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 h-14">
          <Link to="/" className="display text-lg flex items-center gap-2">
            <span className="inline-block w-1.5 h-5 bg-foreground" /> Inkboard
          </Link>
          <div className="flex items-center gap-1">
            <NavLink to="/" end className="px-2 py-1 text-xs">Dash</NavLink>
            <NavLink to="/projects" className="px-2 py-1 text-xs">Projects</NavLink>
            <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate("/auth"); }}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 md:pt-0 pt-14">
        <Outlet />
      </main>
    </div>
  );
}
