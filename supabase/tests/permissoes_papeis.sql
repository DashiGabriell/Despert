-- Papéis, equipe e convites (fase 3, #18). Rode depois do schema.sql, dentro de uma
-- transação desfeita no final: não grava nada.
--   begin; \i supabase/tests/permissoes_papeis.sql rollback;
-- Cria contas e um Escritório descartáveis e confere cada linha da tabela de permissões
-- (GLOSSARY.md) para os quatro papéis, além de convites, saída de membro e duas organizações.
-- "Ver auditoria" e "Exportar relatórios" chegam na fase 5 (#20).
do $$
declare
  adm   uuid := gen_random_uuid();
  adv   uuid := gen_random_uuid();
  ass   uuid := gen_random_uuid();
  lei   uuid := gen_random_uuid();
  adv2  uuid := gen_random_uuid();
  fora  uuid := gen_random_uuid();
  novo  uuid := gen_random_uuid();
  outro uuid := gen_random_uuid();
  org   uuid;
  org2  uuid;
  solo  uuid;
  r     record;
  pode  boolean;
  n     int;
  alvo  uuid;
  aberto uuid;
  fechado uuid;
  conv  public.convites;
  token_org text;
begin
  -- Contas (cada uma nasce com a própria organização Solo) e o Escritório com 5 de 6 vagas.
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  select x.id, 'authenticated', 'authenticated', x.email, now(), '{}', '{}'
  from (values
    (adm, 'adm@teste.despert.dev'), (adv, 'adv@teste.despert.dev'), (ass, 'ass@teste.despert.dev'),
    (lei, 'lei@teste.despert.dev'), (adv2, 'adv2@teste.despert.dev'), (fora, 'fora@teste.despert.dev')
  ) as x (id, email);
  -- Sem as organizações Solo automáticas, a do robô de cada um é a do teste (fora fica com a dele).
  delete from public.organizacoes o
    where o.id in (select m.organizacao_id from public.membros m where m.user_id in (adm, adv, ass, lei, adv2));
  insert into public.organizacoes (nome, plano, situacao, limites)
    values ('teste-equipe', 'escritorio', 'ativa', '{"usuarios": 6}') returning id into org;
  insert into public.membros (organizacao_id, user_id, papel) values
    (org, adm, 'administrador'), (org, adv, 'advogado'), (org, ass, 'assistente'),
    (org, lei, 'leitura'), (org, adv2, 'advogado');
  select count(*) into n from public.configuracoes_organizacao where organizacao_id = org;
  if n <> 1 then raise exception 'Organização nova sem configurações do robô'; end if;
  insert into public.prazos (djen_id, organizacao_id, user_id, status) values ('teste-equipe-base', org, adm, 'pendente');

  -- Cada linha da tabela de permissões, para cada papel.
  for r in
    select * from (values (adm, 'administrador'), (adv, 'advogado'), (ass, 'assistente'), (lei, 'leitura'))
      as v (uid, papel)
  loop
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
    insert into public.prazos (djen_id, organizacao_id, user_id, responsavel_id)
      values ('teste-equipe-' || r.papel, org, adm, adv) returning id into alvo;
    perform set_config('request.jwt.claims', json_build_object('sub', r.uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    -- Ver prazos e agenda: todos.
    select count(*) into n from public.prazos where organizacao_id = org;
    if n < 2 then raise exception '% não vê os prazos da organização', r.papel; end if;

    -- Criar e editar prazo: Administrador, Advogado, Assistente.
    begin
      insert into public.prazos (djen_id, organizacao_id, user_id) values ('teste-equipe-novo-' || r.papel, org, r.uid);
      pode := true;
    exception when insufficient_privilege then pode := false;
    end;
    if pode <> (r.papel <> 'leitura') then raise exception 'Criar prazo como %: %', r.papel, pode; end if;
    update public.prazos set observacoes = 'editado' where id = alvo;
    get diagnostics n = row_count;
    if (n = 1) <> (r.papel <> 'leitura') then raise exception 'Editar prazo como %: %', r.papel, n; end if;

    -- Marcar cumprido: Administrador, Advogado, Assistente.
    update public.prazos set status = 'cumprido', cumprido_em = now() where id = alvo;
    get diagnostics n = row_count;
    if (n = 1) <> (r.papel <> 'leitura') then raise exception 'Marcar cumprido como %: %', r.papel, n; end if;

    -- Trocar o responsável: Administrador, Advogado, Assistente (só para alguém da equipe).
    update public.prazos set responsavel_id = ass where id = alvo;
    get diagnostics n = row_count;
    if (n = 1) <> (r.papel <> 'leitura') then raise exception 'Trocar responsável como %: %', r.papel, n; end if;
    if r.papel <> 'leitura' then
      begin
        update public.prazos set responsavel_id = fora where id = alvo;
        raise exception 'Responsável de fora da equipe aceito';
      exception when raise_exception then
        if sqlerrm not like 'O responsável precisa%' then raise; end if;
      end;
    end if;

    -- Excluir prazo: Administrador, Advogado.
    delete from public.prazos where id = alvo;
    get diagnostics n = row_count;
    if (n = 1) <> (r.papel in ('administrador', 'advogado')) then
      raise exception 'Excluir prazo como %: %', r.papel, n;
    end if;

    -- Monitoramentos (OABs e processos): Administrador, Advogado.
    begin
      insert into public.monitoramentos (organizacao_id, user_id, tipo, numero_processo, ativo)
        values (org, r.uid, 'processo', lpad('7', 20, '0'), false);
      pode := true;
    exception when insufficient_privilege then pode := false;
    end;
    if pode <> (r.papel in ('administrador', 'advogado')) then raise exception 'Criar monitoramento como %: %', r.papel, pode; end if;
    delete from public.monitoramentos where organizacao_id = org and numero_processo = lpad('7', 20, '0');
    get diagnostics n = row_count;
    if (n = 1) <> (r.papel in ('administrador', 'advogado')) then raise exception 'Excluir monitoramento como %: %', r.papel, n; end if;

    -- Feriados e configurações da organização: Administrador.
    begin
      insert into public.feriados_organizacao (organizacao_id, data, descricao)
        values (org, '2031-02-01'::date + length(r.papel), 'teste');
      pode := true;
    exception when insufficient_privilege then pode := false;
    end;
    if pode <> (r.papel = 'administrador') then raise exception 'Criar feriado como %: %', r.papel, pode; end if;
    update public.configuracoes_organizacao set prazo_padrao_dias = 15 where organizacao_id = org;
    get diagnostics n = row_count;
    if (n = 1) <> (r.papel = 'administrador') then raise exception 'Configurar organização como %: %', r.papel, n; end if;

    -- Equipe: Administrador.
    begin
      perform public.alterar_papel(org, lei, 'leitura');
      pode := true;
    exception when insufficient_privilege then pode := false;
    end;
    if pode <> (r.papel = 'administrador') then raise exception 'Gerenciar equipe como %: %', r.papel, pode; end if;
    begin
      perform public.convidar(org, 'tentativa-' || r.papel || '@teste.despert.dev', 'leitura');
      perform public.cancelar_convite(c.id) from public.convites c
        where c.email = 'tentativa-' || r.papel || '@teste.despert.dev';
      pode := true;
    exception when insufficient_privilege then pode := false;
    end;
    if pode <> (r.papel = 'administrador') then raise exception 'Convidar como %: %', r.papel, pode; end if;
    select count(*) into n from public.convites where organizacao_id = org;
    if r.papel <> 'administrador' and n <> 0 then raise exception '% leu convites', r.papel; end if;

    -- Auditoria (fase 5): por enquanto nenhum papel da organização lê.
    select count(*) into n from public.auditoria;
    if n <> 0 then raise exception '% leu a auditoria', r.papel; end if;

    -- Buscar agora: todos menos Leitura.
    if r.papel = 'leitura' then
      begin
        perform public.registrar_busca_agora(org);
        raise exception 'Leitura disparou Buscar agora';
      exception when insufficient_privilege then
        if sqlerrm not like 'O papel Leitura%' then raise; end if;
      end;
    end if;
  end loop;

  -- Configuração pessoal: o que é da organização não muda por ela.
  perform set_config('request.jwt.claims', json_build_object('sub', adv, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update public.configuracoes set email_destino = 'outro@teste.despert.dev', dias_alerta = 3, resumo_escopo = 'todos'
    where user_id = adv;
  begin
    update public.configuracoes set dias_retroativos = 20 where user_id = adv;
    raise exception 'Membro alterou configuração da organização pela própria';
  exception when insufficient_privilege then
    if sqlerrm not like 'Essas configurações são da organização%' then raise; end if;
  end;

  -- OAB: o Advogado só a própria, uma por advogado no plano; nunca de Assistente.
  insert into public.monitoramentos (organizacao_id, user_id, tipo, oab_numero, oab_uf) values (org, adv, 'oab', '901', 'SP');
  begin
    insert into public.monitoramentos (organizacao_id, user_id, tipo, oab_numero, oab_uf) values (org, adm, 'oab', '902', 'SP');
    raise exception 'Advogado cadastrou OAB de outra pessoa';
  exception when insufficient_privilege then
    if sqlerrm not like 'Advogados só alteram%' then raise; end if;
  end;
  begin
    insert into public.monitoramentos (organizacao_id, user_id, tipo, oab_numero, oab_uf) values (org, adv, 'oab', '903', 'SP');
    raise exception 'Advogado ficou com duas OABs ativas';
  exception when raise_exception then
    if sqlerrm not like 'Cada advogado pode ter uma OAB%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  insert into public.monitoramentos (organizacao_id, user_id, tipo, oab_numero, oab_uf) values (org, adv2, 'oab', '904', 'RJ');
  insert into public.monitoramentos (organizacao_id, user_id, tipo, numero_processo) values (org, adv, 'processo', lpad('8', 20, '0'));
  begin
    insert into public.monitoramentos (organizacao_id, user_id, tipo, oab_numero, oab_uf) values (org, ass, 'oab', '905', 'SP');
    raise exception 'OAB de Assistente aceita';
  exception when raise_exception then
    if sqlerrm not like 'O monitoramento precisa pertencer%' then raise; end if;
  end;

  -- O robô recebe as configurações e os feriados da organização em cada membro.
  update public.configuracoes_organizacao set dias_retroativos = 9 where organizacao_id = org
    returning webhook_token into token_org;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from public.configuracoes
    where user_id in (adm, adv, ass, lei, adv2) and dias_retroativos = 9 and webhook_token = token_org;
  if n <> 5 then raise exception 'Configuração da organização chegou a % de 5 membros', n; end if;
  select count(*) into n from public.feriados where data = '2031-02-01'::date + length('administrador');
  if n <> 5 then raise exception 'Visão do robô entregou o feriado a % de 5 membros', n; end if;
  insert into public.prazos (djen_id, user_id) values ('teste-equipe-robo', adv);
  select count(*) into n from public.prazos where djen_id = 'teste-equipe-robo' and organizacao_id = org and responsavel_id = adv;
  if n <> 1 then raise exception 'Prazo do robô não foi para a organização da OAB'; end if;

  -- Duas organizações: adv2 também está em outra e enxerga as duas, nunca uma terceira.
  insert into public.organizacoes (nome, plano, situacao) values ('teste-equipe-2', 'escritorio', 'ativa') returning id into org2;
  insert into public.membros (organizacao_id, user_id, papel) values (org2, fora, 'administrador'), (org2, adv2, 'assistente');
  insert into public.prazos (djen_id, organizacao_id, user_id) values ('teste-equipe-org2', org2, fora);
  insert into public.feriados_organizacao (organizacao_id, data) values (org2, '2031-03-01');
  select m.organizacao_id into solo from public.membros m where m.user_id = fora and m.organizacao_id <> org2;
  insert into public.prazos (djen_id, organizacao_id, user_id) values ('teste-equipe-solo', solo, fora);
  select count(*) into n from public.feriados where user_id = adv2 and data = '2031-03-01';
  if n <> 0 then raise exception 'Robô usou feriado de outra organização para adv2'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', adv2, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.prazos where djen_id in ('teste-equipe-base', 'teste-equipe-org2');
  if n <> 2 then raise exception 'Membro de duas organizações vê % de 2 prazos', n; end if;
  select count(*) into n from public.prazos where organizacao_id = solo;
  if n <> 0 then raise exception 'adv2 leu prazos de uma terceira organização'; end if;
  begin
    insert into public.monitoramentos (organizacao_id, user_id, tipo, numero_processo) values (org2, adv2, 'processo', lpad('9', 20, '0'));
    raise exception 'Assistente da outra organização criou monitoramento';
  exception when insufficient_privilege then null;
  end;

  -- Convites: vaga, duplicidade, quem já é da equipe, cancelar libera a vaga.
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  conv := public.convidar(org, '  Novo@Teste.Despert.dev ', 'advogado');
  if conv.email <> 'novo@teste.despert.dev' then raise exception 'E-mail do convite não foi normalizado'; end if;
  begin
    perform public.convidar(org, 'outro@teste.despert.dev', 'leitura');
    raise exception 'Convite acima do limite de usuários aceito';
  exception when raise_exception then
    if sqlerrm not like 'Limite de usuários atingido (6)%' then raise; end if;
  end;
  begin
    perform public.convidar(org, 'novo@teste.despert.dev', 'leitura');
    raise exception 'Convite duplicado aceito';
  exception when raise_exception then
    if sqlerrm not like 'Já existe um convite pendente%' then raise; end if;
  end;
  begin
    perform public.convidar(org, 'ass@teste.despert.dev', 'leitura');
    raise exception 'Convite para quem já é da equipe aceito';
  exception when raise_exception then
    if sqlerrm not like 'Essa pessoa já faz parte%' then raise; end if;
  end;
  conv := public.reenviar_convite(conv.id);
  perform public.cancelar_convite(conv.id);
  conv := public.convidar(org, 'novo@teste.despert.dev', 'advogado');

  -- Aceitar: conta nova com convite não ganha organização própria; e-mail errado é recusado.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data) values
    (novo, 'authenticated', 'authenticated', 'novo@teste.despert.dev', now(), '{}', '{}'),
    (outro, 'authenticated', 'authenticated', 'intruso@teste.despert.dev', now(), '{}', '{}');
  select count(*) into n from public.membros where user_id = novo;
  if n <> 0 then raise exception 'Conta convidada ganhou organização própria'; end if;
  select count(*) into n from public.ver_convite(conv.token) v where v.situacao = 'pendente' and v.organizacao = 'teste-equipe';
  if n <> 1 then raise exception 'ver_convite não mostrou o convite pendente'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', outro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.aceitar_convite(conv.token);
    raise exception 'Convite aceito por outro e-mail';
  exception when raise_exception then
    if sqlerrm not like 'Este convite foi enviado para%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', novo, 'role', 'authenticated')::text, true);
  if public.aceitar_convite(conv.token) <> org then raise exception 'aceitar_convite devolveu outra organização'; end if;
  select count(*) into n from public.membros where user_id = novo and organizacao_id = org and papel = 'advogado';
  if n <> 1 then raise exception 'Convite aceito não virou membro com o papel convidado'; end if;
  select count(*) into n from public.membros where organizacao_id = org;
  if n <> 6 then raise exception 'Equipe com % de 6 membros após aceitar', n; end if;

  -- Saída de membro: OAB pausada, prazos ficam, os em aberto vão para o Administrador.
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  insert into public.prazos (djen_id, organizacao_id, user_id, responsavel_id, status)
    values ('teste-equipe-aberto', org, adv, adv, 'pendente') returning id into aberto;
  insert into public.prazos (djen_id, organizacao_id, user_id, responsavel_id, status, cumprido_em)
    values ('teste-equipe-fechado', org, adv, adv, 'cumprido', now()) returning id into fechado;
  perform public.remover_membro(org, adv);
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.monitoramentos where organizacao_id = org and oab_numero = '901' and not ativo;
  if n <> 1 then raise exception 'OAB de quem saiu continuou ativa'; end if;
  select count(*) into n from public.prazos where id = aberto and responsavel_id = adm;
  if n <> 1 then raise exception 'Prazo em aberto de quem saiu não foi para o Administrador'; end if;
  select count(*) into n from public.prazos where id = fechado and responsavel_id = adv;
  if n <> 1 then raise exception 'Prazo cumprido de quem saiu mudou de responsável'; end if;
  select count(*) into n from public.prazos where organizacao_id = org and user_id = adv;
  if n < 3 then raise exception 'Prazos de quem saiu foram apagados'; end if;
  select count(*) into n from public.monitoramentos where organizacao_id = org and numero_processo = lpad('8', 20, '0') and user_id = adm;
  if n <> 1 then raise exception 'Processo avulso de quem saiu não passou para o Administrador'; end if;

  -- Rebaixar Advogado pausa a OAB; o último Administrador não sai nem é rebaixado.
  perform set_config('role', 'authenticated', true);
  perform public.alterar_papel(org, adv2, 'assistente');
  select count(*) into n from public.monitoramentos where organizacao_id = org and oab_numero = '904' and ativo;
  if n <> 0 then raise exception 'OAB de quem virou Assistente continuou ativa'; end if;
  begin
    perform public.alterar_papel(org, adm, 'advogado');
    raise exception 'Último Administrador rebaixado';
  exception when raise_exception then
    if sqlerrm not like 'A organização precisa de pelo menos um Administrador%' then raise; end if;
  end;
  begin
    perform public.remover_membro(org, adm);
    raise exception 'Administrador removeu a si mesmo';
  exception when raise_exception then
    if sqlerrm not like 'Você não pode remover a si mesmo%' then raise; end if;
  end;

  -- Solo não tem equipe: convite só para Administrador e dentro de 1 usuário.
  perform set_config('request.jwt.claims', json_build_object('sub', fora, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.convidar(solo, 'alguem@teste.despert.dev', 'advogado');
    raise exception 'Solo convidou com papel';
  exception when raise_exception then
    if sqlerrm not like 'O plano desta organização não tem papéis%' then raise; end if;
  end;
  begin
    perform public.convidar(solo, 'alguem@teste.despert.dev', 'administrador');
    raise exception 'Solo convidou segundo usuário';
  exception when raise_exception then
    if sqlerrm not like 'Limite de usuários atingido (1)%' then raise; end if;
  end;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  raise notice 'Papéis, equipe e convites: ok';
end $$;
