-- Despert — Monitor de Prazos (DJEN)
-- Schema multitenant: cada advogado é dono exclusivo dos seus dados.
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
-- Disparo do "Buscar agora": a aplicação respeita 10 min entre buscas a partir desta data.
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

-- ============================ nova conta ============================
-- Toda conta nova nasce com uma configuração padrão e o e-mail já como destino do resumo.
create or replace function public.ao_criar_conta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.configuracoes (user_id, email_destino)
  values (new.id, coalesce(new.email, ''))
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists criar_conta_configuracoes on auth.users;
create trigger criar_conta_configuracoes after insert on auth.users
  for each row execute function public.ao_criar_conta();

-- ============================ RLS ============================
-- Usuário autenticado só toca nos próprios registros.
-- O n8n usa a chave service_role, que ignora o RLS.
alter table public.configuracoes  enable row level security;
alter table public.monitoramentos enable row level security;
alter table public.feriados       enable row level security;
alter table public.prazos         enable row level security;
alter table public.execucoes      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['configuracoes', 'monitoramentos', 'feriados', 'prazos', 'execucoes'] loop
    execute format('drop policy if exists "dono_do_registro" on public.%I', t);
    execute format($p$create policy "dono_do_registro" on public.%I
      for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()))$p$, t);
  end loop;
end $$;

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

-- O dev enxerga e altera os dados de qualquer advogado (suporte e "atuar como advogado").
do $$
declare t text;
begin
  foreach t in array array['configuracoes', 'monitoramentos', 'feriados', 'prazos', 'execucoes'] loop
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
  foreach t in array array['configuracoes', 'monitoramentos', 'feriados', 'prazos', 'configuracao_sistema'] loop
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
