---
status: accepted
---

# Contratação mensal pelo Checkout do Asaas

O Administrador contrata o plano dentro do Despert, em `/checkout`. O pagamento acontece na página hospedada pelo Asaas (Pix ou cartão). O valor é o preço mensal do ADR-0009, decidido no servidor. O retorno do navegador não libera o plano: só o webhook `CHECKOUT_PAID`, conferido pelo token do Asaas, estende o `pago até` em um mês e marca a organização como ativa. Isto substitui a cobrança manual do ADR-0008 para quem se cadastra sozinho. O dev continua podendo registrar um pagamento e ajustar limites no painel.

## Considered Options

- **Checkout hospedado do Asaas, cobrança avulsa de um mês** (escolhido): o cartão não passa pelo Despert; Pix e cartão cabem no mesmo fluxo. Boleto não existe nesse Checkout.
- **Assinatura recorrente só no cartão**: renova sozinha, mas tira o Pix, que é o meio esperado por quem paga mensalidade de escritório.
- **Cobrança manual** (ADR-0008): não cabe quando dezenas de organizações saem do teste no mesmo período.

## Consequences

- Acima de 20 usuários continua negociação com o dev. Não há plano anual.
- Trocar para um plano menor aplica os limites já existentes: nada é apagado; o excedente é pausado ou vira Leitura.
- O mesmo evento de webhook não estende o `pago até` duas vezes.
