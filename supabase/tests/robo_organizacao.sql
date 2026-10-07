-- Robô por organização (fase 4, #19). Rode depois do schema.sql, dentro de uma transação
-- desfeita no final: não grava nada.
--   begin; \i supabase/tests/robo_organizacao.sql rollback;
-- Monta um Escritório e um Solo descartáveis e confere, como o n8n (service_role) faria:
-- prazo único por publicação com o responsável certo, turnos por plano, etapas, Buscar agora
-- conferido no banco, resumo por membro conforme a preferência e a fila de convites.
do $$
declare
  adm   uuid := gen_random_uuid();
  adv   uuid := gen_random_uuid();
  adv2  uuid := gen_random_uuid();
  ass   uuid := gen_random_uuid();
  dono  uuid := gen_random_uuid();
  org   uuid;
  solo  uuid;
  hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  s     public.configuracao_sistema;
  lote  jsonb;
  r     jsonb;
  ids   jsonb;
  n     int;
  tok   text;
  conv  public.convites;
  pub   jsonb;
begin
  select * into s from public.configuracao_sistema where id = 1;
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  select x.id, 'authenticated', 'authenticated', x.email, now(), '{}', '{}'
  from (values
    (adm, 'adm@robo.despert.dev'), (adv, 'adv@robo.despert.dev'), (adv2, 'adv2@robo.despert.dev'),
    (ass, 'ass@robo.despert.dev'), (dono, 'dono@robo.despert.dev')
  ) as x (id, email);
  delete from public.organizacoes o
    where o.id in (select m.organizacao_id from public.membros m where m.user_id in (adm, adv, adv2, ass));
  select m.organizacao_id into solo from public.membros m where m.user_id = dono;
  update public.organizacoes set nome = 'robo-solo', plano = 'solo', situacao = 'ativa', pago_ate = null where id = solo;
  insert into public.organizacoes (nome, plano, situacao) values ('robo-escritorio', 'escritorio', 'ativa')
    returning id into org;
  insert into public.membros (organizacao_id, user_id, papel) values
    (org, adm, 'administrador'), (org, adv, 'advogado'), (org, adv2, 'advogado'), (org, ass, 'assistente');
  insert into public.monitoramentos (organizacao_id, user_id, tipo, oab_numero, oab_uf) values
    (org, adv, 'oab', '100', 'SP'), (org, adv2, 'oab', '200', 'RJ'), (solo, dono, 'oab', '100', 'SP');
  insert into public.monitoramentos (organizacao_id, user_id, tipo, numero_processo)
    values (org, adv2, 'processo', '1234567-89.2030.8.26.0100');

  -- Turnos: 07:00 busca as duas; 12:00 só quem tem 2 buscas automáticas (o Escritório).
  lote := public.robo_lote('agendado', '07');
  select count(*) into n from jsonb_array_elements(lote) l where l ->> 'organizacao_id' in (org::text, solo::text);
  if n <> 2 then raise exception 'Turno das 07:00 trouxe % de 2 organizações', n; end if;
  lote := public.robo_lote('agendado', '12');
  select count(*) into n from jsonb_array_elements(lote) l where l ->> 'organizacao_id' = org::text;
  if n <> 1 then raise exception 'Escritório ficou fora do turno das 12:00'; end if;
  select count(*) into n from jsonb_array_elements(lote) l where l ->> 'organizacao_id' = solo::text;
  if n <> 0 then raise exception 'Solo entrou no turno das 12:00'; end if;
  select count(*) into n from jsonb_array_elements(public.robo_lote('agendado', '07')) l,
    jsonb_array_elements(l -> 'monitoramentos') mo
    where l ->> 'organizacao_id' = org::text;
  if n <> 3 then raise exception 'Escritório veio com % de 3 monitoramentos', n; end if;

  -- Etapas: em somente leitura continua sendo buscada; depois da carência, não.
  if s.carencia_aviso_dias < s.carencia_total_dias then
    update public.organizacoes set pago_ate = hoje - s.carencia_aviso_dias - 1 where id = solo;
    if public.etapa_de(solo) <> 'leitura' then raise exception 'Solo não ficou em leitura'; end if;
    select count(*) into n from jsonb_array_elements(public.robo_lote('manual')) l where l ->> 'organizacao_id' = solo::text;
    if n <> 1 then raise exception 'Organização em somente leitura deixou de ser buscada'; end if;
  end if;
  update public.organizacoes set pago_ate = hoje - s.carencia_total_dias - 1 where id = solo;
  if public.etapa_de(solo) <> 'suspensa' then raise exception 'Solo não ficou suspensa'; end if;
  select count(*) into n from jsonb_array_elements(public.robo_lote('manual')) l where l ->> 'organizacao_id' = solo::text;
  if n <> 0 then raise exception 'Organização suspensa foi buscada'; end if;
  update public.organizacoes set pago_ate = null where id = solo;

  -- Buscar agora: só com o token da organização e um registro novo, ainda não aceito.
  select webhook_token into tok from public.configuracoes_organizacao where organizacao_id = org;
  if jsonb_array_length(public.robo_lote('site', null, tok)) <> 0 then
    raise exception 'Buscar agora sem registro foi aceito';
  end if;
  insert into public.buscas_agora (organizacao_id, user_id, criado_em) values (org, adv, now() - interval '10 minutes');
  if jsonb_array_length(public.robo_lote('site', null, tok)) <> 0 then
    raise exception 'Buscar agora com registro velho foi aceito';
  end if;
  insert into public.buscas_agora (organizacao_id, user_id) values (org, adv);
  if jsonb_array_length(public.robo_lote('site', null, 'token-errado')) <> 0 then
    raise exception 'Token desconhecido foi aceito';
  end if;
  lote := public.robo_lote('site', null, tok);
  if jsonb_array_length(lote) <> 1 or lote -> 0 ->> 'organizacao_id' <> org::text
     or lote -> 0 ->> 'autor' <> adv::text or lote -> 0 ->> 'origem' <> 'site' then
    raise exception 'Buscar agora não trouxe só a organização do token: %', lote;
  end if;
  if jsonb_array_length(public.robo_lote('site', null, tok)) <> 0 then
    raise exception 'O mesmo registro do Buscar agora liberou duas buscas';
  end if;
  begin
    perform public.robo_lote('qualquer');
    raise exception 'Origem inválida aceita';
  exception when raise_exception then
    if sqlerrm not like 'Origem inválida%' then raise; end if;
  end;

  -- Gravação: duas OABs da casa na mesma publicação = um prazo, responsável o primeiro listado.
  pub := jsonb_build_array(
    jsonb_build_object('djen_id', 'robo-1', 'processo', '0000001-00.2030.8.26.0001', 'vencimento', hoje + 2,
      'status', 'pendente', 'prazo_dias', 5,
      'advogados', jsonb_build_array(
        jsonb_build_object('numero', '999', 'uf', 'MG'),
        jsonb_build_object('numero', '000200', 'uf', 'rj'),
        jsonb_build_object('numero', '100', 'uf', 'SP'))),
    jsonb_build_object('djen_id', 'robo-2', 'numero_processo', '12345678920308260100', 'vencimento', hoje + 3,
      'status', 'conferir', 'advogados', '[]'::jsonb),
    jsonb_build_object('djen_id', 'robo-3', 'vencimento', hoje + 1, 'status', 'qualquer'),
    jsonb_build_object('djen_id', '', 'vencimento', hoje)
  );
  r := public.robo_gravar_prazos(org, pub);
  if (r ->> 'novas')::int <> 3 then raise exception 'Gravou % de 3 prazos novos', r ->> 'novas'; end if;
  ids := r -> 'ids';
  select count(*) into n from public.prazos
    where organizacao_id = org and djen_id = 'robo-1' and responsavel_id = adv2 and user_id = adv2
      and tambem_intimados = array[adv] and status = 'pendente';
  if n <> 1 then raise exception 'Publicação com duas OABs não virou um prazo de adv2 com adv também intimado'; end if;
  select count(*) into n from public.prazos where organizacao_id = org and djen_id = 'robo-2' and responsavel_id = adv2;
  if n <> 1 then raise exception 'Processo avulso não ficou com quem o cadastrou'; end if;
  select count(*) into n from public.prazos
    where organizacao_id = org and djen_id = 'robo-3' and responsavel_id = adm and status = 'conferir';
  if n <> 1 then raise exception 'Publicação sem dono não foi para o Administrador (para conferir)'; end if;
  r := public.robo_gravar_prazos(org, pub);
  if (r ->> 'novas')::int <> 0 then raise exception 'Publicação repetida gerou prazo de novo'; end if;
  r := public.robo_gravar_prazos(solo, jsonb_build_array(jsonb_build_object('djen_id', 'robo-1',
    'advogados', jsonb_build_array(jsonb_build_object('numero', '100', 'uf', 'SP')))));
  if (r ->> 'novas')::int <> 1 then raise exception 'A mesma publicação não virou prazo na outra organização'; end if;
  select count(*) into n from public.prazos where organizacao_id = solo and djen_id = 'robo-1' and responsavel_id = dono;
  if n <> 1 then raise exception 'Prazo do Solo ficou com outro responsável'; end if;

  -- Resumo por membro: Advogado vê os próprios (responsável ou também intimado); os demais, todos.
  update public.configuracoes set resumo_escopo = null, dias_alerta = 7 where user_id in (adm, adv, adv2);
  update public.configuracoes set email_destino = '' where user_id = ass;
  update public.organizacoes set pago_ate = hoje - 1 where id = org;
  r := public.robo_concluir(org, 'site', adv, 4, ids, true, 'DJEN fora do ar');
  select count(*) into n from public.execucoes
    where organizacao_id = org and user_id = adv and origem = 'site' and encontradas = 4 and novas = 3
      and status = 'falha' and detalhe = 'DJEN fora do ar';
  if n <> 1 then raise exception 'Execução da organização não foi registrada'; end if;
  if r ->> 'etapa' <> 'aviso' and s.carencia_aviso_dias > 0 then raise exception 'Etapa do aviso: %', r ->> 'etapa'; end if;
  if (r ->> 'leitura_em')::date <> hoje + s.carencia_aviso_dias then
    raise exception 'Data de somente leitura errada: %', r ->> 'leitura_em';
  end if;
  if jsonb_array_length(r -> 'destinatarios') <> 3 then
    raise exception 'Resumo para % de 3 membros com e-mail', jsonb_array_length(r -> 'destinatarios');
  end if;
  select count(*) into n from jsonb_array_elements(r -> 'destinatarios') d
    where (d ->> 'user_id')::uuid = adm and d ->> 'escopo' = 'todos'
      and jsonb_array_length(d -> 'novas') = 3 and jsonb_array_length(d -> 'alertas') = 3;
  if n <> 1 then raise exception 'Administrador não recebeu todos os prazos'; end if;
  select count(*) into n from jsonb_array_elements(r -> 'destinatarios') d
    where (d ->> 'user_id')::uuid = adv and d ->> 'escopo' = 'meus'
      and jsonb_array_length(d -> 'novas') = 1 and d -> 'novas' -> 0 ->> 'responsavel' = 'adv2@robo.despert.dev';
  if n <> 1 then raise exception 'Advogado também intimado não recebeu só o prazo dele'; end if;
  select count(*) into n from jsonb_array_elements(r -> 'destinatarios') d
    where (d ->> 'user_id')::uuid = adv2 and jsonb_array_length(d -> 'novas') = 2;
  if n <> 1 then raise exception 'Advogado responsável não recebeu os 2 prazos dele'; end if;
  update public.configuracoes set resumo_escopo = 'todos', dias_alerta = 1 where user_id = adv;
  r := public.robo_concluir(org, 'agendado', null, 0, '[]'::jsonb, false, null);
  select count(*) into n from jsonb_array_elements(r -> 'destinatarios') d
    where (d ->> 'user_id')::uuid = adv and jsonb_array_length(d -> 'novas') = 0
      and jsonb_array_length(d -> 'alertas') = 1;
  if n <> 1 then raise exception 'Preferência "todos" e janela de 1 dia não foram respeitadas'; end if;

  -- Convites: o robô manda os que faltam; reenviar põe de volta na fila.
  update public.organizacoes set pago_ate = null where id = org;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  conv := public.convidar(org, 'nova@robo.despert.dev', 'assistente');
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from jsonb_array_elements(public.robo_convites_pendentes()) c
    where c ->> 'id' = conv.id::text and c ->> 'organizacao' = 'robo-escritorio' and c ->> 'token' = conv.token
      and c ->> 'convidado_por' = 'adm@robo.despert.dev';
  if n <> 1 then raise exception 'Convite novo não entrou na fila do robô'; end if;
  perform public.robo_marcar_convite_enviado(conv.id);
  select count(*) into n from jsonb_array_elements(public.robo_convites_pendentes()) c where c ->> 'id' = conv.id::text;
  if n <> 0 then raise exception 'Convite enviado continuou na fila'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.reenviar_convite(conv.id);
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from jsonb_array_elements(public.robo_convites_pendentes()) c where c ->> 'id' = conv.id::text;
  if n <> 1 then raise exception 'Convite reenviado não voltou para a fila'; end if;

  -- As funções do robô são só da service_role.
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.robo_lote('manual');
    raise exception 'Membro chamou robo_lote';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.robo_gravar_prazos(org, '[]'::jsonb);
    raise exception 'Membro chamou robo_gravar_prazos';
  exception when insufficient_privilege then null;
  end;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  raise notice 'Robô por organização: ok';
end $$;
