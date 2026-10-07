-- Despert — Monitor de Prazos (DJEN)
-- Schema multitenant: a organização é dona dos dados (ADR-0007); o advogado solo é uma
-- organização de um membro.
-- Aplique este arquivo inteiro no SQL Editor do Supabase (idempotente: pode rodar de novo).

-- ============================ configurações ============================
-- Uma linha por pessoa, só com o que é pessoal: o que vale para a organização inteira fica
-- em public.configuracoes_organizacao.
create table if not exists public.configuracoes (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  email_destino      text    not null default '',
  dias_alerta        int     not null default 7  check (dias_alerta between 1 and 60),
  updated_at         timestamptz not null default now()
);
drop index if exists public.configuracoes_webhook_token_idx;
-- Resumo diário só com os prazos da pessoa ou com todos; nulo = padrão do papel.
alter table public.configuracoes add column if not exists resumo_escopo text
  check (resumo_escopo in ('meus', 'todos'));

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
-- Feriados locais e suspensões de expediente (os nacionais já são considerados pelo robô)
-- ficam em public.feriados_organizacao; public.feriados é a visão que o robô lê.

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
  updated_at            timestamptz not null default now()
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
-- Quando o robô aceitou o disparo: cada registro libera uma única busca.
alter table public.buscas_agora add column if not exists processada_em timestamptz;

-- Feriados locais da organização: uma linha por data, só o Administrador altera.
create table if not exists public.feriados_organizacao (
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  data           date not null,
  descricao      text not null default '',
  primary key (organizacao_id, data)
);

-- Configurações do robô que valem para a organização inteira (só o Administrador altera).
create table if not exists public.configuracoes_organizacao (
  organizacao_id     uuid primary key references public.organizacoes (id) on delete cascade,
  dias_retroativos   int     not null default 5  check (dias_retroativos between 1 and 30),
  prazo_padrao_dias  int     not null default 15 check (prazo_padrao_dias between 1 and 365),
  considerar_recesso boolean not null default true,
  webhook_token      text    not null unique default replace(gen_random_uuid()::text, '-', ''),
  updated_at         timestamptz not null default now()
);

-- Convite para entrar na equipe: vale 7 dias, aceito pelo link com o token.
create table if not exists public.convites (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  email          text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  papel          text not null check (papel in ('administrador', 'advogado', 'assistente', 'leitura')),
  token          text not null unique
                 default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  criado_por     uuid references auth.users (id) on delete set null,
  criado_em      timestamptz not null default now(),
  expira_em      timestamptz not null default now() + interval '7 days',
  aceito_em      timestamptz
);
create unique index if not exists convites_pendente_idx on public.convites (organizacao_id, email)
  where aceito_em is null;
-- Quando o robô mandou o e-mail do convite (nulo = falta mandar; reenviar zera).
alter table public.convites add column if not exists enviado_em timestamptz;

-- user_id é o autor do registro (no robô, o responsável).
alter table public.monitoramentos add column if not exists organizacao_id uuid references public.organizacoes (id) on delete cascade;
alter table public.prazos         add column if not exists organizacao_id uuid references public.organizacoes (id) on delete cascade;
alter table public.prazos         add column if not exists responsavel_id uuid references auth.users (id) on delete set null;
-- Falha geral, antes de identificar o advogado, não tem organização.
alter table public.execucoes      add column if not exists organizacao_id uuid references public.organizacoes (id) on delete cascade;

create index if not exists monitoramentos_org_idx on public.monitoramentos (organizacao_id);
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

-- O usuário logado tem um destes papéis na organização? (permissões, ADR-0007)
create or replace function public.tem_papel(org uuid, papeis text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membros
    where organizacao_id = org and user_id = auth.uid() and papel = any (papeis)
  )
$$;
revoke all on function public.tem_papel(uuid, text[]) from public, anon;
grant execute on function public.tem_papel(uuid, text[]) to authenticated, service_role;

-- Insert só com user_id (scripts antigos, dados de teste): a organização mais antiga da pessoa.
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
  foreach t in array array['monitoramentos', 'prazos', 'execucoes'] loop
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
update public.execucoes      set organizacao_id = public.organizacao_de(user_id)
  where organizacao_id is null and user_id is not null;

-- Falha aqui = existe dado de alguém sem organização (o dev não deve ter dados próprios).
alter table public.monitoramentos alter column organizacao_id set not null;
alter table public.prazos         alter column organizacao_id set not null;

-- Uma publicação vira um prazo só por organização, mesmo intimando duas OABs da casa (#19).
alter table public.prazos drop constraint if exists prazos_user_id_djen_id_key;
create unique index if not exists prazos_org_djen_idx on public.prazos (organizacao_id, djen_id);
-- Outros membros cujas OABs a mesma publicação intimou (o primeiro listado é o responsável).
alter table public.prazos add column if not exists tambem_intimados uuid[] not null default '{}';

-- Migração: a tabela antiga de feriados tinha uma linha por advogado; vira uma por data
-- da organização. Depois de convertida, o nome passa a ser a visão do robô.
do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'feriados' and c.relkind = 'r'
  ) then
    insert into public.feriados_organizacao (organizacao_id, data, descricao)
    select distinct on (f.organizacao_id, f.data) f.organizacao_id, f.data, f.descricao
    from public.feriados f
    where f.organizacao_id is not null
    order by f.organizacao_id, f.data, f.descricao
    on conflict (organizacao_id, data) do nothing;
    drop table public.feriados;
  end if;
end $$;

-- A visão por advogado que o robô lia até a fase 4: agora ele recebe os feriados em robo_lote().
drop view if exists public.feriados;

-- ============================ nova conta ============================
-- Toda conta nova nasce com uma configuração padrão, o e-mail já como destino do resumo,
-- e a própria organização (Solo, em período de teste) da qual é administradora. Quem foi
-- convidado não ganha organização própria: entra na que convidou ao aceitar.
create or replace function public.ao_criar_conta() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  org uuid;
begin
  insert into public.configuracoes (user_id, email_destino)
  values (new.id, coalesce(new.email, ''))
  on conflict (user_id) do nothing;
  if not exists (select 1 from public.membros where user_id = new.id)
     and not exists (
       select 1 from public.convites c
       where c.email = lower(btrim(coalesce(new.email, ''))) and c.aceito_em is null and c.expira_em > now()
     ) then
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
-- Ler: qualquer membro da organização dona da linha. Escrever: conforme o papel (tabela de
-- permissões no GLOSSARY.md, espelhada em web/src/domain/permissoes.ts).
-- Configurações: cada pessoa só a própria. O n8n usa a chave service_role, que ignora o RLS.
alter table public.configuracoes             enable row level security;
alter table public.monitoramentos            enable row level security;
alter table public.feriados_organizacao      enable row level security;
alter table public.configuracoes_organizacao enable row level security;
alter table public.prazos                    enable row level security;
alter table public.execucoes                 enable row level security;
alter table public.organizacoes              enable row level security;
alter table public.membros                   enable row level security;
alter table public.buscas_agora              enable row level security;
alter table public.convites                  enable row level security;

drop policy if exists "dono_do_registro" on public.configuracoes;
create policy "dono_do_registro" on public.configuracoes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['monitoramentos', 'feriados_organizacao', 'configuracoes_organizacao', 'prazos', 'execucoes'] loop
    execute format('drop policy if exists "dono_do_registro" on public.%I', t);
    execute format('drop policy if exists "membro_da_organizacao" on public.%I', t);
    execute format('drop policy if exists "membro_le" on public.%I', t);
    execute format($p$create policy "membro_le" on public.%I
      for select to authenticated using (public.membro_de(organizacao_id))$p$, t);
  end loop;
end $$;

-- Escrita por papel: (tabela, nome da política, comando, papéis).
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('prazos', 'cria_prazo', 'insert', array['administrador', 'advogado', 'assistente']),
      ('prazos', 'edita_prazo', 'update', array['administrador', 'advogado', 'assistente']),
      ('prazos', 'exclui_prazo', 'delete', array['administrador', 'advogado']),
      ('monitoramentos', 'cria_monitoramento', 'insert', array['administrador', 'advogado']),
      ('monitoramentos', 'edita_monitoramento', 'update', array['administrador', 'advogado']),
      ('monitoramentos', 'exclui_monitoramento', 'delete', array['administrador', 'advogado']),
      ('feriados_organizacao', 'cria_feriado', 'insert', array['administrador']),
      ('feriados_organizacao', 'edita_feriado', 'update', array['administrador']),
      ('feriados_organizacao', 'exclui_feriado', 'delete', array['administrador']),
      ('configuracoes_organizacao', 'edita_configuracao', 'update', array['administrador'])
    ) as p (tabela, nome, comando, papeis)
  loop
    execute format('drop policy if exists %I on public.%I', r.nome, r.tabela);
    if r.comando = 'insert' then
      execute format('create policy %I on public.%I for insert to authenticated
        with check (public.tem_papel(organizacao_id, %L))', r.nome, r.tabela, r.papeis);
    elsif r.comando = 'update' then
      execute format('create policy %I on public.%I for update to authenticated
        using (public.tem_papel(organizacao_id, %L)) with check (public.tem_papel(organizacao_id, %L))',
        r.nome, r.tabela, r.papeis, r.papeis);
    else
      execute format('create policy %I on public.%I for delete to authenticated
        using (public.tem_papel(organizacao_id, %L))', r.nome, r.tabela, r.papeis);
    end if;
  end loop;
end $$;

-- Convites: só o Administrador vê; criar, reenviar, cancelar e aceitar passam pelas funções.
drop policy if exists "administrador_le" on public.convites;
create policy "administrador_le" on public.convites
  for select to authenticated using (public.tem_papel(organizacao_id, array['administrador']));

-- Organização e equipe: leitura para os membros; mudanças na equipe passam pelas funções.
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
  foreach t in array array['configuracoes', 'monitoramentos', 'feriados_organizacao', 'configuracoes_organizacao',
                           'prazos', 'execucoes', 'organizacoes', 'membros', 'buscas_agora', 'convites'] loop
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
  foreach t in array array['monitoramentos', 'feriados_organizacao', 'configuracoes_organizacao', 'prazos'] loop
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
  if public.tem_papel(org, array['leitura']) and not public.is_dev() then
    raise exception 'O papel Leitura não dispara buscas.' using errcode = '42501';
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

-- Desfaz o registro quando o robô recusa o disparo (só o próprio autor, logo em seguida, e
-- só se o robô ainda não o aceitou).
create or replace function public.cancelar_busca_agora(busca bigint) returns void
language sql security definer set search_path = '' as $$
  delete from public.buscas_agora
  where id = busca and user_id = auth.uid() and criado_em > now() - interval '5 minutes'
    and processada_em is null
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

-- ============================ equipe e papéis ============================
-- Fase 3 (#18): configurações da organização, permissões por papel, convites e saída de membro.

-- Toda organização nova nasce com as configurações padrão do robô.
create or replace function public.criar_configuracao_organizacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.configuracoes_organizacao (organizacao_id) values (new.id)
  on conflict (organizacao_id) do nothing;
  return null;
end $$;

drop trigger if exists criar_configuracao_organizacao on public.organizacoes;
create trigger criar_configuracao_organizacao after insert on public.organizacoes
  for each row execute function public.criar_configuracao_organizacao();

-- Migração (fase 3): cada organização herda as configurações do Administrador mais antigo,
-- inclusive o token. Na fase 4 essas colunas saem da configuração pessoal.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'configuracoes' and column_name = 'webhook_token'
  ) then
    execute $m$
      insert into public.configuracoes_organizacao
        (organizacao_id, dias_retroativos, prazo_padrao_dias, considerar_recesso, webhook_token)
      select
        x.id, x.dias_retroativos, x.prazo_padrao_dias, x.considerar_recesso,
        case when x.webhook_token is null or x.repeticao > 1
          then replace(gen_random_uuid()::text, '-', '') else x.webhook_token end
      from (
        select o.id,
          coalesce(c.dias_retroativos, 5) as dias_retroativos,
          coalesce(c.prazo_padrao_dias, 15) as prazo_padrao_dias,
          coalesce(c.considerar_recesso, true) as considerar_recesso,
          c.webhook_token,
          row_number() over (partition by c.webhook_token order by o.criado_em, o.id) as repeticao
        from public.organizacoes o
        left join lateral (
          select cfg.* from public.membros m join public.configuracoes cfg on cfg.user_id = m.user_id
          where m.organizacao_id = o.id
          order by (m.papel = 'administrador') desc, m.criado_em, m.user_id limit 1
        ) c on true
        where not exists (select 1 from public.configuracoes_organizacao co where co.organizacao_id = o.id)
      ) x
      on conflict (organizacao_id) do nothing
    $m$;
  end if;
end $$;
insert into public.configuracoes_organizacao (organizacao_id)
select o.id from public.organizacoes o
on conflict (organizacao_id) do nothing;

-- Fase 4 (#19): o robô lê a organização direto; a cópia em cada membro deixa de existir.
drop trigger if exists sincronizar_configuracao on public.configuracoes_organizacao;
drop trigger if exists sincronizar_configuracao on public.membros;
drop trigger if exists sincronizar_configuracao on public.monitoramentos;
drop trigger if exists sincronizar_configuracao on public.configuracoes;
drop trigger if exists proteger_configuracao_pessoal on public.configuracoes;
drop function if exists public.sincronizar_por_gatilho();
drop function if exists public.sincronizar_configuracao(uuid);
drop function if exists public.proteger_configuracao_pessoal();
drop function if exists public.organizacao_do_robo(uuid);
alter table public.configuracoes
  drop column if exists dias_retroativos,
  drop column if exists prazo_padrao_dias,
  drop column if exists considerar_recesso,
  drop column if exists webhook_token,
  drop column if exists ultima_busca_em;

-- Monitoramentos por papel. Vale para o que a pessoa faz direto (os ajustes automáticos,
-- feitos dentro de outros gatilhos, seguem as próprias regras).
create or replace function public.reforcar_papeis_monitoramentos() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  eu   uuid := auth.uid();
  org  uuid;
  meu  text;
  dono text;
begin
  if tg_op = 'DELETE' then
    org := old.organizacao_id;
  else
    org := new.organizacao_id;
  end if;
  if eu is null or pg_trigger_depth() > 1 or public.is_dev() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  select m.papel into meu from public.membros m where m.organizacao_id = org and m.user_id = eu;
  if meu is null or meu not in ('administrador', 'advogado') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if meu = 'advogado' then
    if tg_op <> 'INSERT' then
      if old.tipo = 'oab' and old.user_id <> eu then
        raise exception 'Advogados só alteram a própria OAB.' using errcode = '42501';
      end if;
    end if;
    if tg_op <> 'DELETE' then
      if new.tipo = 'oab' and new.user_id <> eu then
        raise exception 'Advogados só alteram a própria OAB.' using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  if not new.ativo then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.ativo and old.user_id = new.user_id and old.tipo = new.tipo then
      return new;
    end if;
  end if;

  select m.papel into dono from public.membros m where m.organizacao_id = org and m.user_id = new.user_id;
  if dono is null or dono not in ('administrador', 'advogado') then
    raise exception 'O monitoramento precisa pertencer a um Administrador ou Advogado da equipe.'
      using errcode = 'P0001';
  end if;
  if new.tipo = 'oab' and public.limites_de(org) ->> 'oabs' = 'por_advogado' then
    if exists (
      select 1 from public.monitoramentos x
      where x.organizacao_id = org and x.user_id = new.user_id and x.tipo = 'oab' and x.ativo and x.id <> new.id
    ) then
      raise exception 'Cada advogado pode ter uma OAB monitorada ativa neste plano.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists reforcar_papeis on public.monitoramentos;
create trigger reforcar_papeis before insert or update or delete on public.monitoramentos
  for each row execute function public.reforcar_papeis_monitoramentos();

-- O responsável por um prazo é sempre alguém da equipe (o robô grava o próprio advogado).
create or replace function public.validar_responsavel() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or new.responsavel_id is null
     or not (public.membro_de(new.organizacao_id) or public.is_dev()) then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.responsavel_id is not distinct from old.responsavel_id then
      return new;
    end if;
  end if;
  if not exists (
    select 1 from public.membros m where m.organizacao_id = new.organizacao_id and m.user_id = new.responsavel_id
  ) then
    raise exception 'O responsável precisa fazer parte da equipe.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists validar_responsavel on public.prazos;
create trigger validar_responsavel before insert or update of responsavel_id on public.prazos
  for each row execute function public.validar_responsavel();

-- Sempre sobra ao menos um Administrador (a exclusão da conta pelo dev ou pelo sistema passa).
create or replace function public.proteger_administrador() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.papel = 'administrador' and auth.uid() is not null and not public.is_dev() then
    if tg_op = 'DELETE' or new.papel <> 'administrador' then
      if not exists (
        select 1 from public.membros m
        where m.organizacao_id = old.organizacao_id and m.papel = 'administrador' and m.user_id <> old.user_id
      ) then
        raise exception 'A organização precisa de pelo menos um Administrador.' using errcode = 'P0001';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists proteger_administrador on public.membros;
create trigger proteger_administrador before update of papel or delete on public.membros
  for each row execute function public.proteger_administrador();

-- Quem deixa de ser Administrador/Advogado ou sai da equipe para de ter OAB monitorada.
-- Na saída, os prazos em aberto dele e os processos avulsos passam para um Administrador
-- (quem removeu, ou o mais antigo); os prazos continuam na organização.
create or replace function public.ao_mudar_membro() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  admin uuid;
begin
  if tg_op = 'UPDATE' then
    if new.papel not in ('administrador', 'advogado') then
      update public.monitoramentos set ativo = false
      where organizacao_id = new.organizacao_id and user_id = new.user_id and tipo = 'oab' and ativo;
    end if;
    return null;
  end if;

  update public.monitoramentos set ativo = false
  where organizacao_id = old.organizacao_id and user_id = old.user_id and tipo = 'oab' and ativo;

  select m.user_id into admin from public.membros m
  where m.organizacao_id = old.organizacao_id and m.papel = 'administrador'
  order by (m.user_id = auth.uid()) desc, m.criado_em, m.user_id
  limit 1;
  if admin is null then
    return null;
  end if;

  update public.prazos set responsavel_id = admin
  where organizacao_id = old.organizacao_id and responsavel_id = old.user_id
    and status in ('pendente', 'conferir');

  update public.monitoramentos set user_id = admin
  where organizacao_id = old.organizacao_id and user_id = old.user_id and tipo = 'processo';
  return null;
end $$;

drop trigger if exists ao_mudar_membro on public.membros;
create trigger ao_mudar_membro after update of papel or delete on public.membros
  for each row execute function public.ao_mudar_membro();

-- Equipe com e-mail (para mostrar nomes e escolher responsável): qualquer membro.
create or replace function public.membros_da_organizacao(org uuid)
returns table (user_id uuid, email text, papel text, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.membro_de(org) or public.is_dev()) then
    raise exception 'Você não faz parte desta organização.' using errcode = '42501';
  end if;
  return query
  select m.user_id, u.email::text, m.papel, m.criado_em
  from public.membros m join auth.users u on u.id = m.user_id
  where m.organizacao_id = org
  order by m.criado_em, m.user_id;
end $$;

create or replace function public.exigir_administrador(org uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (public.tem_papel(org, array['administrador']) or public.is_dev()) then
    raise exception 'Só o Administrador da organização gerencia a equipe.' using errcode = '42501';
  end if;
end $$;

create or replace function public.exigir_escrita(org uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.etapa_de(org) in ('leitura', 'suspensa') then
    raise exception 'Somente leitura: o período de uso desta organização terminou. Fale com o suporte para reativar.'
      using errcode = '42501';
  end if;
end $$;

-- Vagas ocupadas = membros + convites pendentes ainda válidos (sem contar `exceto`).
create or replace function public.vagas_ocupadas(org uuid, exceto uuid default null) returns int
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.membros where organizacao_id = org)::int
       + (select count(*) from public.convites
          where organizacao_id = org and aceito_em is null and expira_em > now()
            and id is distinct from exceto)::int
$$;

create or replace function public.convidar(org uuid, email_convidado text, papel_convidado text)
returns public.convites
language plpgsql security definer set search_path = '' as $$
declare
  e    text := lower(btrim(coalesce(email_convidado, '')));
  l    jsonb;
  novo public.convites;
begin
  perform public.exigir_administrador(org);
  if e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Informe um e-mail válido.' using errcode = 'P0001';
  end if;
  if papel_convidado is null or papel_convidado not in ('administrador', 'advogado', 'assistente', 'leitura') then
    raise exception 'Papel inválido.' using errcode = 'P0001';
  end if;
  perform 1 from public.organizacoes where id = org for update;
  perform public.exigir_escrita(org);
  l := public.limites_de(org);
  if papel_convidado <> 'administrador' and not (l ->> 'papeis')::boolean then
    raise exception 'O plano desta organização não tem papéis além do Administrador.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.membros m join auth.users u on u.id = m.user_id
    where m.organizacao_id = org and lower(u.email) = e
  ) then
    raise exception 'Essa pessoa já faz parte da equipe.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.convites c
    where c.organizacao_id = org and c.email = e and c.aceito_em is null and c.expira_em > now()
  ) then
    raise exception 'Já existe um convite pendente para esse e-mail: reenvie ou cancele o atual.' using errcode = 'P0001';
  end if;
  delete from public.convites c where c.organizacao_id = org and c.email = e and c.aceito_em is null;
  if public.vagas_ocupadas(org) >= (l ->> 'usuarios')::int then
    raise exception 'Limite de usuários atingido (%): equipe e convites pendentes já ocupam todas as vagas do plano.',
      l ->> 'usuarios' using errcode = 'P0001';
  end if;
  insert into public.convites (organizacao_id, email, papel, criado_por)
  values (org, e, papel_convidado, auth.uid())
  returning * into novo;
  return novo;
end $$;

-- Reenviar renova a validade e põe o e-mail de novo na fila do robô (o link continua o mesmo).
create or replace function public.reenviar_convite(convite uuid) returns public.convites
language plpgsql security definer set search_path = '' as $$
declare
  c public.convites;
begin
  select * into c from public.convites where id = convite;
  if not found then
    raise exception 'Convite não encontrado.' using errcode = 'P0001';
  end if;
  perform public.exigir_administrador(c.organizacao_id);
  if c.aceito_em is not null then
    raise exception 'Este convite já foi aceito.' using errcode = 'P0001';
  end if;
  perform 1 from public.organizacoes where id = c.organizacao_id for update;
  perform public.exigir_escrita(c.organizacao_id);
  if public.vagas_ocupadas(c.organizacao_id, c.id) >= (public.limites_de(c.organizacao_id) ->> 'usuarios')::int then
    raise exception 'Limite de usuários atingido (%): equipe e convites pendentes já ocupam todas as vagas do plano.',
      public.limites_de(c.organizacao_id) ->> 'usuarios' using errcode = 'P0001';
  end if;
  update public.convites set expira_em = now() + interval '7 days', enviado_em = null
  where id = c.id returning * into c;
  return c;
end $$;

create or replace function public.cancelar_convite(convite uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  org uuid;
begin
  select organizacao_id into org from public.convites where id = convite;
  if org is null then
    return;
  end if;
  perform public.exigir_administrador(org);
  delete from public.convites where id = convite and aceito_em is null;
end $$;

-- Dados para a página do convite (antes de entrar): só quem tem o link.
create or replace function public.ver_convite(codigo text)
returns table (organizacao text, papel text, email text, situacao text)
language sql stable security definer set search_path = '' as $$
  select o.nome, c.papel, c.email,
    case when c.aceito_em is not null then 'aceito'
         when c.expira_em <= now() then 'expirado'
         else 'pendente' end
  from public.convites c join public.organizacoes o on o.id = c.organizacao_id
  where c.token = codigo
$$;

create or replace function public.aceitar_convite(codigo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c          public.convites;
  meu_email  text;
  confirmado timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para aceitar o convite.' using errcode = '42501';
  end if;
  select * into c from public.convites where token = codigo for update;
  if not found then
    raise exception 'Convite não encontrado. Peça um novo ao Administrador.' using errcode = 'P0001';
  end if;
  select lower(u.email), u.email_confirmed_at into meu_email, confirmado from auth.users u where u.id = auth.uid();
  if meu_email is distinct from c.email then
    raise exception 'Este convite foi enviado para %. Entre com essa conta para aceitar.', c.email using errcode = 'P0001';
  end if;
  if confirmado is null then
    raise exception 'Confirme seu e-mail antes de aceitar o convite.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.membros m where m.organizacao_id = c.organizacao_id and m.user_id = auth.uid()) then
    update public.convites set aceito_em = coalesce(aceito_em, now()) where id = c.id;
    return c.organizacao_id;
  end if;
  if c.aceito_em is not null then
    raise exception 'Este convite já foi usado.' using errcode = 'P0001';
  end if;
  if c.expira_em <= now() then
    raise exception 'Este convite expirou. Peça um novo ao Administrador.' using errcode = 'P0001';
  end if;
  insert into public.membros (organizacao_id, user_id, papel) values (c.organizacao_id, auth.uid(), c.papel);
  update public.convites set aceito_em = now() where id = c.id;
  return c.organizacao_id;
end $$;

create or replace function public.alterar_papel(org uuid, membro uuid, novo_papel text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_administrador(org);
  if novo_papel is null or novo_papel not in ('administrador', 'advogado', 'assistente', 'leitura') then
    raise exception 'Papel inválido.' using errcode = 'P0001';
  end if;
  update public.membros set papel = novo_papel where organizacao_id = org and user_id = membro;
  if not found then
    raise exception 'Essa pessoa não faz parte da equipe.' using errcode = 'P0001';
  end if;
end $$;

create or replace function public.remover_membro(org uuid, membro uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_administrador(org);
  if membro = auth.uid() then
    raise exception 'Você não pode remover a si mesmo da equipe.' using errcode = 'P0001';
  end if;
  perform public.exigir_escrita(org);
  delete from public.membros where organizacao_id = org and user_id = membro;
  if not found then
    raise exception 'Essa pessoa não faz parte da equipe.' using errcode = 'P0001';
  end if;
end $$;

-- Painel dev: novo token do Buscar agora para a organização (a mais antiga) da conta.
create or replace function public.admin_trocar_token(conta uuid, token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_dev() then
    raise exception 'Acesso restrito ao dev.' using errcode = '42501';
  end if;
  update public.configuracoes_organizacao set webhook_token = token, updated_at = now()
  where organizacao_id = public.organizacao_de(conta);
  if not found then
    raise exception 'Esta conta não pertence a nenhuma organização.' using errcode = 'P0001';
  end if;
end $$;

revoke all on function public.exigir_administrador(uuid) from public, anon, authenticated;
revoke all on function public.exigir_escrita(uuid) from public, anon, authenticated;
revoke all on function public.vagas_ocupadas(uuid, uuid) from public, anon, authenticated;
revoke all on function public.membros_da_organizacao(uuid) from public, anon;
revoke all on function public.convidar(uuid, text, text) from public, anon;
revoke all on function public.reenviar_convite(uuid) from public, anon;
revoke all on function public.cancelar_convite(uuid) from public, anon;
revoke all on function public.ver_convite(text) from public;
revoke all on function public.aceitar_convite(text) from public, anon;
revoke all on function public.alterar_papel(uuid, uuid, text) from public, anon;
revoke all on function public.remover_membro(uuid, uuid) from public, anon;
revoke all on function public.admin_trocar_token(uuid, text) from public, anon;
grant execute on function public.membros_da_organizacao(uuid) to authenticated;
grant execute on function public.convidar(uuid, text, text) to authenticated;
grant execute on function public.reenviar_convite(uuid) to authenticated;
grant execute on function public.cancelar_convite(uuid) to authenticated;
grant execute on function public.ver_convite(text) to anon, authenticated;
grant execute on function public.aceitar_convite(text) to authenticated;
grant execute on function public.alterar_papel(uuid, uuid, text) to authenticated;
grant execute on function public.remover_membro(uuid, uuid) to authenticated;
grant execute on function public.admin_trocar_token(uuid, text) to authenticated;

-- ============================ robô por organização ============================
-- Fase 4 (#19). O n8n (service_role) só consulta o DJEN, calcula o vencimento e manda os
-- e-mails; quem buscar, quem é o responsável e o que cada membro recebe é decidido aqui.

-- OAB comparável entre o cadastro e o DJEN: só dígitos, sem zeros à esquerda, e a UF.
create or replace function public.oab_normalizada(numero text, uf text) returns text
language sql immutable set search_path = '' as $$
  select nullif(ltrim(regexp_replace(coalesce(numero, ''), '\D', '', 'g'), '0'), '')
    || '/' || nullif(upper(btrim(coalesce(uf, ''))), '')
$$;

-- Organizações a buscar agora, com configurações, feriados e monitoramentos ativos.
--   agendado: todas (turno '12' = só as com 2 buscas automáticas no plano); manual: todas;
--   site: só a dona do token, e só se houver um Buscar agora registrado (pelo site, que já
--   conferiu intervalo e cota) nos últimos 5 minutos e ainda não aceito — cada um vale uma busca.
-- Organização suspensa (depois da carência) não é buscada.
create or replace function public.robo_lote(origem text, turno text default null, token text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  alvo  uuid;
  autor uuid;
begin
  if robo_lote.origem = 'site' then
    select c.organizacao_id into alvo from public.configuracoes_organizacao c
    where c.webhook_token = coalesce(robo_lote.token, '');
    if alvo is null then
      return '[]'::jsonb;
    end if;
    update public.buscas_agora b set processada_em = now()
    where b.id = (
      select x.id from public.buscas_agora x
      where x.organizacao_id = alvo and x.processada_em is null and x.criado_em > now() - interval '5 minutes'
      order by x.criado_em desc limit 1
      for update skip locked
    )
    returning b.user_id into autor;
    if not found then
      return '[]'::jsonb;
    end if;
  elsif robo_lote.origem is null or robo_lote.origem not in ('agendado', 'manual') then
    raise exception 'Origem inválida: %', robo_lote.origem using errcode = 'P0001';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'organizacao_id', o.id,
      'nome', o.nome,
      'etapa', o.etapa,
      'origem', robo_lote.origem,
      'autor', autor,
      'dias_retroativos', c.dias_retroativos,
      'prazo_padrao_dias', c.prazo_padrao_dias,
      'considerar_recesso', c.considerar_recesso,
      'feriados', coalesce((
        select jsonb_agg(f.data order by f.data) from public.feriados_organizacao f where f.organizacao_id = o.id
      ), '[]'::jsonb),
      'monitoramentos', m.lista
    ) order by o.criado_em, o.id)
    from (
      select x.id, x.nome, x.criado_em, public.etapa_de(x.id) as etapa
      from public.organizacoes x
      where alvo is null or x.id = alvo
    ) o
    join public.configuracoes_organizacao c on c.organizacao_id = o.id
    cross join lateral (
      select jsonb_agg(distinct case when mo.tipo = 'oab'
        then jsonb_build_object('tipo', 'oab', 'numero', regexp_replace(mo.oab_numero, '\D', '', 'g'),
                                'uf', upper(mo.oab_uf))
        else jsonb_build_object('tipo', 'processo', 'numero', regexp_replace(mo.numero_processo, '\D', '', 'g'))
      end) as lista
      from public.monitoramentos mo
      where mo.organizacao_id = o.id and mo.ativo
        and case when mo.tipo = 'oab'
          then regexp_replace(mo.oab_numero, '\D', '', 'g') <> '' and length(btrim(mo.oab_uf)) = 2
          else length(regexp_replace(mo.numero_processo, '\D', '', 'g')) = 20
        end
    ) m
    where o.etapa <> 'suspensa'
      and m.lista is not null
      and (robo_lote.origem <> 'agendado' or robo_lote.turno is distinct from '12'
           or (public.limites_de(o.id) ->> 'buscas_automaticas')::int >= 2)
  ), '[]'::jsonb);
end $$;

-- Grava as publicações da organização (um prazo por publicação) e devolve os ids novos.
-- Responsável: o dono da primeira OAB da casa listada na publicação (as demais ficam em
-- tambem_intimados); sem OAB, quem cadastrou o processo avulso; sem nenhum, o Administrador.
create or replace function public.robo_gravar_prazos(org uuid, publicacoes jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p         jsonb;
  adm       uuid;
  intimados uuid[];
  resp      uuid;
  novo      uuid;
  ids       uuid[] := '{}';
begin
  select m.user_id into adm from public.membros m
  where m.organizacao_id = org and m.papel = 'administrador'
  order by m.criado_em, m.user_id limit 1;
  if adm is null then
    raise exception 'Organização sem Administrador: %', org using errcode = 'P0001';
  end if;

  for p in select value from jsonb_array_elements(coalesce(publicacoes, '[]'::jsonb)) loop
    continue when coalesce(p ->> 'djen_id', '') = '';

    select coalesce(array_agg(x.user_id order by x.ordem), '{}') into intimados
    from (
      select distinct on (mo.user_id) mo.user_id, a.ordem
      from jsonb_array_elements(coalesce(p -> 'advogados', '[]'::jsonb)) with ordinality as a (adv, ordem)
      join public.monitoramentos mo
        on mo.organizacao_id = org and mo.tipo = 'oab' and mo.ativo
       and public.oab_normalizada(mo.oab_numero, mo.oab_uf) = public.oab_normalizada(a.adv ->> 'numero', a.adv ->> 'uf')
      join public.membros me on me.organizacao_id = org and me.user_id = mo.user_id
      order by mo.user_id, a.ordem
    ) x;

    resp := intimados[1];
    if resp is null then
      select mo.user_id into resp
      from public.monitoramentos mo
      join public.membros me on me.organizacao_id = org and me.user_id = mo.user_id
      where mo.organizacao_id = org and mo.tipo = 'processo' and mo.ativo
        and regexp_replace(mo.numero_processo, '\D', '', 'g')
            = regexp_replace(coalesce(p ->> 'numero_processo', ''), '\D', '', 'g')
      order by mo.created_at, mo.id limit 1;
    end if;
    resp := coalesce(resp, adm);

    novo := null;
    insert into public.prazos (
      organizacao_id, user_id, responsavel_id, tambem_intimados, djen_id, processo, tribunal, orgao, tipo,
      classe, partes, prazo_dias, origem_prazo, data_disponibilizacao, data_publicacao, inicio_prazo,
      vencimento, status, link, teor
    ) values (
      org, resp, resp, coalesce(intimados[2:], '{}'), p ->> 'djen_id', p ->> 'processo', p ->> 'tribunal',
      p ->> 'orgao', p ->> 'tipo', p ->> 'classe', p ->> 'partes', (p ->> 'prazo_dias')::int, p ->> 'origem_prazo',
      (p ->> 'data_disponibilizacao')::date, (p ->> 'data_publicacao')::date, (p ->> 'inicio_prazo')::date,
      (p ->> 'vencimento')::date,
      case when p ->> 'status' = 'pendente' then 'pendente' else 'conferir' end,
      p ->> 'link', p ->> 'teor'
    )
    on conflict (organizacao_id, djen_id) do nothing
    returning id into novo;
    if novo is not null then
      ids := ids || novo;
    end if;
  end loop;

  return jsonb_build_object('novas', cardinality(ids), 'ids', to_jsonb(ids));
end $$;

-- Prazo como aparece no e-mail do resumo.
create or replace function public.robo_prazo_no_resumo(p public.prazos) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'processo', p.processo, 'tribunal', p.tribunal, 'orgao', p.orgao, 'tipo', p.tipo,
    'vencimento', p.vencimento, 'prazo_dias', p.prazo_dias, 'origem_prazo', p.origem_prazo,
    'status', p.status, 'link', p.link, 'trecho', left(coalesce(p.teor, ''), 300),
    'responsavel', (select u.email::text from auth.users u where u.id = p.responsavel_id)
  )
$$;

-- Registra a execução e devolve o resumo de cada membro com e-mail válido: prazos em alerta
-- (vencidos há até 30 dias e os da janela de cada um) e publicações novas, só os próprios
-- ("meus": responsável ou também intimado) ou de todos, conforme a preferência (padrão: Advogado "meus", demais "todos").
-- Inclui a etapa e as datas da carência para o aviso ao Administrador.
create or replace function public.robo_concluir(
  org uuid, origem text, autor uuid, encontradas int, novas jsonb, falhou boolean, detalhe text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  ids   uuid[];
  o     public.organizacoes;
  s     public.configuracao_sistema;
  etapa text := public.etapa_de(org);
  fim   date;
begin
  select * into o from public.organizacoes where id = org;
  if not found then
    raise exception 'Organização não encontrada: %', org using errcode = 'P0001';
  end if;
  select * into s from public.configuracao_sistema where id = 1;
  select coalesce(array_agg(v::uuid), '{}') into ids
  from jsonb_array_elements_text(coalesce(robo_concluir.novas, '[]'::jsonb)) as v;

  insert into public.execucoes (organizacao_id, user_id, origem, encontradas, novas, status, detalhe)
  values (
    org, robo_concluir.autor, robo_concluir.origem, coalesce(robo_concluir.encontradas, 0), cardinality(ids),
    case when robo_concluir.falhou then 'falha' else 'ok' end,
    nullif(left(coalesce(robo_concluir.detalhe, ''), 2000), '')
  );

  if o.situacao = 'ativa' then
    fim := o.pago_ate;
  else
    fim := (coalesce(o.teste_iniciado_em, o.criado_em) at time zone 'America/Sao_Paulo')::date + s.dias_teste - 1;
  end if;

  return jsonb_build_object(
    'organizacao', o.nome,
    'etapa', etapa,
    'leitura_em', case when fim is null then null else fim + s.carencia_aviso_dias + 1 end,
    'suspensa_em', case when fim is null then null else fim + s.carencia_total_dias + 1 end,
    'destinatarios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', d.user_id,
        'email', d.email,
        'papel', d.papel,
        'escopo', d.escopo,
        'dias_alerta', d.dias_alerta,
        'alertas', coalesce((
          select jsonb_agg(public.robo_prazo_no_resumo(p) order by p.vencimento, p.processo)
          from public.prazos p
          where p.organizacao_id = org and p.status in ('pendente', 'conferir')
            and p.vencimento between hoje - 30 and hoje + d.dias_alerta
            and (d.escopo = 'todos' or p.responsavel_id = d.user_id or d.user_id = any (p.tambem_intimados))
        ), '[]'::jsonb),
        'novas', coalesce((
          select jsonb_agg(public.robo_prazo_no_resumo(p) order by p.vencimento nulls last, p.processo)
          from public.prazos p
          where p.organizacao_id = org and p.id = any (ids)
            and (d.escopo = 'todos' or p.responsavel_id = d.user_id or d.user_id = any (p.tambem_intimados))
        ), '[]'::jsonb)
      ) order by d.criado_em, d.user_id)
      from (
        select m.user_id, m.papel, m.criado_em, btrim(c.email_destino) as email, c.dias_alerta,
          coalesce(c.resumo_escopo, case when m.papel = 'advogado' then 'meus' else 'todos' end) as escopo
        from public.membros m
        join public.configuracoes c on c.user_id = m.user_id
        where m.organizacao_id = org
          and btrim(c.email_destino) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      ) d
    ), '[]'::jsonb)
  );
end $$;

-- Convites cujo e-mail ainda não saiu (o robô manda e marca como enviado).
create or replace function public.robo_convites_pendentes() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'email', c.email, 'papel', c.papel, 'token', c.token, 'expira_em', c.expira_em,
    'organizacao', o.nome, 'convidado_por', u.email::text
  ) order by c.criado_em), '[]'::jsonb)
  from public.convites c
  join public.organizacoes o on o.id = c.organizacao_id
  left join auth.users u on u.id = c.criado_por
  where c.aceito_em is null and c.expira_em > now() and c.enviado_em is null
$$;

create or replace function public.robo_marcar_convite_enviado(convite uuid) returns void
language sql security definer set search_path = '' as $$
  update public.convites set enviado_em = now()
  where id = convite and aceito_em is null and enviado_em is null
$$;

revoke all on function public.oab_normalizada(text, text) from public, anon, authenticated;
revoke all on function public.robo_lote(text, text, text) from public, anon, authenticated;
revoke all on function public.robo_gravar_prazos(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.robo_prazo_no_resumo(public.prazos) from public, anon, authenticated;
revoke all on function public.robo_concluir(uuid, text, uuid, int, jsonb, boolean, text) from public, anon, authenticated;
revoke all on function public.robo_convites_pendentes() from public, anon, authenticated;
revoke all on function public.robo_marcar_convite_enviado(uuid) from public, anon, authenticated;
grant execute on function public.oab_normalizada(text, text) to service_role;
grant execute on function public.robo_lote(text, text, text) to service_role;
grant execute on function public.robo_gravar_prazos(uuid, jsonb) to service_role;
grant execute on function public.robo_prazo_no_resumo(public.prazos) to service_role;
grant execute on function public.robo_concluir(uuid, text, uuid, int, jsonb, boolean, text) to service_role;
grant execute on function public.robo_convites_pendentes() to service_role;
grant execute on function public.robo_marcar_convite_enviado(uuid) to service_role;

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
  foreach t in array array['configuracoes', 'monitoramentos', 'feriados_organizacao', 'configuracoes_organizacao',
                           'prazos', 'configuracao_sistema', 'organizacoes', 'membros', 'convites'] loop
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
    where x.organizacao_id in (select m.organizacao_id from public.membros m where m.user_id = u.id)
    order by x.executado_em desc limit 1
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
