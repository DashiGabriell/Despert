# Despert — Monitor de Prazos

Controle de prazos processuais para advogados: o robô lê o Diário de Justiça Eletrônico Nacional, identifica as publicações que atingem os processos monitorados e calcula a data de vencimento; a aplicação mostra o que está em risco e avisa por e-mail.

## Language

### Fonte

**DJEN**:
O Diário de Justiça Eletrônico Nacional, publicação diária única do CNJ onde os tribunais do país publicam intimações e comunicações. Única fonte do robô.
_Avoid_: diário, PJe, Comunica

**Publicação**:
Um item do DJEN dirigido a uma OAB ou a um número de processo. É a matéria-prima: uma publicação pode gerar um prazo.
_Avoid_: notícia, movimentação, andamento

**Monitoramento**:
Um filtro cadastrado pelo advogado — OAB com UF, ou número de processo — que define quais publicações interessam a ele.
_Avoid_: assinatura, rastreio, acompanhamento

### Prazo

**Prazo**:
O intervalo concedido para uma manifestação processual, expresso em dias, com uma data de vencimento. Unidade central do sistema.
_Avoid_: tarefa, compromisso, deadline

**Origem do prazo**:
De onde vieram os dias do prazo: identificados no texto da publicação, ajustados à mão pelo advogado, ou assumidos pelo valor padrão quando o texto não informa.
_Avoid_: fonte, tipo de prazo

**Para conferir**:
Situação de um prazo cuja origem não deu segurança — texto sem prazo, mais de um prazo no texto ou prazo em horas. Sinaliza que o advogado deve validar antes de confiar na data.
_Avoid_: pendente de revisão, dúvida

**Início do prazo**:
O primeiro dia útil após a publicação, a partir do qual os dias do prazo passam a contar.
_Avoid_: data inicial, começo

**Vencimento**:
O último dia útil em que a manifestação ainda é tempestiva. Contagem em dias úteis, com o dia de início valendo como dia 1.
_Avoid_: deadline, data limite

**Dia útil**:
Dia em que o expediente forense corre: dia de semana que não seja feriado nacional, feriado local cadastrado nem recesso.
_Avoid_: dia de semana, dia útil bancário

**Recesso forense**:
Período de 20/12 a 20/01 em que o prazo não corre (CPC art. 220). Considerado quando a configuração do advogado assim determina.
_Avoid_: férias, recesso de fim de ano

**Urgência**:
Classificação visual de quanto falta para o vencimento: vencido, vence hoje, urgente, próximo, futuro.
_Avoid_: prioridade, severidade, status

### Operação

**Execução**:
Uma rodada do robô — programada ou disparada à mão — e seu resultado registrado (encontradas, novas, sucesso ou falha).
_Avoid_: job, run, ciclo

**Busca agora**:
Disparo manual de uma execução pelo botão da aplicação, com limite de frequência por advogado.
_Avoid_: refresh, sincronizar

**Resumo diário**:
E-mail enviado a cada advogado depois de toda execução, listando os vencimentos dentro da janela de alerta. Sai sempre, mesmo quando não há nada na janela.
_Avoid_: newsletter, alerta diário

**Janela de alerta**:
Quantos dias à frente do vencimento o prazo passa a aparecer no resumo diário.
_Avoid_: lookahead, horizonte

**Token de webhook**:
Código secreto por advogado que autoriza o botão Busca agora a disparar uma execução no robô.
_Avoid_: senha, API key

**Agenda**:
A grade mensal da aplicação onde cada vencimento ocupa o seu dia. É a agenda da aplicação — não existe agenda externa.
_Avoid_: Google Agenda, calendário do advogado, evento

### Conta

**Advogado**:
Quem usa a aplicação: uma conta com e-mail e senha, dona exclusiva dos seus monitoramentos, prazos, feriados e configurações.
_Avoid_: usuário, cliente, tenant

**Dev**:
A conta que administra a aplicação inteira pelo painel `/dashitecnology`: contas, dados de todos os advogados, execuções, integração com o n8n e auditoria. Não é advogado e não tem prazos próprios.
_Avoid_: root, admin, superusuário

**Entrar como advogado**:
O dev usando as telas de um advogado, com os dados dele, para conferir ou corrigir algo. Vale só na aba aberta e cada alteração vai para a auditoria.
_Avoid_: impersonar, logar como, personificar

**Configuração do sistema**:
O que vale para todos os advogados ao mesmo tempo — hoje, a URL do webhook do n8n. Só o dev vê e altera.
_Avoid_: configuração global, settings

**Auditoria**:
O registro de tudo o que um dev fez em contas, dados de advogados e na configuração do sistema: quem, quando, o quê e em qual conta.
_Avoid_: log, histórico (histórico é das execuções)

**Janela de alerta do resumo**:
_Ver_: Janela de alerta
