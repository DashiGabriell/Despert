# Despert — Monitor de Prazos

Controle de prazos processuais para advogados solo, escritórios e departamentos jurídicos de empresa: o robô lê o Diário de Justiça Eletrônico Nacional, identifica as publicações que atingem os processos monitorados e calcula a data de vencimento; a aplicação mostra o que está em risco e avisa por e-mail.

## Language

### Fonte

**DJEN**:
O Diário de Justiça Eletrônico Nacional, publicação diária única do CNJ onde os tribunais do país publicam intimações e comunicações. Única fonte do robô.
_Avoid_: diário, PJe, Comunica

**Publicação**:
Um item do DJEN dirigido a uma OAB ou a um número de processo. É a matéria-prima: uma publicação pode gerar um prazo.
_Avoid_: notícia, movimentação, andamento

**Monitoramento**:
Um filtro da organização — a OAB com UF de um advogado membro, ou um número de processo — que define quais publicações interessam a ela.
_Avoid_: assinatura, rastreio, acompanhamento

**Processo avulso**:
Monitoramento por número de processo, cadastrado quando a OAB dos membros não basta (processo conduzido por escritório externo, por exemplo).
_Avoid_: processo extra, processo manual

### Prazo

**Prazo**:
O intervalo concedido para uma manifestação processual, expresso em dias, com uma data de vencimento. Unidade central do sistema.
_Avoid_: tarefa, compromisso, deadline

**Responsável**:
O membro que responde por um prazo: o dono da OAB intimada ou quem cadastrou o processo avulso; sem nenhum dos dois, o Administrador. Pode ser trocado. Quando a publicação intima mais de uma OAB da organização, gera um prazo só: o responsável é o dono da primeira OAB listada na publicação e os demais são "também intimados".
_Avoid_: dono do prazo, atribuído

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
Período de 20/12 a 20/01 em que o prazo não corre (CPC art. 220). Considerado quando a configuração da organização assim determina.
_Avoid_: férias, recesso de fim de ano

**Urgência**:
Classificação visual de quanto falta para o vencimento: vencido, vence hoje, urgente, próximo, futuro.
_Avoid_: prioridade, severidade, status

### Operação

**Execução**:
Uma rodada do robô — programada ou disparada à mão — e seu resultado registrado (encontradas, novas, sucesso ou falha).
_Avoid_: job, run, ciclo

**Busca agora**:
Disparo manual de uma execução pelo botão da aplicação, com intervalo mínimo e quantidade por dia definidos pelo plano e contados para a organização inteira.
_Avoid_: refresh, sincronizar

**Resumo diário**:
E-mail enviado a cada membro depois da execução das 07:00 (e da manual), listando os vencimentos dentro da janela de alerta dele e as publicações novas — só os prazos em que é responsável ou também intimado, ou todos da organização, conforme a preferência. Sai sempre, mesmo quando não há nada na janela. Na execução das 12:00 só recebe quem tem publicação nova; no Busca agora, só quem clicou. Para o Administrador, avisa também quando o pagamento venceu (carência).
_Avoid_: newsletter, alerta diário

**Janela de alerta**:
Quantos dias à frente do vencimento o prazo passa a aparecer no resumo diário.
_Avoid_: lookahead, horizonte

**Token de webhook**:
Código secreto da organização que autoriza o botão Busca agora a disparar uma execução no robô.
_Avoid_: senha, API key

**Agenda**:
A grade mensal da aplicação onde cada vencimento ocupa o seu dia. É a agenda da aplicação — não existe agenda externa.
_Avoid_: Google Agenda, calendário do advogado, evento

### Organização

**Organização**:
Quem contrata a aplicação e é dona dos monitoramentos, prazos, feriados, configurações e execuções. Pode ser um advogado solo (organização de um membro), um escritório ou o departamento jurídico de uma empresa; na tela aparece como "Escritório" ou "Departamento jurídico".
_Avoid_: tenant, conta, workspace, empresa

**Membro**:
Uma pessoa com login que pertence a uma organização, com um papel. A mesma pessoa pode ser membro de mais de uma organização.
_Avoid_: usuário, funcionário, colaborador

**Papel**:
O que um membro pode fazer na organização: Administrador, Advogado, Assistente ou Leitura.
_Avoid_: perfil, permissão, cargo

**Administrador**:
Papel que gerencia a equipe, os feriados e as configurações da organização, além de tudo o que o Advogado faz. Não gerencia plano nem cobrança.
_Avoid_: dono, titular, admin do sistema

**Advogado**:
Papel de quem tem OAB monitorada e responde por prazos: cria, edita, exclui e cumpre prazos e cadastra monitoramentos.
_Avoid_: usuário, cliente, tenant

**Assistente**:
Papel de quem organiza a agenda sem responder pelo prazo (estagiário, secretária, paralegal): vê, edita e cumpre prazos, mas não exclui nem configura.
_Avoid_: estagiário, secretária, auxiliar

**Leitura**:
Papel de quem só acompanha (sócio, diretoria): vê prazos e exporta relatórios, sem alterar nada.
_Avoid_: visualizador, observador, convidado

### Plano

**Plano**:
O pacote contratado pela organização — Solo, Escritório ou Corporativo — que define seus limites de uso. Só o dev atribui e ajusta.
_Avoid_: assinatura, licença, pacote

**Limite**:
Quantidade máxima de algo que o plano permite à organização (membros, OABs, processos avulsos, buscas). O dev pode sobrescrever o limite de uma organização específica.
_Avoid_: cota, franquia

**Período de teste**:
Os primeiros 7 dias de uma organização criada por autoatendimento, com os limites do Solo.
_Avoid_: trial, degustação, freemium

**Período de carência**:
Os 15 dias após o fim do teste ou a falta de pagamento: primeiro tudo funciona com aviso, depois só leitura com o robô ainda avisando; ao final, o robô para. Nada é apagado.
_Avoid_: bloqueio, suspensão, inadimplência

### Sistema

**Dev**:
A conta que administra a aplicação inteira pelo painel `/dashitecnology`: organizações, planos, contas, dados, execuções, integração com o n8n e auditoria. Não é membro de nenhuma organização e não tem prazos próprios.
_Avoid_: root, admin, superusuário

**Entrar como advogado**:
O dev usando as telas de um membro, com os dados da organização dele, para conferir ou corrigir algo. Vale só na aba aberta e cada alteração vai para a auditoria.
_Avoid_: impersonar, logar como, personificar

**Configuração do sistema**:
O que vale para todas as organizações ao mesmo tempo — hoje, a URL do webhook do n8n. Só o dev vê e altera.
_Avoid_: configuração global, settings

**Auditoria**:
O registro de quem fez o quê, quando e em qual organização: todas as ações do dev e, nos planos que incluem auditoria, as alterações feitas pelos membros.
_Avoid_: log, histórico (histórico é das execuções)

**Janela de alerta do resumo**:
_Ver_: Janela de alerta
