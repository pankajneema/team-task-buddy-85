-- Enums
CREATE TYPE public.project_role AS ENUM ('admin', 'member');
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Project members
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.project_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Security definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_admin(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_project_with(_other_user UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm1
    JOIN public.project_members pm2 ON pm1.project_id = pm2.project_id
    WHERE pm1.user_id = _user_id AND pm2.user_id = _other_user
  );
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-add creator as admin member
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

-- RLS POLICIES

-- profiles
CREATE POLICY "View own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY "View teammate profiles" ON public.profiles FOR SELECT
  USING (public.shares_project_with(id, auth.uid()));
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- projects
CREATE POLICY "Members view projects" ON public.projects FOR SELECT
  USING (public.is_project_member(id, auth.uid()));
CREATE POLICY "Authenticated create projects" ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins update projects" ON public.projects FOR UPDATE
  USING (public.is_project_admin(id, auth.uid()));
CREATE POLICY "Admins delete projects" ON public.projects FOR DELETE
  USING (public.is_project_admin(id, auth.uid()));

-- project_members
CREATE POLICY "View members of own projects" ON public.project_members FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Admins add members" ON public.project_members FOR INSERT
  WITH CHECK (public.is_project_admin(project_id, auth.uid()));
CREATE POLICY "Admins update members" ON public.project_members FOR UPDATE
  USING (public.is_project_admin(project_id, auth.uid()));
CREATE POLICY "Admins remove members" ON public.project_members FOR DELETE
  USING (public.is_project_admin(project_id, auth.uid()));

-- tasks
CREATE POLICY "Members view tasks" ON public.tasks FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members create tasks" ON public.tasks FOR INSERT
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Update own/assigned or admin" ON public.tasks FOR UPDATE
  USING (
    public.is_project_admin(project_id, auth.uid())
    OR auth.uid() = created_by
    OR auth.uid() = assignee_id
  );
CREATE POLICY "Admins delete tasks" ON public.tasks FOR DELETE
  USING (public.is_project_admin(project_id, auth.uid()));

-- Indexes
CREATE INDEX idx_pm_user ON public.project_members(user_id);
CREATE INDEX idx_pm_project ON public.project_members(project_id);
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_id);