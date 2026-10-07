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
4. No site: crie a conta, cadastre a OAB em **Monitoramento**, cole a Production URL do webhook em **Configurações** e clique em **Buscar agora**.
