# n8n — robô do Despert

O arquivo [`monitor-prazos-djen-supabase.n8n.json`](./monitor-prazos-djen-supabase.n8n.json) é o robô completo e multitenant: a cada execução ele percorre os advogados que têm OAB ou processo ativo, consulta o DJEN, calcula os vencimentos, grava os prazos novos com o dono certo (`user_id`), registra a execução e manda o resumo diário por e-mail.

```
Gatilho ─┬─ Todo dia útil 07:00 ─┐
         ├─ Executar manualmente ┴─ Ler Configurações (todos) ─┐
         └─ Disparo pelo Site ──── Conferir Token (só o dono) ─┴─ Ler Monitoramentos → Ler Feriados → Montar Lote
                                                                                                   │
  ┌──────────────────────────────── Um advogado por vez ◄──────────────────────────────────────────┘
  │   Expandir Consultas → Consultar DJEN → Processar Publicações → Ler Já Salvos → Filtrar Novas
  │   → Tem novas? → Salvar Prazos → Prazos em Alerta → Montar E-mail → Registrar Execução
  └── ◄ Avisar suporte? ◄ Enviar Resumo                                (+ E-mail ao Suporte se falhou)
```

- **Programado** (seg. a sex., 07:00 de Brasília) e **manual** processam todos os advogados.
- **Buscar agora** (botão do site) chega pelo webhook com o token do advogado; o token é conferido no banco **antes** de qualquer consulta e só o dono dele é processado. Token desconhecido: nada acontece.
- Uma falha no DJEN ou na gravação de um advogado não interrompe os outros. Ela vira uma execução com status `falha`, o resumo daquele advogado sai com um aviso para conferir manualmente e o endereço de suporte recebe o detalhe.
- O resumo diário sai **sempre**, mesmo vazio (corpo reduzido quando não há nada na janela de alerta).
- A regra de vencimento é a mesma da aplicação (ver `docs/adr/0002-regra-de-vencimento-duplicada.md`): mudou de um lado, mude do outro.

## Pré-requisitos

- n8n self-hosted (1.x ou 2.x) com URL pública em HTTPS — o navegador do advogado chama o webhook direto.
- Banco aplicado com [`supabase/schema.sql`](../supabase/schema.sql).
- Uma conta Google para enviar os e-mails (Gmail).

## 1. Importar

No n8n: **Workflows → Add workflow → ⋯ → Import from File** e escolha `monitor-prazos-djen-supabase.n8n.json`.

## 2. Credenciais

### Supabase (service_role)

1. No Supabase: **Project Settings → API Keys → Legacy API Keys**, copie a chave `service_role` (segredo: nunca vai para o site nem para o repositório).
2. No n8n: **Credentials → Add credential → Supabase API**
   - **Host**: a URL do projeto (`https://<id-do-projeto>.supabase.co`)
   - **Service Role Secret**: a chave copiada
3. Selecione essa credencial em todos os nós verdes do Supabase: Ler Configurações, Conferir Token, Ler Monitoramentos, Ler Feriados, Ler Já Salvos, Salvar Prazos, Prazos em Alerta e Registrar Execução.

A chave `service_role` ignora o RLS de propósito (ADR 0001): é o robô quem decide o dono de cada linha, sempre pelo `user_id` lido da própria configuração do advogado.

### Gmail

1. **Credentials → Add credential → Gmail OAuth2 API** e siga o assistente do n8n para autorizar a conta que vai enviar.
2. Selecione a credencial nos nós **Enviar Resumo** e **E-mail ao Suporte**.

## 3. E-mail do suporte

Abra o nó **Montar Lote** e troque a constante na segunda linha:

```js
const EMAIL_SUPORTE = 'suporte@troque-este-endereco.com';
```

Enquanto o valor de exemplo estiver lá, o aviso ao suporte é pulado (o advogado continua sendo avisado no resumo).

## 4. Ativar e ligar o site

1. Salve e **ative** o workflow (chave *Active* no topo). Isso liga o agendamento das 07:00 e a Production URL do webhook.
2. Abra o nó **Disparo pelo Site** e copie a **Production URL** (algo como `https://seu-n8n.com/webhook/monitor-prazos`). Não use a *Test URL*.
3. Entre no site com a conta dev, abra `/dashitecnology/n8n`, cole essa URL, salve e clique em **Testar conexão**. A URL vale para todos os advogados e só o dev a vê ou altera; o token de segurança continua por advogado e já vem gerado.

## 5. Teste ponta a ponta

1. No site, entre como advogado (ou use **Usuários → Entrar como** no painel dev) e cadastre uma OAB em **Monitoramento**.
2. Clique em **Buscar agora**. O botão mostra "Buscando…" e, em até um minuto:
   - **Histórico** ganha uma linha "Buscar agora" com encontradas/novas;
   - os prazos capturados aparecem em **Prazos** sem recarregar a página;
   - o resumo chega no e-mail de alertas.
3. No n8n, **Executions** mostra a execução; se algo falhou, o nó em vermelho indica onde.
4. Teste o token: abra `https://seu-n8n.com/webhook/monitor-prazos?token=errado` no navegador. A execução termina em **Montar Lote** sem processar ninguém.
5. Para rodar todos os advogados na hora, abra o workflow e clique em **Test workflow** (gatilho "Executar manualmente").

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| "Buscar agora" fica em "Buscando…" e expira em 3 min | URL errada em `/dashitecnology/n8n` (Test URL em vez de Production URL), workflow inativo ou advogado sem monitoramento ativo |
| Site diz que o robô não foi ativado pelo administrador | A URL do webhook está vazia em `/dashitecnology/n8n` |
| Execução para em um nó Supabase com 401 | Credencial com a chave `anon`/publishable em vez da `service_role` |
| Resumo não chega | Credencial Gmail expirada; reautorize. A execução continua registrada no Histórico |
| Execução com status `falha` | DJEN fora do ar ou lento; o detalhe aparece no Histórico e no e-mail ao suporte |
