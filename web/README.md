# Despert — web

Aplicação da interface: Vite + React + TypeScript (strict) + Tailwind CSS + Vitest.

```bash
npm install
npm run dev        # desenvolvimento
npm run build      # typecheck + build
npm run test       # testes (uma execução)
npm run lint       # ESLint
npm run typecheck  # tsc -b
```

Copie `.env.example` para `.env` e preencha com a URL e a chave pública do Supabase.

Estrutura:

- `src/domain/` — regras puras de prazo (dias úteis, urgência, filtros, busca, edição, validação), testadas sem DOM
- `src/data/` — consultas e mutações do Supabase (TanStack Query) e assinatura de tempo real
- `src/lib/` — cliente Supabase, tipos do schema e contextos (sessão, avisos, layout)
- `src/pages/` — as telas (login, prazos, agenda, monitoramento, histórico, configurações)
- `src/components/` — peças compartilhadas

Deploy: Vercel com **Root Directory** `web` e as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (ver README da raiz).
