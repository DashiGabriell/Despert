# n8n — robô do Despert

Dois fluxos importáveis:

- [`monitor-prazos-djen-supabase.n8n.json`](./monitor-prazos-djen-supabase.n8n.json) — o robô. Percorre as **organizações** (ADR-0007), consulta o DJEN para as OABs e processos ativos de cada uma, calcula os vencimentos, grava um prazo por publicação com o responsável certo, registra a execução e manda o resumo a cada membro.
- [`convites-despert.n8n.json`](./convites-despert.n8n.json) — a cada 5 minutos, manda o e-mail dos convites criados ou reenviados na tela **Equipe**.

As regras ficam no banco (`supabase/schema.sql`, seção "robô por organização"), em funções que só a chave `service_role` executa e que são testadas em `supabase/tests/robo_organizacao.sql`. O n8n só consulta o DJEN, calcula o vencimento e manda os e-mails.

```
Executar manualmente ─┐
Dia útil 07:00 ───────┤
Dia útil 12:00 ───────┼─ Configurar → Montar Lote (robo_lote) → Organizações ─┐
Disparo pelo Site ────┘                                                       │
  ┌──────────────────────────── Uma organização por vez ◄─────────────────────┘
  │   Expandir Consultas → Consultar DJEN → Processar Publicações
  │   → Gravar Prazos (robo_gravar_prazos) → Resultado → Concluir Execução (robo_concluir)
  │   → Montar E-mails → Tem destinatário? → Enviar Resumo (um por membro)
  └── ◄ Avisar suporte? (+ E-mail ao Suporte se falhou)
```

## O que o robô faz

- **07:00 (seg. a sex.)**: todas as organizações. **12:00**: só as que têm 2 buscas automáticas no plano (Escritório e Corporativo; o Solo fica só com a das 07:00). **Executar manualmente**: todas.
- **Buscar agora**: o site registra o disparo no banco (`registrar_busca_agora`, que confere intervalo mínimo e cota diária da organização) e chama o webhook com o token da organização. O robô só processa se o token existir **e** houver um registro dos últimos 5 minutos ainda não usado; cada registro vale uma busca. Token desconhecido ou chamada direta sem registro: nada acontece.
- **Etapas do plano** (ADR-0008): em aviso e em somente leitura a organização continua sendo buscada e avisada; depois da carência (suspensa), não.
- **Prazo único por publicação na organização**: a mesma publicação que intima duas OABs da casa vira um prazo só. Responsável: o dono da primeira OAB da casa listada na publicação (os demais ficam como "também intimados"); sem OAB da casa, quem cadastrou o processo avulso; sem nenhum, o Administrador.
- **Resumo por membro**: cada um recebe com a própria janela de alerta e preferência ("meus prazos", que inclui os em que é também intimado, ou "todos"; padrão: Advogado "meus", demais "todos"). Às 12:00, só quem tem publicação nova; no Buscar agora, só quem clicou. O Administrador recebe o aviso de pagamento vencido nas etapas de aviso e somente leitura.
- **Falhas**: uma falha no DJEN ou na gravação de uma organização não interrompe as outras. Vira uma execução com status `falha`, o resumo sai com o aviso para conferir manualmente e o suporte recebe o detalhe.
- **Vencimento**: a mesma regra da aplicação (ADR-0002). O trecho entre `// <regra-vencimento>` e `// </regra-vencimento>` no nó **Processar Publicações** é comparado com `web/src/domain/dias.ts` pelo teste `web/src/domain/paridade-n8n.test.ts`: mudou de um lado, mude do outro.

## Pré-requisitos

- n8n self-hosted (1.x ou 2.x) com URL pública em HTTPS — o navegador chama o webhook direto.
- Banco aplicado com [`supabase/schema.sql`](../supabase/schema.sql) (fase 4 ou posterior).
- Uma conta Google para enviar os e-mails (Gmail).

## 1. Importar

No n8n: **Workflows → Add workflow → ⋯ → Import from File**, uma vez para cada arquivo. Se o fluxo antigo (por advogado) estiver importado, **desative-o e apague-o**: ele lê colunas que não existem mais.

## 2. Credenciais

### Supabase (service_role)

1. No Supabase: **Project Settings → API Keys → Legacy API Keys**, copie a chave `service_role` (segredo: nunca vai para o site nem para o repositório).
2. No n8n: **Credentials → Add credential → Supabase API**
   - **Host**: a URL do projeto (`https://<id-do-projeto>.supabase.co`)
   - **Service Role Secret**: a chave copiada
3. Selecione essa credencial nos nós HTTP que falam com o banco: **Montar Lote**, **Gravar Prazos** e **Concluir Execução** (robô); **Ler Convites** e **Marcar Enviado** (convites). Neles, *Authentication* já vem como *Predefined Credential Type → Supabase API*.

A chave `service_role` ignora o RLS de propósito (ADR-0001); as funções `robo_*` só aceitam essa chave.

### Gmail

1. **Credentials → Add credential → Gmail OAuth2 API** e siga o assistente do n8n.
2. Selecione a credencial em **Enviar Resumo** e **E-mail ao Suporte** (robô) e **Enviar Convite** (convites).

## 3. Endereços

No nó **Configurar** de cada fluxo:

```js
const SUPABASE_URL = 'https://pcjyqwiuqphuiqgfvxqj.supabase.co'; // URL do projeto (não é segredo)
const EMAIL_SUPORTE = 'suporte@troque-este-endereco.com';       // robô: quem recebe as falhas
const URL_SITE = 'https://troque-pelo-endereco-do-site.com';     // convites: de onde sai o link
```

Enquanto `EMAIL_SUPORTE` tiver o valor de exemplo, o aviso ao suporte é pulado (os membros continuam avisados no resumo). Enquanto `URL_SITE` tiver o valor de exemplo, nenhum convite é enviado — o Administrador ainda pode copiar o link na tela Equipe.

## 4. Ativar e ligar o site

1. Salve e **ative** os dois fluxos (chave *Active* no topo). Isso liga os agendamentos e a Production URL do webhook.
2. Abra o nó **Disparo pelo Site** e copie a **Production URL** (algo como `https://seu-n8n.com/webhook/monitor-prazos`). Não use a *Test URL*.
3. Entre no site com a conta dev, abra `/dashitecnology/n8n`, cole essa URL, salve e clique em **Testar conexão**. O token de cada organização já vem gerado (o Administrador troca em Configurações).

## 5. Teste ponta a ponta

1. No site, entre como Administrador (ou use **Usuários → Entrar como** no painel dev) e cadastre uma OAB em **Monitoramento**.
2. Clique em **Buscar agora**. O botão mostra "Buscando…" e, em até um minuto:
   - **Histórico** ganha uma linha "Buscar agora" com encontradas/novas;
   - os prazos capturados aparecem em **Prazos** sem recarregar a página, com o responsável preenchido;
   - o resumo chega no e-mail de alertas de quem clicou.
3. No n8n, **Executions** mostra a execução; se algo falhou, o nó em vermelho indica onde.
4. Teste o token: abra `https://seu-n8n.com/webhook/monitor-prazos?token=errado` no navegador. A execução termina em **Montar Lote** sem processar ninguém. O mesmo acontece com o token certo sem clicar no botão (não há registro do Buscar agora).
5. Em **Equipe**, convide um e-mail seu. Em até 5 minutos o convite chega e a linha passa de "E-mail na fila" para "E-mail enviado em…".
6. Para rodar todas as organizações na hora, abra o robô e clique em **Test workflow** (gatilho "Executar manualmente").

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| "Buscar agora" fica em "Buscando…" e expira em 3 min | URL errada em `/dashitecnology/n8n` (Test URL em vez de Production URL), fluxo inativo, organização sem monitoramento ativo ou fluxo antigo ainda importado |
| Site diz que o robô não foi ativado pelo administrador | A URL do webhook está vazia em `/dashitecnology/n8n` |
| Nó HTTP do Supabase com 401 | Credencial com a chave `anon`/publishable em vez da `service_role`, ou credencial não selecionada no nó |
| Nó HTTP do Supabase com 404 em `/rpc/robo_...` | `schema.sql` da fase 4 não aplicado, ou `SUPABASE_URL` de outro projeto |
| Resumo ou convite não chega | Credencial Gmail expirada; reautorize. A execução continua registrada no Histórico e o convite segue na fila |
| Execução com status `falha` | DJEN fora do ar ou lento; o detalhe aparece no Histórico e no e-mail ao suporte |
