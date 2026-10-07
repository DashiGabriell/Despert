# Despert — Monitor de Prazos (DJEN)

Aplicação para advogados não perderem prazos processuais. O n8n consulta o Diário de Justiça Eletrônico Nacional, calcula vencimentos e grava no Supabase; a web app mostra prazos, agenda e resumo diário por e-mail.

## Stack

- `web/` — Vite, React, TypeScript (strict), Tailwind CSS, Vitest + Testing Library
- `supabase/` — schema e migrações SQL (RLS multitenant)
- `n8n/` — workflows JSON importáveis + README de instalação (n8n self-hosted na VPS)

## Comandos

Todos rodando a partir de `web/`:

```bash
npm install
npm run dev        # servidor de desenvolvimento
npm run build      # typecheck + build de produção
npm run test       # Vitest, uma execução
npm run test:watch # Vitest em modo watch
npm run lint       # ESLint
npm run typecheck  # tsc -b
```

Antes de considerar uma tarefa terminada: `npm run lint && npm run typecheck && npm run test` verdes.

## Convenções

- Respostas e código voltado ao usuário em **pt-BR** (textos de UI, commits em português são aceitos; identificadores em inglês).
- Identificadores e nomes de arquivo em inglês; textos de interface em pt-BR.
- Regras de negócio de prazo (dias úteis, urgência, filtros) ficam em módulos puros e testados — nunca dentro de componente React.
- A especificação de vocabulário é `GLOSSARY.md`; decisões arquiteturais ficam em `docs/adr/`. Contradiz um ADR? Declare na resposta, não silencie.
- Segredos nunca no repo: `.env` é ignorado, `.env.example` documenta o que falta preencher.

## Agent skills

### Issue tracker

Issues e specs vivem no GitHub Issues de `DashiGabriell/Despert`, operados via `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Vocabulário padrão de cinco labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` na raiz e `docs/adr/`. See `docs/agents/domain.md`.
