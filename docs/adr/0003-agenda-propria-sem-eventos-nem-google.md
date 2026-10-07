# Agenda é a grade de prazos da própria aplicação — sem eventos e sem Google Agenda

A aplicação não integra com Google Agenda e não tem o conceito de "evento" (audiência, reunião, compromisso interno). A Agenda é a grade mensal de vencimentos de prazos, com criação de prazo ao clicar num dia.

## Considered Options

- **Só grade de prazos** (escolhido): um único conceito no sistema, herda tudo o que já existe (urgência, feriados, filtros) e atende ao objetivo de não perder prazo.
- **Eventos próprios** (audiências e reuniões em tabela separada): segundo modelo de dados com data, tipo e recorrência próprios — caminho para "agenda" e "prazo" brigarem pela mesma tela.
- **Integração com Google Agenda**: exigia credencial OAuth por conta na VPS e trazia para dentro do robô uma dependência que não é sobre prazos.

## Consequences

- Quem precisar de audiências na agenda terá que decidir se elas são prazos com origem própria ou se abre um novo modelo (novo ADR). Pedir "sincronizar com meu Google Agenda" passa a ser um pedido de integração externa, não uma configuração.
