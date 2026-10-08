---
status: accepted
---

# Preços dos planos no lançamento

Os planos do ADR-0008 têm preço fixo mensal, sem cobrança por usuário e sem plano anual por enquanto. O preço posiciona o Despert bem acima dos serviços que só enviam alertas de publicação (Escavador, Voga, DOinet) e na faixa dos sistemas de gestão completos (Astrea, Projuris, ADVBOX): ele faz mais que avisar, porque calcula o vencimento em dias úteis e mostra prazos e agenda, e o valor se apoia em não deixar o advogado perder prazo, não na quantidade de funcionalidades.

| Plano | Preço mensal | Usuários incluídos |
|---|---|---|
| Solo | R$ 79,90 | 1 |
| Escritório | R$ 397,90 | 2 a 10 |
| Corporativo | R$ 849,90 | 11 a 20 |

Acima de 20 usuários o preço é negociado caso a caso, junto com o limite ajustado pelo dev. O teste de 7 dias continua gratuito.

## Considered Options

- **Preço fixo por plano** (escolhido): simples de comunicar na landing page e de cobrar manualmente, já que o dev não precisa conferir quantos usuários cada organização tem.
- **Base com usuários incluídos mais valor por usuário extra**: acompanha melhor o tamanho do escritório, mas exige contar usuários a cada cobrança manual e dificulta a comparação na landing page.
- **Plano anual com desconto**: fica para quando a cobrança for automática; com Pix ou boleto manual, renovar e calcular reembolso anual é trabalho extra sem ganho agora.

## Consequences

- Os limites padrão do ADR-0008 não mudam: o preço acompanha o plano, não o número de usuários.
- Os preços ainda não existem no código; aparecem na landing page e na cobrança manual. Quando a cobrança automática entrar, o valor de cada plano passa a ser dado do sistema e este ADR deve ser revisto.
