# Supabase — schema do Despert

Banco multitenant: a **organização** (escritório ou departamento jurídico) é a dona dos dados — veja [ADR-0007](../docs/adr/0007-organizacao-e-o-tenant.md). Cada membro vê apenas os dados das organizações a que pertence, garantido por Row Level Security.

## Organizações e membros

- `organizacoes` é o tenant; `membros` liga uma conta a uma organização com um papel (`administrador`, `advogado`, `assistente`, `leitura`). Uma conta pode pertencer a várias.
- `monitoramentos`, `feriados`, `prazos` e `execucoes` têm `organizacao_id`; a policy `membro_da_organizacao` usa `public.membro_de(organizacao_id)`.
- `user_id` continua nas tabelas como autor. Se um insert vier só com `user_id` (como o n8n faz hoje), o gatilho `preencher_organizacao` completa `organizacao_id` com a organização mais antiga da conta — e, em `prazos`, `responsavel_id` com o próprio `user_id`.
- Toda conta nova ganha uma organização em período de teste com ela como administradora. Contas anteriores viraram organizações Solo ativas na migração.
- `configuracoes` continua por conta (a divisão entre configuração da organização e do membro vem na fase de equipe).

## Aplicar

1. Crie o projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor → New query**, cole o conteúdo de [`schema.sql`](./schema.sql) e clique em **Run**.
3. Em **Authentication → Providers → Email**, mantenha **Confirm email** ligado (signup aberto com confirmação).
4. Em **Authentication → URL Configuration**, coloque a URL do site (ex.: `https://despert.vercel.app`) em **Site URL** — é para lá que o link de confirmação leva.

> **E-mail de confirmação em produção:** o remetente padrão do Supabase só entrega para membros da organização e tem limite de poucos e-mails por hora. Para abrir o cadastro a outros advogados, configure um SMTP próprio em **Project Settings → Authentication → SMTP Settings** (Resend, Brevo, SES…). Sem SMTP, deixe **Confirm email** desligado só enquanto testa.

O script é idempotente: rodar de novo não quebra nada. Ele cria as tabelas **já** com a coluna de dono (`user_id`) e as policies — se por algum motivo você tiver aplicado a versão antiga (sem dono), apague as tabelas antigas primeiro (`drop table public.prazos, public.monitoramentos, public.feriados, public.execucoes, public.configuracoes cascade;`) e rode de novo.

## O que nasce junto

- Toda conta nova recebe uma linha em `configuracoes` com o e-mail já como destino do resumo diário e um token de webhook gerado.
- `configuracoes.ultima_busca_em` guarda o último "Buscar agora" — a aplicação libera um novo disparo a cada 10 minutos.
- `webhook_token` é único: o n8n identifica o advogado do "Buscar agora" por ele.
- `prazos`, `execucoes` ficam na publicação de tempo real (a aplicação assina).
- O n8n entra com a chave **service_role**, que ignora o RLS e grava com o `user_id` certo.

## Acesso dev

O papel fica em `auth.users.raw_app_meta_data.app_role = 'dev'` (só a `service_role` altera; o usuário não consegue se promover). O `schema.sql` já promove a conta `b09286ec-03fb-4025-a934-7dcb455e56c7` e cria:

- `public.is_dev()`, que lê o papel em `auth.users` (rebaixar ou bloquear vale na hora, sem esperar o token expirar);
- a policy `dev_acesso_total` em todas as tabelas dos advogados;
- `configuracao_sistema` (linha única com a URL do webhook do n8n: todos leem, só o dev altera);
- `auditoria` e o gatilho `auditar_dev()`, que registra toda escrita de um dev em dados de advogados;
- as funções `admin_listar_contas()` e `admin_metricas()` do painel.

Depois de rodar o `schema.sql`:

1. Publique a Edge Function que cria contas, redefine senhas, bloqueia, exclui e troca papéis:
   ```bash
   supabase functions deploy admin --project-ref <seu-projeto>
   ```
   Sem a CLI: **Edge Functions → Deploy a new function → Via Editor**, nome `admin`, cole [`functions/admin/index.ts`](./functions/admin/index.ts). Deixe **Verify JWT** ligado. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já vêm nos segredos padrão da função.
2. Recarregue o site com a conta dev: ele confere o papel no banco e abre `/dashitecnology`.
3. Para promover outra conta depois: painel dev → **Usuários → Gerenciar → Promover a dev** (ou o mesmo `update` do fim do `schema.sql` com outro id).

Se a URL do webhook estava salva por advogado (versão anterior), o `schema.sql` copia a mais recente para `configuracao_sistema` antes de remover a coluna antiga.

## Verificar o isolamento (teste automatizado)

[`tests/rls_organizacoes.sql`](./tests/rls_organizacoes.sql) assume a identidade de um membro da organização A e confirma que ele não lê, altera, exclui nem insere dados da organização B (a com mais prazos). Rode-o numa transação desfeita, para não deixar rastro:

```sql
begin;
-- cole aqui o conteúdo de tests/rls_organizacoes.sql
rollback;
```

Sem erro = isolamento ok. Qualquer vazamento interrompe com a mensagem do que A conseguiu fazer.

## Verificar o isolamento (2 contas)

1. Em **Authentication → Users → Add user**, crie `advogada1@exemplo.com` e `advogada2@exemplo.com` (com e-mail confirmado).
2. Abra a aplicação numa janela anônima, entre como a advogada 1 e cadastre um monitoramento.
3. Abra outra janela anônima, entre como a advogada 2: o monitoramento da advogada 1 **não pode aparecer**.
4. Repita para um prazo manual criado pela advogada 1.

Se a advogada 2 enxergar qualquer coisa da advogada 1, a policy não foi aplicada — confira se o `schema.sql` rodou sem erro.

## Tipos gerados para a aplicação

Com a [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase gen types typescript --project-id <seu-projeto> > web/src/lib/database.types.ts
```

Sem a CLI, use o arquivo de tipos versionado em `web/src/lib/database.types.ts` e ajuste-o quando o schema mudar.
