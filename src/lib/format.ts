export const statusLabel = (s: string) => ({ todo: "To Do", in_progress: "In Progress", done: "Done" }[s] ?? s);
export const statusDot = (s: string) => ({ todo: "bg-status-todo", in_progress: "bg-status-progress", done: "bg-status-done" }[s] ?? "bg-muted");
export const priorityClass = (p: string) => ({ low: "text-priority-low", medium: "text-priority-medium", high: "text-priority-high" }[p] ?? "");
export const initials = (name: string | null | undefined) => {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
};
