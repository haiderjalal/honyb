-- Lock down the public API roles. Visitors use the anon key, and signed-in customers use the authenticated role.
-- Neither should touch a table directly. Row level security is already on with no policies, which blocks every row,
-- and this also removes the table privileges that Supabase grants by default. The site reads and writes only through
-- the service-role functions, so this changes nothing the site does.
do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on all tables in schema public from %I', role_name);
      execute format('revoke all on all sequences in schema public from %I', role_name);
      execute format('alter default privileges in schema public revoke all on tables from %I', role_name);
      execute format('alter default privileges in schema public revoke all on sequences from %I', role_name);
    end if;
  end loop;
end;
$$;
