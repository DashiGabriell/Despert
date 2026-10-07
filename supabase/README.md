# Supabase — schema do Despert

Banco multitenant: cada advogado vê apenas os próprios dados, garantido por Row Level Security.

## Aplicar

1. Crie o projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor → New query**, cole o conteúdo de [`schema.sql`](./schema.sql) e clique em **Run**.
3. Em **Authentication → Providers → Email**, mantenha **Confirm email** ligado (signup aberto com confirmação).

O script é idempotente: rodar de novo não quebra nada. Ele cria as tabelas **já** com a coluna de dono (`user_id`) e as policies — se por algum motivo você tiver aplicado a versão antiga (sem dono), apague as tabelas antigas primeiro (`drop table public.prazos, public.monitoramentos, public.feriados, public.execucoes, public.configuracoes cascade;`) e rode de novo.

## O que nasce junto

- Toda conta nova recebe uma linha em `configuracoes` com o e-mail já como destino do resumo diário e um token de webhook gerado.
- `prazos`, `execucoes` ficam na publicação de tempo real (a aplicação assina).
- O n8n entra com a chave **service_role**, que ignora o RLS e grava com o `user_id` certo.

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
