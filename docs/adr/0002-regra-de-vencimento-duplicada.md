# Regra de vencimento duplicada: robô calcula na captura, aplicação recalcula na edição

A regra de vencimento (dias úteis, feriados, recesso, início em dia útil seguinte) existe em dois lugares: no fluxo n8n, que calcula quando a publicação é capturada, e na aplicação, que recalcula quando o advogado edita o prazo. Só a versão da aplicação é coberta por testes automatizados.

## Considered Options

- **Duplicar a regra** (escolhido): o robô segue autônomo (roda sem a app), a app recalcula ao editar sem chamar serviço externo, e o domínio em TypeScript é o que o TDD cobre. As duas implementações derivam da mesma especificação documentada no GLOSSARY (dia útil, recesso, contagem com início como dia 1).
- **Só o n8n calcula**: editar um prazo viraria uma chamada HTTP ao workflow — a app depende da VPS para uma operação local e o teste viraria teste de integração.
- **Só a app calcula**: o robô precisaria da app no caminho da captura, ou gravaria prazo sem vencimento até alguém abrir a tela.

## Consequences

- Mudança na regra de dias úteis é **duas** alterações sincronizadas; o teste na app protege uma delas. Se divergirem, o advogado vê vencimento diferente entre a captura e a edição — a especificação no GLOSSARY é o que os dois lados têm que seguir.
