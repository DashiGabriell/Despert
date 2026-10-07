-- Isolamento entre organizações (ADR-0007). Rode depois do schema.sql, dentro de uma
-- transação desfeita no final: não grava nada.
--   begin; \i supabase/tests/rls_organizacoes.sql rollback;
-- B é a organização com mais prazos (a leitura indevida apareceria); A é qualquer outra.
do $$
declare
  a uuid;
  org_a uuid;
  org_b uuid;
  n int;
begin
  select p.organizacao_id into org_b from public.prazos p
    group by p.organizacao_id order by count(*) desc limit 1;
  select m.user_id, m.organizacao_id into a, org_a from public.membros m
    where m.organizacao_id <> org_b order by m.user_id limit 1;
  if org_b is null or a is null then
    raise exception 'São necessárias duas organizações, uma delas com prazos.';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into n from public.prazos where organizacao_id = org_b;
  if n <> 0 then raise exception 'A leu % prazo(s) da organização de B', n; end if;
  select count(*) into n from public.monitoramentos where organizacao_id = org_b;
  if n <> 0 then raise exception 'A leu monitoramentos de B'; end if;
  select count(*) into n from public.feriados_organizacao where organizacao_id = org_b;
  if n <> 0 then raise exception 'A leu feriados de B'; end if;
  select count(*) into n from public.execucoes where organizacao_id = org_b;
  if n <> 0 then raise exception 'A leu execuções de B'; end if;
  select count(*) into n from public.organizacoes where id = org_b;
  if n <> 0 then raise exception 'A leu a organização de B'; end if;
  select count(*) into n from public.membros where organizacao_id = org_b;
  if n <> 0 then raise exception 'A leu os membros de B'; end if;

  update public.prazos set observacoes = 'invadido' where organizacao_id = org_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'A alterou % prazo(s) de B', n; end if;
  delete from public.monitoramentos where organizacao_id = org_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'A removeu monitoramentos de B'; end if;

  begin
    insert into public.prazos (djen_id, organizacao_id, user_id) values ('teste-rls', org_b, a);
    raise exception 'A inseriu prazo na organização de B';
  exception when insufficient_privilege then null;
  end;

  -- Sem informar a organização, o banco usa a do autor e o RLS aceita.
  insert into public.prazos (djen_id, user_id) values ('teste-rls-proprio', a);
  select count(*) into n from public.prazos
    where djen_id = 'teste-rls-proprio' and organizacao_id = org_a and responsavel_id = a;
  if n <> 1 then raise exception 'Prazo sem organização não herdou a do autor'; end if;

  perform set_config('role', 'postgres', true);
  select count(*) into n from public.prazos where organizacao_id = org_b;
  if n = 0 then raise exception 'Teste sem efeito: B não tem prazos'; end if;
  raise notice 'RLS por organização: ok (B tem % prazos invisíveis para A)', n;
end $$;
