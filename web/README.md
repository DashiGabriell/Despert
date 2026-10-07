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

- `src/domain/` — regras puras de prazo (dias úteis, urgência, filtros), testadas sem DOM
- `src/lib/` — cliente Supabase e tipos do schema
- `src/pages/` — as seis telas
- `src/components/` — peças compartilhadas
