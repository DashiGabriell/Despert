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
  n8n_webhook_url    text    not null default '',
  webhook_token      text    not null default replace(gen_random_uuid()::text, '-', ''),
  updated_at         timestamptz not null default now()
);

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
