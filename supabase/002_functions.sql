-- THE COACH — funciones RPC (security definer). Únicas puertas de entrada desde la app.

create or replace function tc__err(msg text) returns void language plpgsql as $$
begin raise exception using message = msg, errcode = 'P0001'; end $$;

-- Usuario de la sesión (o error)
create or replace function tc__me(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb;
begin
  select d.data into u from tc_sessions s join tc_docs d on d.coll = 'users' and d.id = s.user_id and not d.deleted
   where s.token = p_token and s.expires_at > now();
  if u is null then perform tc__err('TC_AUTH: Tu sesión ha caducado. Vuelve a entrar.'); end if;
  if coalesce(u->>'status', 'active') <> 'active' then perform tc__err('TC_AUTH: Tu acceso está desactivado. Habla con tu profesor.'); end if;
  return u;
end $$;

create or replace function tc__new_session(p_user text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text := encode(gen_random_bytes(24), 'hex');
begin
  delete from tc_sessions where expires_at < now();
  insert into tc_sessions (token, user_id, expires_at) values (t, p_user, now() + interval '120 days');
  return t;
end $$;

create or replace function tc__clean_user(u jsonb) returns jsonb language sql immutable as $$
  select u - 'codeHash' - 'passHash' $$;

create or replace function tc__log(p_comp text, p_team text, p_kind text, p_text text, p_by text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare lid text := 'l_' || encode(gen_random_bytes(6), 'hex');
begin
  insert into tc_docs (coll, id, comp_id, team_id, data, updated_by)
  values ('log', lid, p_comp, p_team, jsonb_build_object('id', lid, 'compId', p_comp, 'teamId', p_team, 'kind', p_kind, 'text', p_text, 'at', to_jsonb(now()), 'by', p_by), p_by);
end $$;

-- Estado público: ¿existe ya el superadministrador?
create or replace function tc_status() returns jsonb
language sql security definer set search_path = public, extensions as $$
  select jsonb_build_object('ok', true, 'adminExists', exists (select 1 from tc_docs where coll = 'users' and not deleted and (data->>'superadmin')::boolean is true));
$$;

-- Alumno: solicitud de acceso con nombre y email
create or replace function tc_request_access(p_name text, p_email text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare e text := lower(trim(p_email)); n text := trim(p_name); ex jsonb; uid text; u jsonb;
begin
  if length(n) < 3 or length(n) > 80 then perform tc__err('Escribe tu nombre y apellido.'); end if;
  if e !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(e) > 120 then perform tc__err('Escribe un email válido.'); end if;
  select data into ex from tc_docs where coll = 'users' and not deleted and lower(data->>'email') = e limit 1;
  if ex is not null and ex->>'status' = 'pending' then perform tc__err('Ya hay una solicitud pendiente con este email. Espera a que tu profesor te pase el código.'); end if;
  if ex is not null then perform tc__err('Este email ya tiene cuenta. Entra con tu código.'); end if;
  if (select count(*) from tc_docs where coll = 'users' and not deleted and data->>'status' = 'pending') >= 300 then
    perform tc__err('Hay demasiadas solicitudes pendientes. Avisa a tu profesor.'); end if;
  uid := 'u_' || encode(gen_random_bytes(8), 'hex');
  u := jsonb_build_object('id', uid, 'name', n, 'email', e, 'role', 'student', 'status', 'pending', 'requestedAt', to_jsonb(now()), 'createdAt', to_jsonb(now()));
  insert into tc_docs (coll, id, data, updated_by) values ('users', uid, u, uid);
  perform tc__log(null, null, 'solicitud', n || ' (' || e || ') solicita acceso.', uid);
  return u;
end $$;

-- Primer arranque: crea el superadministrador (sólo si no existe y con el email autorizado)
create or replace function tc_admin_setup(p_name text, p_email text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare e text := lower(trim(p_email)); allowed text; uid text; u jsonb;
begin
  if (tc_status()->>'adminExists')::boolean then perform tc__err('Ya existe un superadministrador.'); end if;
  select value into allowed from tc_config where key = 'admin_email';
  if allowed is not null and lower(allowed) <> e then perform tc__err('Este email no está autorizado como superadministrador.'); end if;
  if length(trim(p_name)) < 3 then perform tc__err('Escribe tu nombre.'); end if;
  if length(coalesce(p_password, '')) < 8 then perform tc__err('La contraseña debe tener al menos 8 caracteres.'); end if;
  uid := 'u_' || encode(gen_random_bytes(8), 'hex');
  u := jsonb_build_object('id', uid, 'name', trim(p_name), 'email', e, 'role', 'teacher', 'superadmin', true, 'status', 'active', 'createdAt', to_jsonb(now()));
  insert into tc_docs (coll, id, data, updated_by) values ('users', uid, u, uid);
  insert into tc_secrets (user_id, hash) values (uid, crypt(p_password, gen_salt('bf', 10)));
  return jsonb_build_object('token', tc__new_session(uid), 'user', u);
end $$;

-- Entrar: alumno (email + código) o administrador (email + contraseña)
create or replace function tc_login(p_email text, p_secret text, p_kind text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare e text := lower(trim(p_email)); u jsonb; s tc_secrets; secret text := trim(coalesce(p_secret, ''));
begin
  select data into u from tc_docs where coll = 'users' and not deleted and lower(data->>'email') = e limit 1;
  if p_kind = 'student' then
    secret := upper(secret);
    if u is null or u->>'role' <> 'student' then perform tc__err('No hay ninguna cuenta de alumno con ese email. Solicita acceso primero.'); end if;
    if u->>'status' = 'pending' then perform tc__err('Tu solicitud está pendiente. Tu profesor te pasará el código cuando la apruebe.'); end if;
    if u->>'status' = 'revoked' then perform tc__err('Tu acceso está desactivado. Habla con tu profesor.'); end if;
  else
    if u is null or u->>'role' <> 'teacher' then perform tc__err('Email o contraseña incorrectos.'); end if;
  end if;
  select * into s from tc_secrets where user_id = u->>'id';
  if s.user_id is null then perform tc__err(case when p_kind = 'student' then 'El código no es correcto. Revisa que lo has copiado bien (formato ABCD-EFGH).' else 'Email o contraseña incorrectos.' end); end if;
  if s.locked_until is not null and s.locked_until > now() then perform tc__err('Demasiados intentos fallidos. Espera 15 minutos y vuelve a probar.'); end if;
  if crypt(secret, s.hash) <> s.hash then
    -- se devuelve el error (no se lanza) para que el contador de intentos no se deshaga
    update tc_secrets set fails = fails + 1, locked_until = case when fails + 1 >= 8 then now() + interval '15 minutes' else null end where user_id = s.user_id;
    return jsonb_build_object('error', case when p_kind = 'student' then 'El código no es correcto. Revisa que lo has copiado bien (formato ABCD-EFGH).' else 'Email o contraseña incorrectos.' end);
  end if;
  update tc_secrets set fails = 0, locked_until = null where user_id = s.user_id;
  u := u || jsonb_build_object('lastLoginAt', to_jsonb(now()));
  update tc_docs set data = u, rev = nextval('tc_rev_seq'), updated_at = now() where coll = 'users' and id = u->>'id';
  return jsonb_build_object('token', tc__new_session(u->>'id'), 'user', u);
end $$;

create or replace function tc_logout(p_token text) returns void
language sql security definer set search_path = public, extensions as $$ delete from tc_sessions where token = p_token; $$;

-- Lectura: devuelve los documentos visibles para el usuario con rev > p_since
create or replace function tc_pull(p_token text, p_since bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me jsonb := tc__me(p_token); uid text := me->>'id'; admin boolean := me->>'role' = 'teacher'; maxrev bigint; docs jsonb;
begin
  select coalesce(max(rev), 0) into maxrev from tc_docs;
  if admin then
    select coalesce(jsonb_agg(jsonb_build_object('c', coll, 'id', id, 'x', deleted, 'd', case when deleted then null when coll = 'users' then tc__clean_user(data) else data end) order by rev), '[]'::jsonb)
      into docs from tc_docs where rev > p_since;
  else
    with mt as (select id, comp_id from tc_docs where coll = 'teams' and not deleted and data->>'coachId' = uid),
         mc as (select distinct comp_id from mt)
    select coalesce(jsonb_agg(jsonb_build_object('c', d.coll, 'id', d.id, 'x', d.deleted, 'd', case
             when d.deleted then null
             when d.coll = 'users' and d.id = uid then tc__clean_user(d.data)
             when d.coll = 'users' then jsonb_build_object('id', d.id, 'name', d.data->>'name', 'role', d.data->>'role')
             else d.data end) order by d.rev), '[]'::jsonb)
      into docs from tc_docs d
     where d.rev > p_since and (
          d.deleted
       or (d.coll = 'users' and (d.id = uid or coalesce(d.data->>'status', 'active') = 'active'))
       or (d.coll = 'competitions' and d.id in (select comp_id from mc))
       or (d.coll in ('teams', 'rounds', 'matches') and d.comp_id in (select comp_id from mc))
       or (d.coll in ('submissions', 'evaluations', 'reflections', 'drafts') and d.team_id in (select id from mt))
       or (d.coll = 'log' and d.comp_id in (select comp_id from mc) and (d.team_id is null or d.team_id in (select id from mt)))
     );
  end if;
  return jsonb_build_object('rev', maxrev, 'me', tc__clean_user(me), 'docs', docs);
end $$;

-- Escritura por lotes. op = {c, id, s:{campos}, u:[campos a borrar], del:bool}  ó  {t:'secret', userId, secret}
create or replace function tc_push(p_token text, p_ops jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  me jsonb := tc__me(p_token); uid text := me->>'id'; admin boolean := me->>'role' = 'teacher';
  op jsonb; c text; did text; s jsonb; un jsonb; cur tc_docs; newdata jsonb; comp text; team text;
  rejected jsonb := '[]'::jsonb; done int := 0; k text; rd jsonb; isdel boolean;
  team_keys text[] := array['name', 'short', 'color', 'model', 'modelVersions', 'squadSeenAt', 'boards', 'customTasks'];
begin
  if jsonb_typeof(p_ops) <> 'array' then perform tc__err('Formato de cambios no válido.'); end if;
  for op in select * from jsonb_array_elements(p_ops) loop
    -- Códigos y contraseñas: sólo el administrador, se guardan cifrados
    if op->>'t' = 'secret' then
      if not admin or length(coalesce(op->>'secret', '')) < 8 then rejected := rejected || jsonb_build_array(jsonb_build_object('t', 'secret', 'why', 'forbidden')); continue; end if;
      insert into tc_secrets (user_id, hash) values (op->>'userId', crypt(upper(trim(op->>'secret')), gen_salt('bf', 8)))
        on conflict (user_id) do update set hash = excluded.hash, fails = 0, locked_until = null, updated_at = now();
      delete from tc_sessions where user_id = op->>'userId';
      done := done + 1; continue;
    end if;
    c := op->>'c'; did := op->>'id'; isdel := coalesce((op->>'del')::boolean, false);
    s := coalesce(op->'s', '{}'::jsonb); un := coalesce(op->'u', '[]'::jsonb);
    if c is null or did is null or c not in ('users', 'competitions', 'teams', 'rounds', 'matches', 'drafts', 'submissions', 'evaluations', 'reflections', 'log') then
      rejected := rejected || jsonb_build_array(jsonb_build_object('c', c, 'id', did, 'why', 'bad')); continue; end if;
    cur := null;
    select * into cur from tc_docs where coll = c and id = did and not deleted;

    if not admin then
      -- Permisos del alumno/entrenador
      if isdel then rejected := rejected || jsonb_build_array(jsonb_build_object('c', c, 'id', did, 'why', 'forbidden')); continue; end if;
      if c = 'teams' then
        if cur.id is null or cur.data->>'coachId' is distinct from uid then rejected := rejected || jsonb_build_array(jsonb_build_object('c', c, 'id', did, 'why', 'forbidden')); continue; end if;
        s := (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from jsonb_each(s) where key = any(team_keys));
        un := (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements_text(un) v where v = any(team_keys));
      elsif c in ('drafts', 'reflections', 'submissions', 'evaluations') then
        team := case when c in ('drafts', 'reflections') then split_part(did, ':', 1) when c = 'evaluations' then cur.data->>'teamId' else s->>'teamId' end;
        if team is null or not exists (select 1 from tc_docs where coll = 'teams' and id = team and not deleted and data->>'coachId' = uid) then
          rejected := rejected || jsonb_build_array(jsonb_build_object('c', c, 'id', did, 'why', 'forbidden')); continue; end if;
        if c = 'submissions' then
          -- Entregas: sólo se crean (quedan bloqueadas) y sólo con la jornada abierta
          select data into rd from tc_docs where coll = 'rounds' and not deleted and comp_id = (select t.comp_id from tc_docs t where t.coll = 'teams' and t.id = team) and (data->>'number')::int = (s->>'round')::int;
          if cur.id is not null or rd is null or rd->>'status' <> 'open' then rejected := rejected || jsonb_build_array(jsonb_build_object('c', c, 'id', did, 'why', 'locked')); continue; end if;
        elsif c = 'evaluations' then
          -- El alumno sólo actualiza la parte de "análisis" de la propuesta (su reflexión)
          if cur.id is null or not (s ? 'proposal') then rejected := rejected || jsonb_build_array(jsonb_build_object('c', c, 'id', did, 'why', 'forbidden')); continue; end if;
          s := jsonb_build_object('proposal', jsonb_set(jsonb_set(cur.data->'proposal', '{scores,analysis}',
                  to_jsonb(least(10, greatest(0, coalesce((s#>>'{proposal,scores,analysis}')::numeric, 0))))),
                  '{criteria,analysis}', coalesce(s#>'{proposal,criteria,analysis}', 'null'::jsonb)));
          un := '[]'::jsonb;
        elsif c = 'drafts' then
          select data into rd from tc_docs where coll = 'rounds' and not deleted and comp_id = (select t.comp_id from tc_docs t where t.coll = 'teams' and t.id = team) and (data->>'number')::int = nullif(split_part(did, ':', 2), '')::int;
          if rd is not null and rd->>'status' = 'played' then rejected := rejected || jsonb_build_array(jsonb_build_object('c', c, 'id', did, 'why', 'locked')); continue; end if;
        end if;
      elsif c = 'log' then
        if cur.id is not null then continue; end if;
        s := s || jsonb_build_object('by', uid);
        if s->>'compId' is not null and not exists (select 1 from tc_docs where coll = 'teams' and not deleted and comp_id = s->>'compId' and data->>'coachId' = uid) then
          rejected := rejected || jsonb_build_array(jsonb_build_object('c', c, 'id', did, 'why', 'forbidden')); continue; end if;
      else
        rejected := rejected || jsonb_build_array(jsonb_build_object('c', c, 'id', did, 'why', 'forbidden')); continue;
      end if;
    end if;

    if isdel then
      update tc_docs set deleted = true, data = '{}'::jsonb, rev = nextval('tc_rev_seq'), updated_at = now(), updated_by = uid where coll = c and id = did;
      if c = 'users' then delete from tc_sessions where user_id = did; delete from tc_secrets where user_id = did; end if;
      done := done + 1; continue;
    end if;

    if c = 'users' then s := tc__clean_user(s); end if;
    newdata := coalesce(cur.data, '{}'::jsonb);
    for k in select jsonb_array_elements_text(un) loop newdata := newdata - k; end loop;
    newdata := newdata || s;
    comp := case when c = 'competitions' then did when c = 'users' then null else newdata->>'compId' end;
    team := case when c = 'teams' then did when c in ('drafts', 'reflections') then split_part(did, ':', 1) else newdata->>'teamId' end;
    if comp is null and team is not null then select t.comp_id into comp from tc_docs t where t.coll = 'teams' and t.id = team; end if;
    insert into tc_docs (coll, id, comp_id, team_id, data, updated_by) values (c, did, comp, team, newdata, uid)
      on conflict (coll, id) do update set data = excluded.data, comp_id = excluded.comp_id, team_id = excluded.team_id, deleted = false,
        rev = nextval('tc_rev_seq'), updated_at = now(), updated_by = excluded.updated_by;
    if c = 'users' and coalesce(newdata->>'status', 'active') <> 'active' then delete from tc_sessions where user_id = did; end if;
    done := done + 1;
  end loop;
  return jsonb_build_object('done', done, 'rejected', rejected, 'rev', (select coalesce(max(rev), 0) from tc_docs));
end $$;

revoke all on function tc__err(text), tc__me(text), tc__new_session(text), tc__log(text, text, text, text, text), tc__clean_user(jsonb) from public, anon, authenticated;
revoke all on function tc_status(), tc_request_access(text, text), tc_admin_setup(text, text, text), tc_login(text, text, text), tc_logout(text), tc_pull(text, bigint), tc_push(text, jsonb) from public;
grant execute on function tc_status(), tc_request_access(text, text), tc_admin_setup(text, text, text), tc_login(text, text, text), tc_logout(text), tc_pull(text, bigint), tc_push(text, jsonb) to anon, authenticated;
