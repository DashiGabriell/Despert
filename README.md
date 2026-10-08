# Despert — Monitor de Prazos (DJEN)

Aplicação para advogados não perderem prazos processuais. O robô (n8n) lê o Diário de Justiça Eletrônico Nacional, calcula os vencimentos em dias úteis e grava no Supabase; o site mostra os prazos, a agenda do mês e o histórico, e o robô manda um resumo diário por e-mail.

```
 navegador ──► web (Vite + React, Vercel) ──► Supabase (Auth + Postgres + RLS + Realtime)
     │                                              ▲
     └── "Buscar agora" (GET + token) ──► n8n (VPS) ┘──► DJEN (comunicaapi.pje.jus.br)
                                              └──► Gmail (resumo diário / avisos de falha)
```

| Pasta | O quê | Como subir |
| --- | --- | --- |
| [`supabase/`](./supabase/README.md) | schema multitenant com RLS | rodar `schema.sql` no SQL Editor |
| [`web/`](./web/README.md) | aplicação (prazos, agenda, monitoramento, histórico, configurações) | Vercel |
| [`n8n/`](./n8n/README.md) | robô multitenant | importar o JSON no n8n da VPS |

Vocabulário em [`GLOSSARY.md`](./GLOSSARY.md); decisões em [`docs/adr/`](./docs/adr).

## Rodar localmente

```bash
cd web
cp .env.example .env   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev            # http://localhost:5173
```

Antes de entregar: `npm run lint && npm run typecheck && npm run test` (e `npm run build`).

## Deploy na Vercel

1. **Add New → Project**, importe este repositório.
2. **Root Directory**: `web` (framework Vite é detectado; `web/vercel.json` já faz o fallback das rotas para o `index.html`).
3. **Environment Variables**:
   - `VITE_SUPABASE_URL` — `https://<id-do-projeto>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` — a chave pública (*publishable*/`anon`). Nunca a `service_role`.
4. Deploy. Depois, no Supabase, coloque a URL da Vercel em **Authentication → URL Configuration → Site URL**.

## Ordem de instalação

1. Supabase: aplique o schema e configure a autenticação ([guia](./supabase/README.md)).
2. Vercel: publique o site com as duas variáveis acima.
3. n8n: importe o workflow, configure as credenciais e ative ([guia](./n8n/README.md)).
4. Supabase: publique a Edge Function `admin` e promova a conta dev ([guia](./supabase/README.md#acesso-dev)).
5. Como dev, em `/dashitecnology/n8n`: cole a Production URL do webhook, salve e clique em **Testar conexão**.
6. Como advogado: cadastre a OAB em **Monitoramento** e clique em **Buscar agora**.

## Acesso dev (`/dashitecnology`)

A conta dev controla a aplicação inteira e não é advogado: ao entrar, cai no painel `/dashitecnology/{modo}`.

| Modo | Para quê |
| --- | --- |
| `visao-geral` | métricas de todas as contas, estado do robô e últimas falhas |
| `usuarios` | criar contas, redefinir senha, promover/rebaixar dev, bloquear, excluir, trocar token, **entrar como** advogado |
| `dados` | ler prazos, monitoramentos, feriados, configuração e execuções de qualquer advogado |
| `execucoes` | todas as rodadas do robô, com filtros por status e conta |
| `n8n` | URL do webhook (exclusiva do dev), teste de conexão e disparo de busca por advogado |
| `auditoria` | tudo o que os devs fizeram e, nos planos com auditoria, as alterações feitas pelos membros |

Decisões em [ADR-0005](./docs/adr/0005-papel-dev-no-app-metadata.md) e [ADR-0006](./docs/adr/0006-url-do-webhook-global-e-exclusiva-do-dev.md).
