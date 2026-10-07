-- Despert — Monitor de Prazos (DJEN)
-- Schema multitenant: a organização é dona dos dados (ADR-0007); o advogado solo é uma
-- organização de um membro.
-- Aplique este arquivo inteiro no SQL Editor do Supabase (idempotente: pode rodar de novo).

-- ============================ configurações ============================
-- Uma linha por advogado (não existe configuração global).
create table if not exists public.configuracoes (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  email_destino      text    not null default '',
  dias_retroativos   int     not null default 5  check (dias_retroativos between 1 and 30),
  prazo_padrao_dias  int     not null default 15 check (prazo_padrao_dias between 1 and 365),
  dias_alerta        int     not null default 7  check (dias_alerta between 1 and 60),
  considerar_recesso boolean not null default true,
  webhook_token      text    not null default replace(gen_random_uuid()::text, '-', ''),
  ultima_busca_em    timestamptz,
  updated_at         timestamptz not null default now()
);
-- Legado: o "Buscar agora" passou a ser contado por organização em public.buscas_agora.
alter table public.configuracoes add column if not exists ultima_busca_em timestamptz;
-- O n8n identifica o advogado pelo token do webhook.
create unique index if not exists configuracoes_webhook_token_idx on public.configuracoes (webhook_token);

-- ============================ monitoramentos ============================
create table if not exists public.monitoramentos (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  tipo            text not null check (tipo in ('oab', 'processo')),
  oab_numero      text,
  oab_uf          char(2),
  numero_processo text,
  descricao       text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  constraint monitoramento_valido check (
    (tipo = 'oab' and oab_numero is not null and oab_uf is not null) or
    (tipo = 'processo' and numero_processo is not null)
  )
);
create index if not exists monitoramentos_user_idx on public.monitoramentos (user_id);

-- ============================ feriados ============================
-- Feriados locais e suspensões de expediente (os nacionais já são considerados pelo robô).
create table if not exists public.feriados (
  user_id   uuid not null references auth.users (id) on delete cascade,
  data      date not null,
  descricao text not null default '',
  primary key (user_id, data)
);
create index if not exists feriados_user_idx on public.feriados (user_id);

-- ============================ prazos ============================
create table if not exists public.prazos (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  djen_id               text not null,
  processo              text,
  tribunal              text,
  orgao                 text,
  tipo                  text,
  classe                text,
  partes                text,
  prazo_dias            int,
  origem_prazo          text,
  data_disponibilizacao date,
  data_publicacao       date,
  inicio_prazo          date,
  vencimento            date,
  status                text not null default 'pendente'
                        check (status in ('pendente', 'conferir', 'cumprido', 'arquivado')),
  link                  text,
  teor                  text,
  observacoes           text,
  cumprido_em           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, djen_id)
);
create index if not exists prazos_user_vencimento_idx on public.prazos (user_id, vencimento);
create index if not exists prazos_status_idx on public.prazos (status);

-- ============================ execuções ============================
-- user_id nulo = falha global, antes de alcançar qualquer advogado (só o n8n enxerga).
create table if not exists public.execucoes (
  id           bigint generated always as identity primary key,
  user_id      uuid references auth.users (id) on delete cascade,
  executado_em timestamptz not null default now(),
  origem       text,
  encontradas  int not null default 0,
  novas        int not null default 0,
  status       text not null default 'ok' check (status in ('ok', 'falha')),
  detalhe      text
);
create index if not exists execucoes_data_idx on public.execucoes (executado_em desc);
create index if not exists execucoes_user_idx on public.execucoes (user_id, executado_em desc);

-- A aplicação pode omitir o dono: o banco assume o usuário logado (o RLS confere de todo jeito).
alter table public.monitoramentos alter column user_id set default auth.uid();
alter table public.feriados       alter column user_id set default auth.uid();
alter table public.prazos         alter column user_id set default auth.uid();

-- ============================ updated_at automático ============================
create or replace function public.tocar_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists prazos_updated_at on public.prazos;
create trigger prazos_updated_at before update on public.prazos
  for each row execute function public.tocar_updated_at();

drop trigger if exists configuracoes_updated_at on public.configuracoes;
create trigger configuracoes_updated_at before update on public.configuracoes
  for each row execute function public.tocar_updated_at();

-- ============================ organizações ============================
-- Dona dos dados. Por enquanto cada pessoa pertence a uma só organização; convites e
-- papéis além do administrador chegam com a equipe.
create table if not exists public.organizacoes (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null default '',
  rotulo            text not null default 'escritorio'
                    check (rotulo in ('escritorio', 'departamento_juridico')),
  plano             text not null default 'solo' check (plano in ('solo', 'escritorio', 'corporativo')),
  situacao          text not null default 'teste' check (situacao in ('teste', 'ativa')),
  teste_iniciado_em timestamptz,
  criado_em         timestamptz not null default now()
);

create table if not exists public.membros (
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  papel          text not null default 'administrador'
                 check (papel in ('administrador', 'advogado', 'assistente', 'leitura')),
  criado_em      timestamptz not null default now(),
  primary key (organizacao_id, user_id)
);
create index if not exists membros_user_idx on public.membros (user_id);

-- Plano (ADR-0008): pago_ate é o último dia pago (nulo = sem vencimento); limites guarda só
-- os ajustes do dev, que sobrescrevem o padrão do plano.
alter table public.organizacoes add column if not exists pago_ate date;
alter table public.organizacoes add column if not exists limites jsonb not null default '{}'::jsonb;

-- Cada "Buscar agora" disparado: base do intervalo mínimo e da cota diária da organização.
create table if not exists public.buscas_agora (
  id             bigint generated always as identity primary key,
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  user_id        uuid references auth.users (id) on delete set null,
  criado_em      timestamptz not null default now()
);
create index if not exists buscas_agora_org_idx on public.buscas_agora (organizacao_id, criado_em desc);

-- user_id continua: o n8n ainda grava por advogado e é o autor do registro.
alter table public.monitoramentos add column if not exists organizacao_id uuid references public.organizacoes (id) on delete cascade;
alter table public.feriados       add column if not exists organizacao_id uuid references public.organizacoes (id) on delete cascade;
alter table public.prazos         add column if not exists organizacao_id uuid references public.organizacoes (id) on delete cascade;
alter table public.prazos         add column if not exists responsavel_id uuid references auth.users (id) on delete set null;
-- Falha geral, antes de identificar o advogado, não tem organização.
alter table public.execucoes      add column if not exists organizacao_id uuid references public.organizacoes (id) on delete cascade;

create index if not exists monitoramentos_org_idx on public.monitoramentos (organizacao_id);
create index if not exists feriados_org_idx       on public.feriados (organizacao_id);
create index if not exists prazos_org_vencimento_idx on public.prazos (organizacao_id, vencimento);
create index if not exists execucoes_org_idx      on public.execucoes (organizacao_id, executado_em desc);

-- Única organização de uma pessoa (a mais antiga, quando houver mais de uma).
create or replace function public.organizacao_de(uid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select organizacao_id from public.membros where user_id = uid order by criado_em limit 1
$$;
revoke all on function public.organizacao_de(uuid) from public, anon;
grant execute on function public.organizacao_de(uuid) to authenticated, service_role;

-- Base do RLS: o usuário logado é membro da organização?
create or replace function public.membro_de(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membros where organizacao_id = org and user_id = auth.uid())
$$;
revoke all on function public.membro_de(uuid) from public, anon;
grant execute on function public.membro_de(uuid) to authenticated, service_role;

-- O n8n (service_role) grava só o user_id: a organização vem do membro.
create or replace function public.preencher_organizacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.organizacao_id is null and new.user_id is not null then
    new.organizacao_id := public.organizacao_de(new.user_id);
  end if;
  if tg_table_name = 'prazos' then
    if new.responsavel_id is null then
      new.responsavel_id := new.user_id;
    end if;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['monitoramentos', 'feriados', 'prazos', 'execucoes'] loop
    execute format('drop trigger if exists preencher_organizacao on public.%I', t);
    execute format(
      'create trigger preencher_organizacao before insert on public.%I
         for each row execute function public.preencher_organizacao()', t);
  end loop;
end $$;

-- Organização sem nenhum membro (conta excluída) não tem mais quem a acesse.
create or replace function public.remover_organizacao_vazia() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.membros where organizacao_id = old.organizacao_id) then
    delete from public.organizacoes where id = old.organizacao_id;
  end if;
  return null;
end $$;

drop trigger if exists remover_organizacao_vazia on public.membros;
create trigger remover_organizacao_vazia after delete on public.membros
  for each row execute function public.remover_organizacao_vazia();

-- Migração: cada conta existente (menos o dev) vira uma organização Solo de um membro.
do $$
declare
  conta record;
  org   uuid;
begin
  for conta in
    select u.id, u.email from auth.users u
    where coalesce(u.raw_app_meta_data ->> 'app_role', '') <> 'dev'
      and not exists (select 1 from public.membros m where m.user_id = u.id)
    order by u.created_at
  loop
    insert into public.organizacoes (nome, situacao)
    values (split_part(coalesce(conta.email, ''), '@', 1), 'ativa')
    returning id into org;
    insert into public.membros (organizacao_id, user_id, papel) values (org, conta.id, 'administrador');
  end loop;
end $$;

alter table public.prazos disable trigger prazos_updated_at;
update public.prazos set organizacao_id = public.organizacao_de(user_id) where organizacao_id is null;
update public.prazos set responsavel_id = user_id where responsavel_id is null;
alter table public.prazos enable trigger prazos_updated_at;
update public.monitoramentos set organizacao_id = public.organizacao_de(user_id) where organizacao_id is null;
update public.feriados       set organizacao_id = public.organizacao_de(user_id) where organizacao_id is null;
update public.execucoes      set organizacao_id = public.organizacao_de(user_id)
  where organizacao_id is null and user_id is not null;

-- Falha aqui = existe dado de alguém sem organização (o dev não deve ter dados próprios).
alter table public.monitoramentos alter column organizacao_id set not null;
alter table public.feriados       alter column organizacao_id set not null;
alter table public.prazos         alter column organizacao_id set not null;

-- ============================ nova conta ============================
-- Toda conta nova nasce com uma configuração padrão, o e-mail já como destino do resumo,
-- e a própria organização (Solo, em período de teste) da qual é administradora.
create or replace function public.ao_criar_conta() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  org uuid;
begin
  insert into public.configuracoes (user_id, email_destino)
  values (new.id, coalesce(new.email, ''))
  on conflict (user_id) do nothing;
  if not exists (select 1 from public.membros where user_id = new.id) then
    insert into public.organizacoes (nome, situacao, teste_iniciado_em)
    values (split_part(coalesce(new.email, ''), '@', 1), 'teste', now())
    returning id into org;
    insert into public.membros (organizacao_id, user_id, papel) values (org, new.id, 'administrador');
  end if;
  return new;
end $$;

drop trigger if exists criar_conta_configuracoes on auth.users;
create trigger criar_conta_configuracoes after insert on auth.users
  for each row execute function public.ao_criar_conta();

-- ============================ RLS ============================
-- Dados de negócio: qualquer membro da organização dona da linha.
-- Configurações: cada pessoa só a própria.
-- O n8n usa a chave service_role, que ignora o RLS.
alter table public.configuracoes  enable row level security;
alter table public.monitoramentos enable row level security;
alter table public.feriados       enable row level security;
alter table public.prazos         enable row level security;
alter table public.execucoes      enable row level security;
alter table public.organizacoes   enable row level security;
alter table public.membros        enable row level security;
alter table public.buscas_agora   enable row level security;

drop policy if exists "dono_do_registro" on public.configuracoes;
create policy "dono_do_registro" on public.configuracoes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['monitoramentos', 'feriados', 'prazos', 'execucoes'] loop
    execute format('drop policy if exists "dono_do_registro" on public.%I', t);
    execute format('drop policy if exists "membro_da_organizacao" on public.%I', t);
    execute format($p$create policy "membro_da_organizacao" on public.%I
      for all to authenticated
      using (public.membro_de(organizacao_id))
      with check (public.membro_de(organizacao_id))$p$, t);
  end loop;
end $$;

-- Organização e equipe: só leitura para os membros nesta fase.
drop policy if exists "membro_le" on public.organizacoes;
create policy "membro_le" on public.organizacoes
  for select to authenticated using (public.membro_de(id));
drop policy if exists "membro_le" on public.membros;
create policy "membro_le" on public.membros
  for select to authenticated using (public.membro_de(organizacao_id));
-- Disparos do Buscar agora: leitura; o registro passa por public.registrar_busca_agora().
drop policy if exists "membro_le" on public.buscas_agora;
create policy "membro_le" on public.buscas_agora
  for select to authenticated using (public.membro_de(organizacao_id));

-- ============================ papel dev ============================
-- O papel fica em auth.users.raw_app_meta_data ->> 'app_role' (app_metadata): só a service_role altera.
-- Conferido direto em auth.users (não no JWT) para que revogar o papel valha na hora.
create or replace function public.is_dev() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid() and raw_app_meta_data ->> 'app_role' = 'dev'
  )
$$;
revoke all on function public.is_dev() from public, anon;
grant execute on function public.is_dev() to authenticated, service_role;

-- O dev enxerga e altera os dados de qualquer organização (suporte e "atuar como advogado").
do $$
declare t text;
begin
  foreach t in array array['configuracoes', 'monitoramentos', 'feriados', 'prazos', 'execucoes', 'organizacoes', 'membros', 'buscas_agora'] loop
    execute format('drop policy if exists "dev_acesso_total" on public.%I', t);
    execute format($p$create policy "dev_acesso_total" on public.%I
      for all to authenticated
      using ((select public.is_dev()))
      with check ((select public.is_dev()))$p$, t);
  end loop;
end $$;

-- ============================ configuração do sistema ============================
-- Linha única com o que vale para todos os advogados. Só o dev altera.
create table if not exists public.configuracao_sistema (
  id              int primary key default 1 check (id = 1),
  n8n_webhook_url text not null default '',
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null
);
insert into public.configuracao_sistema (id) values (1) on conflict (id) do nothing;

-- Migração: a URL do webhook era por advogado; aproveita a mais recente e remove a coluna.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'configuracoes' and column_name = 'n8n_webhook_url'
  ) then
    execute $m$
      update public.configuracao_sistema s
      set n8n_webhook_url = c.url
      from (
        select n8n_webhook_url as url from public.configuracoes
        where n8n_webhook_url <> '' order by updated_at desc limit 1
      ) c
      where s.id = 1 and s.n8n_webhook_url = ''
    $m$;
    alter table public.configuracoes drop column n8n_webhook_url;
  end if;
end $$;

create or replace function public.carimbar_configuracao_sistema() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end $$;

drop trigger if exists configuracao_sistema_carimbo on public.configuracao_sistema;
create trigger configuracao_sistema_carimbo before update on public.configuracao_sistema
  for each row execute function public.carimbar_configuracao_sistema();

alter table public.configuracao_sistema enable row level security;
drop policy if exists "leitura_autenticada" on public.configuracao_sistema;
create policy "leitura_autenticada" on public.configuracao_sistema
  for select to authenticated using (true);
drop policy if exists "dev_altera" on public.configuracao_sistema;
create policy "dev_altera" on public.configuracao_sistema
  for update to authenticated
  using ((select public.is_dev()))
  with check ((select public.is_dev()));

-- ============================ planos e limites ============================
-- ADR-0008. As regras puras estão espelhadas em web/src/domain/planos.ts.
-- Teste e carência, em dias, ajustáveis pelo dev.
alter table public.configuracao_sistema add column if not exists dias_teste int not null default 7
  check (dias_teste between 1 and 90);
alter table public.configuracao_sistema add column if not exists carencia_aviso_dias int not null default 5
  check (carencia_aviso_dias between 0 and 60);
alter table public.configuracao_sistema add column if not exists carencia_total_dias int not null default 15
  check (carencia_total_dias between 0 and 120);
do $$
begin
  alter table public.configuracao_sistema
    add constraint carencia_em_ordem check (carencia_aviso_dias <= carencia_total_dias);
exception when duplicate_object then null;
end $$;

-- Espelho de LIMITES_PADRAO em web/src/domain/planos.ts: mudar um exige mudar o outro.
create or replace function public.limites_padrao(plano text) returns jsonb
language sql immutable set search_path = '' as $$
  select case plano
    when 'escritorio' then '{"usuarios": 10, "oabs": "por_advogado", "processos": 50, "buscas_automaticas": 2,
      "intervalo_busca_min": 10, "buscas_agora_dia": 15, "papeis": true, "auditoria": true}'::jsonb
    when 'corporativo' then '{"usuarios": 20, "oabs": "por_advogado", "processos": 70, "buscas_automaticas": 2,
      "intervalo_busca_min": 10, "buscas_agora_dia": 20, "papeis": true, "auditoria": true}'::jsonb
    else '{"usuarios": 1, "oabs": 1, "processos": 10, "buscas_automaticas": 1,
      "intervalo_busca_min": 30, "buscas_agora_dia": 1, "papeis": false, "auditoria": false}'::jsonb
  end
$$;

create or replace function public.inteiro_entre(v jsonb, minimo int, maximo int) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(v) = 'number'
    then v::numeric between minimo and maximo and v::numeric = trunc(v::numeric)
    else false
  end
$$;

-- Ajustes aceitos: só chaves conhecidas, com o tipo e a faixa certos.
create or replace function public.limites_validos(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(j) = 'object' then not exists (
    select 1 from jsonb_each(j) as e (chave, valor)
    where not case e.chave
      when 'usuarios'            then public.inteiro_entre(e.valor, 1, 500)
      when 'oabs'                then e.valor = '"por_advogado"'::jsonb or public.inteiro_entre(e.valor, 0, 500)
      when 'processos'           then public.inteiro_entre(e.valor, 0, 5000)
      when 'buscas_automaticas'  then public.inteiro_entre(e.valor, 1, 2)
      when 'intervalo_busca_min' then public.inteiro_entre(e.valor, 1, 1440)
      when 'buscas_agora_dia'    then public.inteiro_entre(e.valor, 0, 500)
      when 'papeis'              then jsonb_typeof(e.valor) = 'boolean'
      when 'auditoria'           then jsonb_typeof(e.valor) = 'boolean'
      else false
    end
  ) else false end
$$;

do $$
begin
  alter table public.organizacoes add constraint limites_validos check (public.limites_validos(limites));
exception when duplicate_object then null;
end $$;

create or replace function public.limites_de(org uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.limites_padrao(o.plano) || o.limites from public.organizacoes o where o.id = org
$$;

-- "1 por advogado" = uma OAB por membro Administrador ou Advogado.
create or replace function public.limite_oabs(org uuid) returns int
language sql stable security definer set search_path = '' as $$
  select case when x.l ->> 'oabs' = 'por_advogado'
    then (select count(*)::int from public.membros m
          where m.organizacao_id = org and m.papel in ('administrador', 'advogado'))
    else (x.l ->> 'oabs')::int
  end
  from (select public.limites_de(org) as l) x
$$;

-- Espelho de etapaDaOrganizacao() em web/src/domain/planos.ts.
-- teste/ativa → aviso (tudo funciona) → leitura (só o robô grava) → suspensa (robô para).
create or replace function public.etapa_de(org uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  o    public.organizacoes;
  s    public.configuracao_sistema;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  fim  date;
  dia  int;
begin
  select * into o from public.organizacoes where id = org;
  if not found then
    return null;
  end if;
  select * into s from public.configuracao_sistema where id = 1;
  if o.situacao = 'ativa' then
    fim := o.pago_ate;
  else
    fim := (coalesce(o.teste_iniciado_em, o.criado_em) at time zone 'America/Sao_Paulo')::date + s.dias_teste - 1;
  end if;
  if fim is null or hoje <= fim then
    return o.situacao;
  end if;
  dia := hoje - fim;
  if dia <= s.carencia_aviso_dias then
    return 'aviso';
  end if;
  if dia <= s.carencia_total_dias then
    return 'leitura';
  end if;
  return 'suspensa';
end $$;

revoke all on function public.limites_de(uuid) from public, anon, authenticated;
revoke all on function public.limite_oabs(uuid) from public, anon, authenticated;
revoke all on function public.etapa_de(uuid) from public, anon, authenticated;
grant execute on function public.limites_de(uuid) to service_role;
grant execute on function public.limite_oabs(uuid) to service_role;
grant execute on function public.etapa_de(uuid) to service_role;

-- Reforço no banco para ninguém passar do plano pela API. O robô (service_role, sem
-- auth.uid) grava em qualquer etapa; o dev ajusta pelo painel; fora da organização quem
-- responde é o RLS.
create or replace function public.reforcar_plano() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  org    uuid;
  limite int;
  usados int;
begin
  if tg_op = 'DELETE' then
    org := old.organizacao_id;
  else
    org := new.organizacao_id;
  end if;
  if auth.uid() is null or public.is_dev() or not public.membro_de(org) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if public.etapa_de(org) in ('leitura', 'suspensa') then
    raise exception 'Somente leitura: o período de uso desta organização terminou. Fale com o suporte para reativar.'
      using errcode = '42501';
  end if;
  if tg_table_name = 'monitoramentos' and tg_op <> 'DELETE' then
    if new.ativo and (tg_op = 'INSERT' or not old.ativo or old.tipo is distinct from new.tipo) then
      perform 1 from public.organizacoes where id = org for update;
      if new.tipo = 'oab' then
        limite := public.limite_oabs(org);
      else
        limite := (public.limites_de(org) ->> 'processos')::int;
      end if;
      select count(*) into usados from public.monitoramentos
        where organizacao_id = org and tipo = new.tipo and ativo and id <> new.id;
      if usados >= limite then
        if new.tipo = 'oab' then
          raise exception 'Limite de OABs monitoradas atingido (%). Pause outra ou fale com o suporte.', limite
            using errcode = 'P0001';
        end if;
        raise exception 'Limite de processos avulsos atingido (%). Pause outro ou fale com o suporte.', limite
          using errcode = 'P0001';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['monitoramentos', 'feriados', 'prazos'] loop
    execute format('drop trigger if exists reforcar_plano on public.%I', t);
    execute format(
      'create trigger reforcar_plano before insert or update or delete on public.%I
         for each row execute function public.reforcar_plano()', t);
  end loop;
end $$;

create or replace function public.reforcar_plano_membros() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  l      jsonb;
  usados int;
begin
  if auth.uid() is null or public.is_dev() then
    return new;
  end if;
  if public.etapa_de(new.organizacao_id) in ('leitura', 'suspensa') then
    raise exception 'Somente leitura: o período de uso desta organização terminou. Fale com o suporte para reativar.'
      using errcode = '42501';
  end if;
  l := public.limites_de(new.organizacao_id);
  if new.papel <> 'administrador' and not (l ->> 'papeis')::boolean then
    if tg_op = 'INSERT' or new.papel is distinct from old.papel then
      raise exception 'O plano desta organização não tem papéis além do Administrador.' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'INSERT' then
    perform 1 from public.organizacoes where id = new.organizacao_id for update;
    select count(*) into usados from public.membros where organizacao_id = new.organizacao_id;
    if usados >= (l ->> 'usuarios')::int then
      raise exception 'Limite de usuários atingido (%).', l ->> 'usuarios' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists reforcar_plano on public.membros;
create trigger reforcar_plano before insert or update of papel on public.membros
  for each row execute function public.reforcar_plano_membros();

-- Plano menor: nada é apagado. Usuários excedentes viram Leitura (Administradores e os mais
-- antigos ficam) e monitoramentos excedentes são pausados (os mais antigos seguem ativos).
create or replace function public.aplicar_limites() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  l jsonb := public.limites_de(new.id);
begin
  update public.membros m set papel = 'leitura'
  from (
    select x.user_id from public.membros x
    where x.organizacao_id = new.id
    order by (x.papel = 'administrador') desc, x.criado_em, x.user_id
    offset (l ->> 'usuarios')::int
  ) excedente
  where m.organizacao_id = new.id and m.user_id = excedente.user_id and m.papel <> 'leitura';

  update public.monitoramentos set ativo = false
  where id in (
    select x.id from public.monitoramentos x
    where x.organizacao_id = new.id and x.tipo = 'oab' and x.ativo
    order by x.created_at, x.id offset public.limite_oabs(new.id)
  );
  update public.monitoramentos set ativo = false
  where id in (
    select x.id from public.monitoramentos x
    where x.organizacao_id = new.id and x.tipo = 'processo' and x.ativo
    order by x.created_at, x.id offset (l ->> 'processos')::int
  );
  return null;
end $$;

drop trigger if exists aplicar_limites on public.organizacoes;
create trigger aplicar_limites after update of plano, limites on public.organizacoes
  for each row when (old.plano is distinct from new.plano or old.limites is distinct from new.limites)
  execute function public.aplicar_limites();

-- Buscar agora: intervalo mínimo e cota diária (zera à meia-noite de Brasília) da organização.
create or replace function public.registrar_busca_agora(org uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  l          jsonb;
  ultima     timestamptz;
  de_hoje    int;
  novo       bigint;
  meia_noite timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
begin
  if auth.uid() is null or not (public.membro_de(org) or public.is_dev()) then
    raise exception 'Você não faz parte desta organização.' using errcode = '42501';
  end if;
  perform 1 from public.organizacoes where id = org for update;
  if public.etapa_de(org) in ('leitura', 'suspensa') then
    raise exception 'Somente leitura: o Buscar agora fica desligado até a organização ser reativada.'
      using errcode = '42501';
  end if;
  l := public.limites_de(org);
  select max(b.criado_em), count(*) filter (where b.criado_em >= meia_noite)
    into ultima, de_hoje
    from public.buscas_agora b
    where b.organizacao_id = org and b.criado_em > now() - interval '2 days';
  if de_hoje >= (l ->> 'buscas_agora_dia')::int then
    raise exception 'Limite diário do Buscar agora atingido. Libera de novo à meia-noite.' using errcode = 'P0001';
  end if;
  if ultima > now() - make_interval(mins => (l ->> 'intervalo_busca_min')::int) then
    raise exception 'Aguarde o intervalo mínimo de % minutos entre buscas.', l ->> 'intervalo_busca_min'
      using errcode = 'P0001';
  end if;
  insert into public.buscas_agora (organizacao_id, user_id) values (org, auth.uid()) returning id into novo;
  return novo;
end $$;

-- Desfaz o registro quando o robô recusa o disparo (só o próprio autor, logo em seguida).
create or replace function public.cancelar_busca_agora(busca bigint) returns void
language sql security definer set search_path = '' as $$
  delete from public.buscas_agora
  where id = busca and user_id = auth.uid() and criado_em > now() - interval '5 minutes'
$$;

revoke all on function public.registrar_busca_agora(uuid) from public, anon;
revoke all on function public.cancelar_busca_agora(bigint) from public, anon;
grant execute on function public.registrar_busca_agora(uuid) to authenticated;
grant execute on function public.cancelar_busca_agora(bigint) to authenticated;

-- Painel dev: organizações com uso atual (a etapa é calculada na aplicação).
create or replace function public.admin_listar_organizacoes()
returns table (
  id                  uuid,
  nome                text,
  rotulo              text,
  plano               text,
  situacao            text,
  teste_iniciado_em   timestamptz,
  pago_ate            date,
  limites             jsonb,
  criado_em           timestamptz,
  qtd_membros         bigint,
  qtd_advogados       bigint,
  oabs_ativas         bigint,
  processos_ativos    bigint,
  administrador_email text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_dev() then
    raise exception 'Acesso restrito ao dev.' using errcode = '42501';
  end if;
  return query
  select
    o.id, o.nome, o.rotulo, o.plano, o.situacao, o.teste_iniciado_em, o.pago_ate, o.limites, o.criado_em,
    (select count(*) from public.membros m where m.organizacao_id = o.id),
    (select count(*) from public.membros m
      where m.organizacao_id = o.id and m.papel in ('administrador', 'advogado')),
    (select count(*) from public.monitoramentos x where x.organizacao_id = o.id and x.tipo = 'oab' and x.ativo),
    (select count(*) from public.monitoramentos x where x.organizacao_id = o.id and x.tipo = 'processo' and x.ativo),
    (select u.email::text from public.membros m join auth.users u on u.id = m.user_id
      where m.organizacao_id = o.id and m.papel = 'administrador' order by m.criado_em limit 1)
  from public.organizacoes o
  order by o.criado_em;
end $$;

revoke all on function public.admin_listar_organizacoes() from public, anon;
grant execute on function public.admin_listar_organizacoes() to authenticated;

-- ============================ auditoria ============================
-- Tudo o que um dev faz: ações administrativas (Edge Function "admin") e qualquer escrita
-- nos dados dos advogados (gatilhos abaixo). Sem chave estrangeira no alvo: o registro
-- sobrevive à exclusão da conta.
create table if not exists public.auditoria (
  id           bigint generated always as identity primary key,
  criado_em    timestamptz not null default now(),
  dev_id       uuid references auth.users (id) on delete set null,
  dev_email    text,
  acao         text not null,
  alvo_user_id uuid,
  alvo_email   text,
  detalhe      jsonb not null default '{}'::jsonb
);
create index if not exists auditoria_data_idx on public.auditoria (criado_em desc);

alter table public.auditoria enable row level security;
drop policy if exists "dev_le" on public.auditoria;
create policy "dev_le" on public.auditoria
  for select to authenticated using ((select public.is_dev()));
drop policy if exists "dev_registra" on public.auditoria;
create policy "dev_registra" on public.auditoria
  for insert to authenticated
  with check ((select public.is_dev()) and dev_id = (select auth.uid()));

create or replace function public.auditar_dev() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  antes  jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  depois jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  linha  jsonb := coalesce(depois, antes);
  alvo   uuid  := nullif(linha ->> 'user_id', '')::uuid;
  campos jsonb := '[]'::jsonb;
begin
  if not public.is_dev() then
    return null;
  end if;
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(k order by k), '[]'::jsonb) into campos
    from jsonb_object_keys(depois) as k
    where k not in ('updated_at', 'updated_by') and depois -> k is distinct from antes -> k;
  end if;
  insert into public.auditoria (dev_id, dev_email, acao, alvo_user_id, alvo_email, detalhe)
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    lower(tg_op) || ':' || tg_table_name,
    alvo,
    (select email from auth.users where id = alvo),
    jsonb_strip_nulls(jsonb_build_object(
      'registro', coalesce(linha ->> 'id', linha ->> 'data'),
      'processo', linha ->> 'processo',
      'campos', case when tg_op = 'UPDATE' then campos end
    ))
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['configuracoes', 'monitoramentos', 'feriados', 'prazos', 'configuracao_sistema', 'organizacoes', 'membros'] loop
    execute format('drop trigger if exists auditar_dev on public.%I', t);
    execute format(
      'create trigger auditar_dev after insert or update or delete on public.%I
         for each row execute function public.auditar_dev()', t);
  end loop;
end $$;

-- ============================ funções do painel dev ============================
create or replace function public.admin_listar_contas()
returns table (
  id                     uuid,
  email                  text,
  criado_em              timestamptz,
  ultimo_acesso          timestamptz,
  confirmado             boolean,
  bloqueado              boolean,
  app_role               text,
  monitoramentos_ativos  bigint,
  prazos_abertos         bigint,
  prazos_vencidos        bigint,
  ultima_execucao        timestamptz,
  ultima_execucao_status text
)
language plpgsql stable security definer set search_path = '' as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.is_dev() then
    raise exception 'Acesso restrito ao dev.' using errcode = '42501';
  end if;
  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at is not null,
    coalesce(u.banned_until > now(), false),
    coalesce(u.raw_app_meta_data ->> 'app_role', 'advogado'),
    (select count(*) from public.monitoramentos m where m.user_id = u.id and m.ativo),
    (select count(*) from public.prazos p where p.user_id = u.id and p.status in ('pendente', 'conferir')),
    (select count(*) from public.prazos p
      where p.user_id = u.id and p.status in ('pendente', 'conferir') and p.vencimento < hoje),
    e.executado_em,
    e.status
  from auth.users u
  left join lateral (
    select x.executado_em, x.status from public.execucoes x
    where x.user_id = u.id order by x.executado_em desc limit 1
  ) e on true
  order by u.created_at;
end $$;

create or replace function public.admin_metricas() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  ultima record;
begin
  if not public.is_dev() then
    raise exception 'Acesso restrito ao dev.' using errcode = '42501';
  end if;
  select executado_em, status into ultima from public.execucoes order by executado_em desc limit 1;
  return jsonb_build_object(
    'contas',                (select count(*) from auth.users),
    'devs',                  (select count(*) from auth.users where raw_app_meta_data ->> 'app_role' = 'dev'),
    'contas_bloqueadas',     (select count(*) from auth.users where banned_until > now()),
    'advogados_ativos',      (select count(distinct user_id) from public.monitoramentos where ativo),
    'monitoramentos_ativos', (select count(*) from public.monitoramentos where ativo),
    'prazos_total',          (select count(*) from public.prazos),
    'prazos_abertos',        (select count(*) from public.prazos where status in ('pendente', 'conferir')),
    'prazos_vencidos',       (select count(*) from public.prazos
                               where status in ('pendente', 'conferir') and vencimento < hoje),
    'prazos_conferir',       (select count(*) from public.prazos where status = 'conferir'),
    'execucoes_24h',         (select count(*) from public.execucoes where executado_em > now() - interval '24 hours'),
    'falhas_24h',            (select count(*) from public.execucoes
                               where status = 'falha' and executado_em > now() - interval '24 hours'),
    'ultima_execucao',       ultima.executado_em,
    'ultima_execucao_status', ultima.status
  );
end $$;

revoke all on function public.admin_listar_contas() from public, anon;
revoke all on function public.admin_metricas() from public, anon;
grant execute on function public.admin_listar_contas() to authenticated;
grant execute on function public.admin_metricas() to authenticated;

-- ============================ conta dev ============================
-- Promove a conta dev do projeto (idempotente). Depois de rodar, recarregue o site.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"app_role": "dev"}'::jsonb
where id = 'b09286ec-03fb-4025-a934-7dcb455e56c7';

-- ============================ tempo real ============================
do $$
begin
  alter publication supabase_realtime add table public.prazos;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.execucoes;
exception when duplicate_object then null;
end $$;
