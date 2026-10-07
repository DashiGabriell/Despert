-- Limites do plano reforçados no banco (ADR-0008). Rode depois do schema.sql, dentro de uma
-- transação desfeita no final: não grava nada.
--   begin; \i supabase/tests/limites_planos.sql rollback;
-- Cria uma organização Solo de teste para a conta A e tenta passar de cada limite como A.
do $$
declare
  a        uuid;
  b        uuid;
  t        uuid;
  n        int;
  id_busca bigint;
  hoje     date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select m.user_id into a from public.membros m order by m.criado_em limit 1;
  select u.id into b from auth.users u
    where u.id <> a and coalesce(u.raw_app_meta_data ->> 'app_role', '') <> 'dev' limit 1;
  if a is null or b is null then
    raise exception 'São necessárias duas contas de advogado.';
  end if;

  insert into public.organizacoes (nome, plano, situacao) values ('teste-limites', 'solo', 'ativa') returning id into t;
  insert into public.membros (organizacao_id, user_id, papel) values (t, a, 'administrador');

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- OAB: Solo aceita uma ativa; pausada não conta, mas reativar passa pelo limite.
  insert into public.monitoramentos (organizacao_id, user_id, tipo, oab_numero, oab_uf) values (t, a, 'oab', '111', 'SP');
  begin
    insert into public.monitoramentos (organizacao_id, user_id, tipo, oab_numero, oab_uf) values (t, a, 'oab', '222', 'SP');
    raise exception 'Solo aceitou a segunda OAB';
  exception when raise_exception then
    if sqlerrm not like 'Limite de OABs%' then raise; end if;
  end;
  insert into public.monitoramentos (organizacao_id, user_id, tipo, oab_numero, oab_uf, ativo)
    values (t, a, 'oab', '333', 'SP', false);
  begin
    update public.monitoramentos set ativo = true where organizacao_id = t and oab_numero = '333';
    raise exception 'Solo reativou a segunda OAB';
  exception when raise_exception then
    if sqlerrm not like 'Limite de OABs%' then raise; end if;
  end;

  -- Processos avulsos: dez, não onze.
  for i in 1..10 loop
    insert into public.monitoramentos (organizacao_id, user_id, tipo, numero_processo)
      values (t, a, 'processo', lpad(i::text, 20, '0'));
  end loop;
  begin
    insert into public.monitoramentos (organizacao_id, user_id, tipo, numero_processo)
      values (t, a, 'processo', lpad('11', 20, '0'));
    raise exception 'Solo aceitou o 11º processo';
  exception when raise_exception then
    if sqlerrm not like 'Limite de processos%' then raise; end if;
  end;

  -- Buscar agora: um por dia no Solo; só pela função, nunca direto na tabela.
  id_busca := public.registrar_busca_agora(t);
  begin
    perform public.registrar_busca_agora(t);
    raise exception 'Solo aceitou dois Buscar agora no mesmo dia';
  exception when raise_exception then
    if sqlerrm not like 'Limite diário%' then raise; end if;
  end;
  perform public.cancelar_busca_agora(id_busca);
  select count(*) into n from public.buscas_agora where organizacao_id = t;
  if n <> 0 then raise exception 'cancelar_busca_agora não desfez o registro'; end if;
  begin
    insert into public.buscas_agora (organizacao_id, user_id) values (t, a);
    raise exception 'A registrou Buscar agora direto na tabela';
  exception when insufficient_privilege then null;
  end;

  -- Funções internas do plano não ficam expostas aos usuários.
  begin
    perform public.etapa_de(t);
    raise exception 'Usuário comum chamou etapa_de';
  exception when insufficient_privilege then null;
  end;

  -- Usuários e papéis (o gatilho vale mesmo sem RLS no caminho).
  perform set_config('role', 'postgres', true);
  begin
    insert into public.membros (organizacao_id, user_id, papel) values (t, b, 'administrador');
    raise exception 'Solo aceitou o segundo usuário';
  exception when raise_exception then
    if sqlerrm not like 'Limite de usuários%' then raise; end if;
  end;
  begin
    insert into public.membros (organizacao_id, user_id, papel) values (t, b, 'advogado');
    raise exception 'Solo aceitou papel além do Administrador';
  exception when raise_exception then
    if sqlerrm not like 'O plano desta organização não tem papéis%' then raise; end if;
  end;

  -- Ajuste inválido é recusado pelo banco.
  perform set_config('request.jwt.claims', '', true);
  begin
    update public.organizacoes set limites = '{"usuarios": 0}' where id = t;
    raise exception 'Aceitou ajuste com 0 usuários';
  exception when check_violation then null;
  end;
  begin
    update public.organizacoes set limites = '{"desconhecido": 1}' where id = t;
    raise exception 'Aceitou ajuste com chave desconhecida';
  exception when check_violation then null;
  end;

  -- Carência dia 6: somente leitura para os membros; o robô continua gravando.
  update public.organizacoes set pago_ate = hoje - 6 where id = t;
  insert into public.prazos (djen_id, organizacao_id, user_id) values ('teste-limites-robo', t, a);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    insert into public.feriados (organizacao_id, user_id, data, descricao) values (t, a, '2030-01-02', 'x');
    raise exception 'Membro gravou em somente leitura';
  exception when insufficient_privilege then
    if sqlerrm not like 'Somente leitura%' then raise; end if;
  end;
  begin
    perform public.registrar_busca_agora(t);
    raise exception 'Buscar agora funcionou em somente leitura';
  exception when insufficient_privilege then
    if sqlerrm not like 'Somente leitura%' then raise; end if;
  end;

  -- Carência dia 5: aviso, tudo funciona.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  update public.organizacoes set pago_ate = hoje - 5 where id = t;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into public.feriados (organizacao_id, user_id, data, descricao) values (t, a, '2030-01-03', 'x');

  -- Plano maior com ajuste libera a segunda OAB; voltar ao Solo pausa a mais nova.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  update public.organizacoes set plano = 'escritorio', limites = '{"oabs": 3}', pago_ate = null where id = t;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update public.monitoramentos set ativo = true where organizacao_id = t and oab_numero = '333';
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  update public.organizacoes set plano = 'solo', limites = '{}' where id = t;
  select count(*) into n from public.monitoramentos where organizacao_id = t and tipo = 'oab' and ativo;
  if n <> 1 then raise exception 'Excesso não foi pausado: % OABs ativas no Solo', n; end if;
  select count(*) into n from public.monitoramentos where organizacao_id = t and oab_numero = '111' and ativo;
  if n <> 1 then raise exception 'O excesso pausou a OAB mais antiga em vez da mais nova'; end if;
  select count(*) into n from public.monitoramentos where organizacao_id = t;
  if n <> 12 then raise exception 'O excesso apagou monitoramentos (% de 12)', n; end if;

  raise notice 'Limites do plano no banco: ok';
end $$;
