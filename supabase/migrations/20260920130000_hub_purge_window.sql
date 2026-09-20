-- Fenêtre de purge annuelle.
-- Problème corrigé : la version initiale de hub_purge_stale() utilisait le 15 juillet de l'année
-- CIVILE courante comme seuil, sans garde-fou. Appelée n'importe quand après cette date (cron
-- mal réglé, appel manuel) ou, pire, en janvier-juin, elle aurait supprimé les données d'élèves
-- de l'année scolaire en cours.
-- Nouveau comportement :
--   * seuil = 15 juillet (UTC) de l'ANNÉE SCOLAIRE courante (celui de l'année précédente
--     avant le 15 juillet) ;
--   * refus d'exécution (exception 'purge_window_closed') avant le 15 août : les enseignants
--     ont un mois pour remettre leurs classes à zéro ;
--   * idempotent : les classes déjà remises à zéro (last_reset_at >= seuil) ou créées après
--     le seuil ne sont jamais touchées, ce qui permet un cron quotidien en août.
create or replace function hub_purge_stale()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_cutoff timestamptz := make_timestamptz(
    extract(year from now())::int
      - (case when now() < make_timestamptz(extract(year from now())::int, 7, 15, 0, 0, 0, 'UTC') then 1 else 0 end),
    7, 15, 0, 0, 0, 'UTC');
  r record; n int := 0;
begin
  if not hub_is_service() then raise exception 'service_only'; end if;
  if now() < v_cutoff + interval '31 days' then raise exception 'purge_window_closed'; end if;
  for r in select id from hub_classes
           where created_at < v_cutoff and coalesce(last_reset_at, '-infinity') < v_cutoff loop
    perform hub_reset_class(r.id);
    n := n + 1;
  end loop;
  delete from hub_rate_limits where window_start < now() - interval '1 day';
  return n;
end $$;

revoke execute on function hub_purge_stale() from public, anon, authenticated;
grant execute on function hub_purge_stale() to service_role;
