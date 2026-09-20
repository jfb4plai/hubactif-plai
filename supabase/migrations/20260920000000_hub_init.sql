-- HubActif : schéma initial. Projet Supabase partagé : toutes les tables et fonctions sont préfixées hub_.

-- ============ Tables ============
create table hub_classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  class_code text not null unique check (class_code ~ '^[A-Z0-9]{4,12}$'),
  last_reset_at timestamptz,
  created_at timestamptz not null default now()
);
create index on hub_classes (teacher_id);

create table hub_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references hub_classes(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on hub_students (class_id);

create table hub_apps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  base_url text not null check (base_url ~ '^https://' or base_url ~ '^http://localhost'),
  key_hash text not null unique,
  indicator_labels text[] not null default '{}',
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table hub_domains (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users(id) on delete cascade, -- null = liste commune
  label text not null check (char_length(label) between 1 and 60),
  created_at timestamptz not null default now()
);
create unique index hub_domains_common_label on hub_domains (label) where teacher_id is null;
create unique index hub_domains_teacher_label on hub_domains (teacher_id, label) where teacher_id is not null;

create table hub_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references hub_classes(id) on delete cascade,
  app_id uuid not null references hub_apps(id),
  title text not null check (char_length(title) between 1 and 120),
  deep_link text not null,
  task_type text check (char_length(task_type) <= 40),
  domain_id uuid references hub_domains(id) on delete set null,
  due_at timestamptz,
  created_at timestamptz not null default now()
);
create index on hub_assignments (class_id);
create index on hub_assignments (teacher_id);

create table hub_targets (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references hub_assignments(id) on delete cascade,
  student_id uuid not null references hub_students(id) on delete cascade,
  status text not null default 'assigned' check (status in ('assigned', 'started', 'completed')),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index on hub_targets (student_id);

create table hub_links (
  id text primary key check (id ~ '^[a-f0-9]{16}$'),
  target_id uuid not null references hub_targets(id) on delete cascade,
  revoked boolean not null default false,
  expires_at timestamptz, -- échéance + 30 jours, null si pas d'échéance
  first_opened_at timestamptz,
  created_at timestamptz not null default now()
);
create index on hub_links (target_id);

create table hub_events (
  event_id uuid primary key,
  target_id uuid not null references hub_targets(id) on delete cascade,
  status text not null check (status in ('started', 'completed')),
  occurred_at timestamptz not null default now(),
  duration_s int,
  attempts int,
  indicators jsonb not null default '[]',
  detail_url text,
  created_at timestamptz not null default now()
);
create index on hub_events (target_id, occurred_at);

create table hub_notes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references hub_students(id) on delete cascade,
  body text not null check (char_length(body) <= 2000),
  updated_at timestamptz not null default now(),
  unique (teacher_id, student_id)
);

create table hub_rate_limits (
  key text primary key,
  count int not null,
  window_start timestamptz not null
);

-- ============ Domaines de départ ============
insert into hub_domains (teacher_id, label) values
  (null, 'Orthographe'), (null, 'Vocabulaire'), (null, 'Lecture'),
  (null, 'Grammaire'), (null, 'Mémorisation et révision');

-- ============ RLS ============
alter table hub_classes enable row level security;
alter table hub_students enable row level security;
alter table hub_apps enable row level security;
alter table hub_domains enable row level security;
alter table hub_assignments enable row level security;
alter table hub_targets enable row level security;
alter table hub_links enable row level security;
alter table hub_events enable row level security;
alter table hub_notes enable row level security;
alter table hub_rate_limits enable row level security;

create policy "classes : propriétaire" on hub_classes for all
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy "élèves : propriétaire de la classe" on hub_students for all
  using (exists (select 1 from hub_classes c where c.id = class_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from hub_classes c where c.id = class_id and c.teacher_id = auth.uid()));

create policy "assignations : lecture propriétaire" on hub_assignments for select
  using (teacher_id = auth.uid());

create policy "cibles : lecture propriétaire" on hub_targets for select
  using (exists (select 1 from hub_assignments a where a.id = assignment_id and a.teacher_id = auth.uid()));

create policy "liens : lecture propriétaire" on hub_links for select
  using (exists (select 1 from hub_targets t join hub_assignments a on a.id = t.assignment_id
                 where t.id = target_id and a.teacher_id = auth.uid()));

create policy "événements : lecture propriétaire" on hub_events for select
  using (exists (select 1 from hub_targets t join hub_assignments a on a.id = t.assignment_id
                 where t.id = target_id and a.teacher_id = auth.uid()));

create policy "notes : propriétaire" on hub_notes for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and exists (
    select 1 from hub_students s join hub_classes c on c.id = s.class_id
    where s.id = student_id and c.teacher_id = auth.uid()));

create policy "domaines : lecture" on hub_domains for select
  using (teacher_id is null or teacher_id = auth.uid());
create policy "domaines : ajout perso" on hub_domains for insert
  with check (teacher_id = auth.uid());
create policy "domaines : suppression perso" on hub_domains for delete
  using (teacher_id = auth.uid());

-- hub_apps et hub_rate_limits : RLS active, aucune policy => aucun accès client.
revoke all on hub_apps, hub_rate_limits from anon, authenticated;
revoke all on hub_classes, hub_students, hub_domains, hub_assignments, hub_targets, hub_links, hub_events, hub_notes from anon;
revoke insert, update, delete on hub_assignments, hub_targets, hub_links, hub_events from authenticated;

-- Vue publique des apps (sans key_hash ni libellés) : le client affiche les noms d'apps.
create view hub_apps_public as select id, slug, name, base_url from hub_apps where not revoked;
grant select on hub_apps_public to authenticated;

-- ============ Fonctions ============
create or replace function hub_is_service() returns boolean
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
$$;

-- Limitation de débit : true = autorisé.
create or replace function hub_rate_check(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  insert into hub_rate_limits as r (key, count, window_start) values (p_key, 1, now())
  on conflict (key) do update set
    count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning r.count into v_count;
  return v_count <= p_max;
end $$;

-- Création atomique d'une assignation : cibles + liens courts.
create or replace function hub_create_assignment(
  p_teacher uuid, p_app uuid, p_class uuid, p_title text, p_deep_link text,
  p_task_type text, p_domain uuid, p_due timestamptz, p_student_ids uuid[]
) returns table (out_assignment_id uuid, out_student_code text, out_link_id text)
language plpgsql security definer set search_path = public as $$
declare v_assignment uuid; v_n int;
begin
  if not exists (select 1 from hub_classes where id = p_class and teacher_id = p_teacher) then
    raise exception 'class_not_owned';
  end if;
  if p_domain is not null and not exists (
    select 1 from hub_domains where id = p_domain and (teacher_id is null or teacher_id = p_teacher)) then
    raise exception 'domain_not_allowed';
  end if;

  insert into hub_assignments (teacher_id, class_id, app_id, title, deep_link, task_type, domain_id, due_at)
  values (p_teacher, p_class, p_app, p_title, p_deep_link, p_task_type, p_domain, p_due)
  returning id into v_assignment;

  insert into hub_targets (assignment_id, student_id)
  select v_assignment, s.id from hub_students s
  where s.class_id = p_class and s.active and (p_student_ids is null or s.id = any(p_student_ids));
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'no_students'; end if;

  insert into hub_links (id, target_id, expires_at)
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), t.id,
         case when p_due is null then null else p_due + interval '30 days' end
  from hub_targets t where t.assignment_id = v_assignment;

  return query
    select v_assignment, s.code, l.id
    from hub_targets t
    join hub_students s on s.id = t.student_id
    join hub_links l on l.target_id = t.id
    where t.assignment_id = v_assignment
    order by s.code;
end $$;

-- Ouverture d'un lien court : vérifie, marque « commencé », renvoie de quoi fabriquer le jeton.
create or replace function hub_open_link(p_link text)
returns table (out_target uuid, out_assignment uuid, out_code text, out_app_slug text, out_deep_link text)
language plpgsql security definer set search_path = public as $$
declare v_target uuid;
begin
  select l.target_id into v_target
  from hub_links l
  join hub_targets t on t.id = l.target_id
  join hub_students s on s.id = t.student_id
  join hub_assignments a on a.id = t.assignment_id
  join hub_apps ap on ap.id = a.app_id
  where l.id = p_link and not l.revoked and (l.expires_at is null or l.expires_at > now())
    and s.active and not ap.revoked;
  if v_target is null then return; end if;

  update hub_links set first_opened_at = coalesce(first_opened_at, now()) where id = p_link;
  update hub_targets set status = 'started', updated_at = now() where id = v_target and status = 'assigned';

  return query
    select t.id, a.id, s.code, ap.slug, a.deep_link
    from hub_targets t
    join hub_assignments a on a.id = t.assignment_id
    join hub_students s on s.id = t.student_id
    join hub_apps ap on ap.id = a.app_id
    where t.id = v_target;
end $$;

-- Enregistrement idempotent d'un événement. Retourne 'recorded' | 'duplicate' | 'unknown_target'.
create or replace function hub_record_event(
  p_target uuid, p_assignment uuid, p_app_slug text, p_event_id uuid, p_status text,
  p_occurred timestamptz, p_duration int, p_attempts int, p_indicators jsonb, p_detail_url text
) returns text language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not exists (
    select 1 from hub_targets t
    join hub_assignments a on a.id = t.assignment_id
    join hub_apps ap on ap.id = a.app_id
    where t.id = p_target and a.id = p_assignment and ap.slug = p_app_slug) then
    return 'unknown_target';
  end if;

  insert into hub_events (event_id, target_id, status, occurred_at, duration_s, attempts, indicators, detail_url)
  values (p_event_id, p_target, p_status, least(coalesce(p_occurred, now()), now()),
          p_duration, p_attempts, coalesce(p_indicators, '[]'::jsonb), p_detail_url)
  on conflict (event_id) do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then return 'duplicate'; end if;

  update hub_targets set
    status = case when p_status = 'completed' then 'completed'
                  when status = 'assigned' then 'started'
                  else status end,
    updated_at = now()
  where id = p_target;
  return 'recorded';
end $$;

-- Espace élève : null si les codes ne correspondent pas, sinon la liste (éventuellement vide) des tâches.
create or replace function hub_student_tasks(p_class_code text, p_student_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_student uuid; v_tasks jsonb;
begin
  select s.id into v_student
  from hub_classes c join hub_students s on s.class_id = c.id
  where c.class_code = p_class_code and s.code = p_student_code and s.active;
  if v_student is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'title', q.title, 'app', q.app_name, 'due_at', q.due_at,
      'status', q.status, 'link_id', q.link_id, 'domain', q.domain
    ) order by q.due_at nulls last, q.created_at desc), '[]'::jsonb)
  into v_tasks
  from (
    select a.title, ap.name as app_name, a.due_at, a.created_at, t.status, l.id as link_id, d.label as domain
    from hub_targets t
    join hub_assignments a on a.id = t.assignment_id
    join hub_apps ap on ap.id = a.app_id
    join lateral (
      select id from hub_links
      where target_id = t.id and not revoked and (expires_at is null or expires_at > now())
      order by created_at desc limit 1
    ) l on true
    left join hub_domains d on d.id = a.domain_id
    where t.student_id = v_student
  ) q;
  return v_tasks;
end $$;

-- Régénération d'un lien (propriétaire) : révoque les anciens, en crée un nouveau.
create or replace function hub_regenerate_link(p_target uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_due timestamptz; v_id text;
begin
  select a.due_at into v_due
  from hub_targets t join hub_assignments a on a.id = t.assignment_id
  where t.id = p_target and a.teacher_id = auth.uid();
  if not found then raise exception 'not_owned'; end if;

  update hub_links set revoked = true where target_id = p_target;
  v_id := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into hub_links (id, target_id, expires_at)
  values (v_id, p_target, case when v_due is null then null else v_due + interval '30 days' end);
  return v_id;
end $$;

-- Remise à zéro d'une classe (propriétaire ou service) : élèves, assignations (cibles, liens,
-- événements) et notes disparaissent ; la classe et son code restent.
create or replace function hub_reset_class(p_class uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not hub_is_service() and not exists (
    select 1 from hub_classes where id = p_class and teacher_id = auth.uid()) then
    raise exception 'not_owned';
  end if;
  delete from hub_assignments where class_id = p_class;
  delete from hub_students where class_id = p_class;
  update hub_classes set last_reset_at = now() where id = p_class;
end $$;

-- Purge annuelle (service uniquement) : classes antérieures au 15 juillet non remises à zéro depuis.
create or replace function hub_purge_stale()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_cutoff timestamptz := make_timestamptz(extract(year from now())::int, 7, 15, 0, 0, 0, 'UTC');
  r record; n int := 0;
begin
  if not hub_is_service() then raise exception 'service_only'; end if;
  for r in select id from hub_classes
           where created_at < v_cutoff and coalesce(last_reset_at, '-infinity') < v_cutoff loop
    perform hub_reset_class(r.id);
    n := n + 1;
  end loop;
  delete from hub_rate_limits where window_start < now() - interval '1 day';
  return n;
end $$;

-- ============ Droits d'exécution ============
revoke execute on function
  hub_rate_check(text, int, int),
  hub_create_assignment(uuid, uuid, uuid, text, text, text, uuid, timestamptz, uuid[]),
  hub_open_link(text),
  hub_record_event(uuid, uuid, text, uuid, text, timestamptz, int, int, jsonb, text),
  hub_student_tasks(text, text),
  hub_purge_stale()
from public, anon, authenticated;
grant execute on function
  hub_rate_check(text, int, int),
  hub_create_assignment(uuid, uuid, uuid, text, text, text, uuid, timestamptz, uuid[]),
  hub_open_link(text),
  hub_record_event(uuid, uuid, text, uuid, text, timestamptz, int, int, jsonb, text),
  hub_student_tasks(text, text),
  hub_purge_stale()
to service_role;

revoke execute on function hub_reset_class(uuid), hub_regenerate_link(uuid) from public, anon;
grant execute on function hub_reset_class(uuid), hub_regenerate_link(uuid) to authenticated, service_role;
