# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Advogados brasileiros que respondem por prazos processuais. O público prioritário da landing page é o **advogado solo**: trabalha sozinho, recebe intimações de vários tribunais, confere o Diário de Justiça Eletrônico Nacional (DJEN) à mão ou com alertas soltos e carrega sozinho o risco de perder um prazo. Escritórios com equipe e departamentos jurídicos de empresa são públicos secundários, atendidos pelos planos Escritório e Corporativo.

## Product Purpose

O Despert existe para o advogado não perder prazo. Um robô lê o DJEN todo dia útil, identifica as publicações das OABs e processos monitorados, calcula o vencimento em dias úteis (feriados nacionais, feriados locais cadastrados e recesso forense) e grava o prazo. A aplicação mostra o que está em risco por urgência, uma agenda mensal com cada vencimento no seu dia, e manda um resumo diário por e-mail. Sucesso é o advogado confiar na lista do Despert em vez de conferir o Diário à mão.

## Positioning

Os serviços de alerta avisam que saiu uma publicação; os sistemas de gestão fazem tudo, e o prazo é um módulo entre muitos. O Despert faz uma coisa só, de ponta a ponta: da publicação no DJEN até a data de vencimento calculada, com sinalização "Para conferir" quando o texto não dá segurança. O preço se apoia em não perder prazo, não na quantidade de funcionalidades.

## Operating Context

- Fonte única: DJEN (comunicaapi.pje.jus.br), cobertura nacional.
- Buscas automáticas em dia útil (07:00 no Solo; 07:00 e 12:00 nos planos com equipe) e botão "Busca agora" com limite por plano.
- Resumo diário por e-mail depois da busca das 07:00, sempre enviado, mesmo sem nada na janela de alerta.
- Monitoramento por OAB com UF e por número de processo (processo avulso).
- Cadastro por autoatendimento em `/login` (criar conta), com teste grátis de 7 dias com os limites do Solo.

## Capabilities and Constraints

- Planos e preços mensais (ADR-0009), sem plano anual: Solo R$ 79,90 (1 usuário, 1 OAB, 10 processos avulsos); Escritório R$ 397,90 (2 a 10 usuários, papéis, auditoria e exportação); Corporativo R$ 849,90 (11 a 20 usuários). Acima de 20 usuários, negociado caso a caso. Limites completos no ADR-0008.
- Cobrança ainda manual (Pix ou boleto fora do app); não há checkout. O caminho de ação é criar conta e começar o teste.
- A landing page mora na própria web app, na rota `/`: visitante sem sessão vê a landing; quem já está logado vai direto para a aplicação.
- Vocabulário do produto em `GLOSSARY.md` (prazo, vencimento, dia útil, publicação, monitoramento, resumo diário). Evitar "deadline", "trial", "tenant".
- Stack existente: Vite, React, TypeScript, Tailwind CSS v4.
- Em aberto: contato comercial para Corporativo e acima de 20 usuários (não existe ainda).

## Brand Commitments

- Nome: Despert. Assinatura atual: "Monitor de prazos · DJEN".
- Marca: selo de lacre vinho com "D" dourado (`web/public/logo-despert-256.png`).
- Identidade existente no app: vinho, azul-marinho e dourado sobre papel claro; Cormorant Garamond nos títulos e Source Serif 4 no texto.
- Textos em pt-BR, tom direto e sóbrio, de colega de profissão.

## Evidence on Hand

- Logo: `web/public/logo-despert-256.png`, `web/public/logo-despert.png`.
- Ilustração de escritório (vinho, marinho, dourado): `web/public/bg-login-desktop.webp`, `web/public/bg-login-mobile.webp`.
- Não há depoimentos, clientes, logos de clientes nem números de uso. Nada disso pode ser inventado; telas e dados de demonstração devem ser rotulados como exemplo.

## Product Principles

1. O prazo é a unidade central: toda tela e toda frase servem a não perdê-lo.
2. Mostrar o mecanismo, não prometer: publicação no Diário, contagem em dias úteis, data de vencimento.
3. Honestidade sobre incerteza: quando o texto não dá segurança, o Despert sinaliza "Para conferir" em vez de chutar.
4. Nada se perde: nenhum dado é apagado por plano ou pagamento.
5. Simples para quem trabalha sozinho; a equipe é um acréscimo, não o ponto de partida.
