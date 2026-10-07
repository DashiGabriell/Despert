---
status: accepted
---

# Planos com limites ajustáveis pelo dev e cobrança manual

Cada organização tem um **plano** (Solo, Escritório ou Corporativo) que define os limites de uso. Planos e cobrança existem só no painel dev: o Administrador da organização não escolhe nem paga pelo app. No lançamento a cobrança é manual (Pix ou boleto enviado fora do app) e o dev libera o plano no painel; o plano dá os limites padrão e o dev pode sobrescrever qualquer um deles por organização, para negociações caso a caso.

## Limites padrão

| Limite | Solo | Escritório | Corporativo |
|---|---|---|---|
| Usuários | 1 | 2 a 10 | 11 a 20 |
| OABs monitoradas | 1 | 1 por advogado | 1 por advogado |
| Processos avulsos | 10 | 50 | 70 |
| Buscas automáticas por dia útil | 1 (07:00) | 2 (07:00 e 12:00) | 2 (07:00 e 12:00) |
| Intervalo mínimo do Busca agora | 30 min | 10 min | 10 min |
| Busca agora por dia, na organização inteira | 1 | 15 | 20 |
| Papéis além do Administrador | não | sim | sim |
| Auditoria e exportação | não | sim | sim |
| Histórico | ilimitado | ilimitado | ilimitado |

O contador do Busca agora zera à meia-noite de Brasília e não acumula. Acima de 20 usuários é sempre Corporativo com limite ajustado pelo dev.

## Considered Options

- **Cobrança manual + limites no app** (escolhido): valida preço e limites com clientes reais antes de integrar um gateway.
- **Assinatura automática desde o início (Asaas, Stripe)**: semanas de integração antes de saber se os limites fazem sentido.
- **Limites fixos por plano, sem ajuste**: toda negociação exigiria um plano novo no código.

## Regras que nunca mudam com o plano

- O que protege o prazo vale em todos os planos: captura das publicações, cálculo em dias úteis, alerta de vencimento e resumo diário.
- Nada é apagado por causa de plano ou de pagamento. Exclusão só a pedido do cliente (LGPD).

## Teste, inadimplência e mudança de plano

- Cadastro por autoatendimento: a organização nasce num **teste de 7 dias com os limites do Solo**. Para testar com equipe, o dev ajusta pelo painel.
- Inadimplência ou fim do teste, numa janela de 15 dias: dias 1 a 5 tudo funciona, com aviso ao Administrador; dias 6 a 15 somente leitura, com o robô ainda buscando e avisando; depois do dia 15 o robô para e a conta fica com leitura e exportação.
- Passando a ter mais do que o plano permite: o Administrador escolhe o que continua ativo; usuários excedentes viram Leitura e monitoramentos excedentes ficam pausados. Enquanto isso não for resolvido, nada novo pode ser adicionado.

## Consequences

- As regras de limite ficam num módulo puro e testado em `web/src/domain`, e são reforçadas no banco (para ninguém burlar pela API) e no n8n (frequência de busca por organização).
- Os prazos das etapas de carência são configuráveis no painel dev; os números acima são o padrão.
