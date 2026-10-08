---
version: 1
slug: "web-src-pages-landing-tsx"
primary_target: "web/src/pages/Landing.tsx"
related_targets: []
---

# Landing page (`/`)

Scope: rota `/` da web app para visitante sem sessão. Mode: Persuade.
Audience: advogado solo que confere o DJEN à mão. Action: criar conta e começar o teste grátis de 7 dias (`/login?criar=1`).
Proof on hand: o próprio motor de cálculo (`domain/dias.ts`); nenhum depoimento, cliente ou número. Exemplos rotulados como exemplo.
Constraints: identidade existente (selo vinho, marinho, dourado, papel claro; Cormorant Garamond + Source Serif 4); preços do ADR-0009; nada de cara de SaaS genérico.

## Direction contract

THESIS: A agenda é a página. Recusa o topo padrão de título de um lado e print do produto do outro; o mecanismo (publicação no Diário, contagem em dias úteis, vencimento) acontece na grade que o advogado já usa.

OWN-WORLD: papel claro tingido, grade de agenda em linhas finas cor de linho, números de dia em Cormorant, vinho para a contagem e o selo de lacre, marinho para o texto, dourado para feriados. Fim de semana e feriado riscados como "não conta".

STORY: o visitante vê uma publicação do Diário cair no dia 1, a contagem andar até o vencimento pulando o feriado, entende que o Despert faz essa conta sozinho todo dia útil e começa o teste.

FIRST VIEWPORT: agenda de outubro de 2026 ocupando a largura; os quatro dias vazios antes do dia 1 viram o bloco do título, subtítulo e botão "Começar teste grátis"; seletor 5/10/15 dias úteis no cabeçalho do mês; selo de lacre carimba o vencimento. No celular, título acima e grade compacta abaixo.

FORM: estrutura 4 de 7 da lista ordenada (a agenda do mês); seed key 347bd674. Interação assinatura: a contagem anda célula a célula e o selo carimba o vencimento; troca de prazo recomeça a contagem.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
