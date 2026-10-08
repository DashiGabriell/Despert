-- Auditoria e exportação (fase 5, #20). Rode depois do schema.sql, dentro de uma transação
-- desfeita no final: não grava nada.
--   begin; \i supabase/tests/auditoria_exportacao.sql rollback;
-- Monta um Escritório e um Solo descartáveis e confere: toda alteração de membro registrada com
-- antes e depois (e nada do robô nem do Solo), tokens mascarados, o Administrador lendo as ações
-- do dev na própria organização, o histórico do prazo e a exportação por papel, plano e etapa.
do $$
declare
  adm    uuid := gen_random_uuid();
  adv    uuid := gen_random_uuid();
  ass    uuid := gen_random_uuid();
  lei    uuid := gen_random_uuid();
  dono   uuid := gen_random_uuid();
  dev    uuid := gen_random_uuid();
  org    uuid;
  solo   uuid;
  p      uuid;
  p_solo uuid;
  n      int;
  a      public.auditoria;
  conv   public.convites;
  s      public.configuracao_sistema;
  hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into s from public.configuracao_sistema where id = 1;
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  select x.id, 'authenticated', 'authenticated', x.email, now(), x.meta::jsonb, '{}'
  from (values
    (adm, 'adm@aud.despert.dev', '{}'), (adv, 'adv@aud.despert.dev', '{}'), (ass, 'ass@aud.despert.dev', '{}'),
    (lei, 'lei@aud.despert.dev', '{}'), (dono, 'dono@aud.despert.dev', '{}'),
    (dev, 'dev@aud.despert.dev', '{"app_role": "dev"}')
  ) as x (id, email, meta);
  delete from public.organizacoes o
    where o.id in (select m.organizacao_id from public.membros m where m.user_id in (adm, adv, ass, lei, dev));
  select m.organizacao_id into solo from public.membros m where m.user_id = dono;
  update public.organizacoes set nome = 'aud-solo', plano = 'solo', situacao = 'ativa', pago_ate = null where id = solo;
  insert into public.organizacoes (nome, plano, situacao) values ('aud-escritorio', 'escritorio', 'ativa')
    returning id into org;
  insert into public.membros (organizacao_id, user_id, papel) values
    (org, adm, 'administrador'), (org, adv, 'advogado'), (org, ass, 'assistente'), (org, lei, 'leitura');

  -- O robô (sem sessão) não gera auditoria.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  insert into public.prazos (djen_id, organizacao_id, user_id, responsavel_id, status, vencimento)
    values ('aud-1', org, adm, adv, 'pendente', '2031-05-10') returning id into p;
  select count(*) into n from public.auditoria where organizacao_id = org;
  if n <> 0 then raise exception 'Robô gerou % registro(s) de auditoria', n; end if;

  -- Alterações dos membros.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', ass, 'role', 'authenticated')::text, true);
  update public.prazos set status = 'cumprido', cumprido_em = now() where id = p;
  update public.prazos set responsavel_id = adm where id = p;
  update public.prazos set status = 'cumprido' where id = p;
  perform set_config('request.jwt.claims', json_build_object('sub', adv, 'role', 'authenticated')::text, true);
  insert into public.monitoramentos (organizacao_id, user_id, tipo, oab_numero, oab_uf) values (org, adv, 'oab', '321', 'SP');
  update public.configuracoes set dias_alerta = 5 where user_id = adv;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  insert into public.feriados_organizacao (organizacao_id, data, descricao) values (org, '2031-04-01', 'aud');
  update public.configuracoes_organizacao set prazo_padrao_dias = 20, webhook_token = 'tok-secreto-aud'
    where organizacao_id = org;
  perform public.alterar_papel(org, lei, 'assistente');
  perform public.alterar_papel(org, lei, 'leitura');
  conv := public.convidar(org, 'conv@aud.despert.dev', 'leitura');

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  select * into a from public.auditoria
    where organizacao_id = org and acao = 'update:prazos' and membro_id = ass and depois ? 'status';
  if not found then raise exception 'Cumprir prazo não foi auditado'; end if;
  if a.antes ->> 'status' <> 'pendente' or a.depois ->> 'status' <> 'cumprido' or a.membro_email <> 'ass@aud.despert.dev'
     or a.dev_id is not null or a.detalhe ->> 'registro' <> p::text then
    raise exception 'Registro de cumprimento incompleto: %', to_jsonb(a);
  end if;
  if a.depois ? 'teor' or a.depois ? 'responsavel_id' then raise exception 'Update guardou campos que não mudaram'; end if;
  select count(*) into n from public.auditoria where organizacao_id = org and acao = 'update:prazos';
  if n <> 2 then raise exception 'Updates de prazo auditados: % de 2 (o sem mudança não conta)', n; end if;
  select count(*) into n from public.auditoria where organizacao_id = org and acao = 'update:prazos'
    and membro_id = ass and antes ->> 'responsavel_id' = adv::text and depois ->> 'responsavel_id' = adm::text;
  if n <> 1 then raise exception 'Troca de responsável não foi auditada'; end if;
  select count(*) into n from public.auditoria where organizacao_id = org and acao = 'insert:monitoramentos' and membro_id = adv;
  if n <> 1 then raise exception 'Novo monitoramento não foi auditado'; end if;
  select count(*) into n from public.auditoria where organizacao_id = org and acao = 'update:configuracoes' and membro_id = adv;
  if n <> 1 then raise exception 'Configuração pessoal não foi auditada'; end if;
  select count(*) into n from public.auditoria where organizacao_id = org and acao = 'insert:feriados_organizacao' and membro_id = adm;
  if n <> 1 then raise exception 'Feriado não foi auditado'; end if;
  select count(*) into n from public.auditoria where organizacao_id = org and acao = 'update:configuracoes_organizacao'
    and depois ->> 'prazo_padrao_dias' = '20' and depois ->> 'webhook_token' = '•••';
  if n <> 1 then raise exception 'Configuração da organização não foi auditada com o token mascarado'; end if;
  select count(*) into n from public.auditoria where organizacao_id = org and acao = 'update:membros' and membro_id = adm;
  if n <> 2 then raise exception 'Trocas de papel auditadas: % de 2', n; end if;
  select count(*) into n from public.auditoria where organizacao_id = org and acao = 'insert:convites'
    and detalhe ->> 'email' = 'conv@aud.despert.dev' and depois ->> 'token' = '•••';
  if n <> 1 then raise exception 'Convite não foi auditado com o token mascarado'; end if;
  select count(*) into n from public.auditoria a2
    where a2.organizacao_id = org and (a2::text like '%tok-secreto-aud%' or a2::text like '%' || conv.token || '%');
  if n <> 0 then raise exception 'Token gravado em claro na auditoria'; end if;

  -- Solo não tem auditoria.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', dono, 'role', 'authenticated')::text, true);
  insert into public.prazos (djen_id, organizacao_id, user_id) values ('aud-solo', solo, dono) returning id into p_solo;
  update public.prazos set status = 'cumprido' where id = p_solo;
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.auditoria where organizacao_id = solo;
  if n <> 0 then raise exception 'Solo gerou auditoria'; end if;

  -- Ações do dev na organização (gatilho e registro direto do "entrar como").
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', dev, 'role', 'authenticated')::text, true);
  update public.prazos set vencimento = '2031-05-20' where id = p;
  insert into public.auditoria (dev_id, dev_email, acao, alvo_user_id, alvo_email)
    values (dev, 'dev@aud.despert.dev', 'atuar_como', adv, 'adv@aud.despert.dev');
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.auditoria
    where organizacao_id = org and dev_id = dev and membro_id is null and acao in ('update:prazos', 'atuar_como');
  if n <> 2 then raise exception 'Ações do dev na organização: % de 2', n; end if;

  -- Leitura: só o Administrador, só a própria organização, inclusive as ações do dev.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  select count(*) into n from public.auditoria where dev_id = dev;
  if n <> 2 then raise exception 'Administrador vê % de 2 ações do dev', n; end if;
  select count(*) into n from public.auditoria where organizacao_id is distinct from org;
  if n <> 0 then raise exception 'Administrador leu auditoria de outra organização'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', adv, 'role', 'authenticated')::text, true);
  select count(*) into n from public.auditoria;
  if n <> 0 then raise exception 'Advogado leu a auditoria'; end if;

  -- Histórico do prazo: qualquer membro; só os campos de controle.
  perform set_config('request.jwt.claims', json_build_object('sub', ass, 'role', 'authenticated')::text, true);
  select count(*) into n from public.alteracoes_do_prazo(p);
  if n <> 3 then raise exception 'Histórico do prazo com % de 3 alterações', n; end if;
  select count(*) into n from public.alteracoes_do_prazo(p) h
    where h.por_dev and h.autor_email = 'dev@aud.despert.dev' and h.depois ->> 'vencimento' = '2031-05-20';
  if n <> 1 then raise exception 'Histórico sem a mudança de vencimento do dev'; end if;
  select count(*) into n from public.alteracoes_do_prazo(p) h where h.depois ? 'cumprido_em';
  if n <> 0 then raise exception 'Histórico trouxe campos fora do controle'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', dono, 'role', 'authenticated')::text, true);
  begin
    perform public.alteracoes_do_prazo(p_solo);
    raise exception 'Solo leu histórico do prazo';
  exception when insufficient_privilege then
    if sqlerrm not like 'O plano desta organização não inclui auditoria%' then raise; end if;
  end;
  begin
    perform public.alteracoes_do_prazo(p);
    raise exception 'Histórico de prazo de outra organização';
  exception when insufficient_privilege then
    if sqlerrm not like 'Prazo não encontrado%' then raise; end if;
  end;

  -- Exportação: prazos para Administrador, Advogado e Leitura; auditoria só para o Administrador.
  perform set_config('request.jwt.claims', json_build_object('sub', adv, 'role', 'authenticated')::text, true);
  select count(*) into n from public.exportar_prazos(org);
  if n <> 1 then raise exception 'Advogado exportou % de 1 prazo', n; end if;
  begin
    perform public.exportar_auditoria(org);
    raise exception 'Advogado exportou a auditoria';
  exception when insufficient_privilege then
    if sqlerrm not like 'Seu papel não permite%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', lei, 'role', 'authenticated')::text, true);
  select count(*) into n from public.exportar_prazos(org);
  if n <> 1 then raise exception 'Leitura não exportou os prazos'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', ass, 'role', 'authenticated')::text, true);
  begin
    perform public.exportar_prazos(org);
    raise exception 'Assistente exportou prazos';
  exception when insufficient_privilege then
    if sqlerrm not like 'Seu papel não permite%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  select count(*) into n from public.exportar_auditoria(org, now() - interval '1 hour', now() + interval '1 hour');
  if n < 12 then raise exception 'Exportação da auditoria trouxe só % registros', n; end if;
  select count(*) into n from public.exportar_auditoria(org, now() + interval '1 hour');
  if n <> 0 then raise exception 'Filtro de período da exportação ignorado'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', dono, 'role', 'authenticated')::text, true);
  begin
    perform public.exportar_prazos(solo);
    raise exception 'Solo exportou prazos';
  exception when insufficient_privilege then
    if sqlerrm not like 'O plano desta organização não inclui%' then raise; end if;
  end;
  begin
    perform public.exportar_prazos(org);
    raise exception 'Exportou prazos de outra organização';
  exception when insufficient_privilege then
    if sqlerrm not like 'Seu papel não permite%' then raise; end if;
  end;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from public.auditoria where organizacao_id = org and acao = 'exportar_prazos' and membro_id in (adv, lei);
  if n <> 2 then raise exception 'Exportações de prazos registradas: % de 2', n; end if;

  -- Organização suspensa continua exportando (ADR-0008).
  update public.organizacoes set pago_ate = hoje - (s.carencia_total_dias + 5) where id = org;
  if public.etapa_de(org) <> 'suspensa' then raise exception 'Organização não ficou suspensa: %', public.etapa_de(org); end if;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', lei, 'role', 'authenticated')::text, true);
  select count(*) into n from public.exportar_prazos(org);
  if n <> 1 then raise exception 'Organização suspensa não exportou'; end if;

  -- Membro não grava auditoria direto.
  begin
    insert into public.auditoria (acao, organizacao_id) values ('forjado', org);
    raise exception 'Membro gravou auditoria direto';
  exception when insufficient_privilege then null;
  end;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  raise notice 'Auditoria e exportação: ok';
end $$;
