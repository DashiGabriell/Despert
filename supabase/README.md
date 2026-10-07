# Supabase — schema do Despert

Banco multitenant: a **organização** (escritório ou departamento jurídico) é a dona dos dados — veja [ADR-0007](../docs/adr/0007-organizacao-e-o-tenant.md). Cada membro vê apenas os dados das organizações a que pertence, garantido por Row Level Security.

## Organizações e membros

- `organizacoes` é o tenant; `membros` liga uma conta a uma organização com um papel (`administrador`, `advogado`, `assistente`, `leitura`). Uma conta pode pertencer a várias.
- `monitoramentos`, `feriados`, `prazos` e `execucoes` têm `organizacao_id`; a policy `membro_da_organizacao` usa `public.membro_de(organizacao_id)`.
- `user_id` continua nas tabelas como autor. Se um insert vier só com `user_id` (como o n8n faz hoje), o gatilho `preencher_organizacao` completa `organizacao_id` com a organização mais antiga da conta — e, em `prazos`, `responsavel_id` com o próprio `user_id`.
- Toda conta nova ganha uma organização em período de teste com ela como administradora. Contas anteriores viraram organizações Solo ativas na migração.
- `configuracoes` guarda o que é pessoal (e-mail e janela de alerta, escopo do resumo); o que é da organização fica em `configuracoes_organizacao` — veja a seção de equipe abaixo.

## Aplicar

1. Crie o projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor → New query**, cole o conteúdo de [`schema.sql`](./schema.sql) e clique em **Run**.
3. Em **Authentication → Providers → Email**, mantenha **Confirm email** ligado (signup aberto com confirmação).
4. Em **Authentication → URL Configuration**, coloque a URL do site (ex.: `https://despert.vercel.app`) em **Site URL** — é para lá que o link de confirmação leva.

> **E-mail de confirmação em produção:** o remetente padrão do Supabase só entrega para membros da organização e tem limite de poucos e-mails por hora. Para abrir o cadastro a outros advogados, configure um SMTP próprio em **Project Settings → Authentication → SMTP Settings** (Resend, Brevo, SES…). Sem SMTP, deixe **Confirm email** desligado só enquanto testa.

O script é idempotente: rodar de novo não quebra nada. Ele cria as tabelas **já** com a coluna de dono (`user_id`) e as policies — se por algum motivo você tiver aplicado a versão antiga (sem dono), apague as tabelas antigas primeiro (`drop table public.prazos, public.monitoramentos, public.feriados, public.execucoes, public.configuracoes cascade;`) e rode de novo.

## O que nasce junto

- Toda conta nova recebe uma linha em `configuracoes` com o e-mail já como destino do resumo diário.
- Toda organização nova recebe `configuracoes_organizacao` com um token de webhook gerado. O token é único: o n8n identifica por ele a organização do "Buscar agora".
- `prazos`, `execucoes` ficam na publicação de tempo real (a aplicação assina).
- O n8n entra com a chave **service_role**, que ignora o RLS, e só chama as funções `robo_*`.

## Acesso dev

O papel fica em `auth.users.raw_app_meta_data.app_role = 'dev'` (só a `service_role` altera; o usuário não consegue se promover). O `schema.sql` já promove a conta `b09286ec-03fb-4025-a934-7dcb455e56c7` e cria:

- `public.is_dev()`, que lê o papel em `auth.users` (rebaixar ou bloquear vale na hora, sem esperar o token expirar);
- a policy `dev_acesso_total` em todas as tabelas dos advogados;
- `configuracao_sistema` (linha única com a URL do webhook do n8n: todos leem, só o dev altera);
- `auditoria` e o gatilho `auditar_dev()`, que registra toda escrita de um dev em dados de advogados;
- as funções `admin_listar_contas()` e `admin_metricas()` do painel.

Depois de rodar o `schema.sql`:

1. Publique a Edge Function que cria contas, redefine senhas, bloqueia, exclui e troca papéis:
   ```bash
   supabase functions deploy admin --project-ref <seu-projeto>
   ```
   Sem a CLI: **Edge Functions → Deploy a new function → Via Editor**, nome `admin`, cole [`functions/admin/index.ts`](./functions/admin/index.ts). Deixe **Verify JWT** ligado. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já vêm nos segredos padrão da função.
2. Recarregue o site com a conta dev: ele confere o papel no banco e abre `/dashitecnology`.
3. Para promover outra conta depois: painel dev → **Usuários → Gerenciar → Promover a dev** (ou o mesmo `update` do fim do `schema.sql` com outro id).

Se a URL do webhook estava salva por advogado (versão anterior), o `schema.sql` copia a mais recente para `configuracao_sistema` antes de remover a coluna antiga.

## Planos, limites, teste e carência

Veja [ADR-0008](../docs/adr/0008-planos-limites-e-cobranca-manual.md). Só o dev altera, pelo painel **Organizações**.

- `organizacoes.plano` dá os limites padrão (`public.limites_padrao()`, espelhado em `web/src/domain/planos.ts`); `organizacoes.limites` guarda só os ajustes do dev, validados pela constraint `limites_validos`.
- `organizacoes.pago_ate` é o último dia pago (nulo = sem vencimento). O teste dura `configuracao_sistema.dias_teste` dias a partir de `teste_iniciado_em`.
- `public.etapa_de(org)` calcula a etapa pelas datas, sem tarefa agendada: `teste`/`ativa` → `aviso` (até `carencia_aviso_dias` depois do vencimento) → `leitura` (até `carencia_total_dias`) → `suspensa`.
- O gatilho `reforcar_plano` recusa, para membros: qualquer escrita em `leitura`/`suspensa`, e OAB ou processo ativo acima do limite (inclusive ao reativar). Em `membros`, recusa usuário acima do limite e papel além do Administrador quando o plano não tem papéis. O robô (service_role) e o dev não são barrados.
- Trocar para um plano menor (`aplicar_limites`) não apaga nada: pausa os monitoramentos mais novos acima do limite e passa os usuários excedentes a Leitura.
- O Buscar agora é registrado por `public.registrar_busca_agora(org)`, que confere etapa, intervalo mínimo e cota diária (zera à meia-noite de Brasília) da organização. A conferência pelo robô e as buscas automáticas por plano chegam com a fase do robô.

[`tests/limites_planos.sql`](./tests/limites_planos.sql) cria uma organização Solo temporária e tenta passar de cada limite; rode-o como o teste de isolamento abaixo, numa transação desfeita.

## Equipe, papéis e convites

- As policies de `prazos`, `monitoramentos`, `feriados_organizacao` e `configuracoes_organizacao` usam `public.tem_papel(org, papeis)` conforme a matriz da [#18](https://github.com/DashiGabriell/Despert/issues/18): todos leem; Assistente cria, edita, cumpre e troca o responsável; só Administrador e Advogado excluem prazo e mexem em monitoramentos; feriados e configurações da organização são do Administrador. Leitura só lê.
- `configuracoes_organizacao` guarda dias retroativos, prazo padrão, recesso e token do Buscar agora; `configuracoes` (pessoal) só e-mail, janela de alerta e escopo do resumo.
- Cada OAB pertence a um Administrador ou Advogado (`reforcar_papeis_monitoramentos`); no plano "por advogado", no máximo uma ativa por pessoa. Advogados só alteram a própria OAB.
- O responsável de um prazo precisa ser da equipe (`validar_responsavel`).
- Convites: `convidar`, `reenviar_convite` (renova 7 dias e põe o e-mail de novo na fila), `cancelar_convite`, `ver_convite` e `aceitar_convite`. Membros mais convites pendentes contam no limite de usuários (`vagas_ocupadas`). O convite vale só para o e-mail convidado, confirmado. O e-mail sai pelo n8n (fluxo de convites); o Administrador também pode copiar o link.
- `alterar_papel` e `remover_membro` são do Administrador; sempre sobra um Administrador (`proteger_administrador`). Ao sair ou deixar de ser Advogado, a OAB da pessoa é pausada; na saída, os prazos em aberto e os processos avulsos dela passam para um Administrador (`ao_mudar_membro`).

[`tests/permissoes_papeis.sql`](./tests/permissoes_papeis.sql) monta uma equipe temporária com os quatro papéis e confere cada linha da matriz, os convites acima do limite e a saída de um membro; rode-o numa transação desfeita, como os outros.

## Robô por organização

O n8n (chave `service_role`) só chama funções do banco; as regras ficam aqui — veja [`n8n/README.md`](../n8n/README.md).

- `robo_lote(origem, turno, token)`: organizações a buscar, com configurações, feriados e monitoramentos ativos. Turno `'12'` só traz quem tem 2 buscas automáticas no plano; organização suspensa nunca entra. Com `origem = 'site'`, só a dona do token e só se houver um registro em `buscas_agora` dos últimos 5 minutos ainda não processado (`processada_em`): cada registro libera uma busca.
- `robo_gravar_prazos(org, publicacoes)`: um prazo por publicação na organização (índice único `organizacao_id, djen_id`). Responsável: dono da primeira OAB da casa listada na publicação, com as demais em `tambem_intimados`; sem OAB, quem cadastrou o processo avulso; sem nenhum, o Administrador.
- `robo_concluir(...)`: registra a execução da organização e devolve o resumo de cada membro (janela de alerta e escopo "meus"/"todos" de cada um), mais a etapa e as datas da carência para o aviso ao Administrador.
- `robo_convites_pendentes()` e `robo_marcar_convite_enviado(convite)`: fila dos e-mails de convite (`convites.enviado_em`).
- Saíram na fase 4: a cópia das configurações da organização em cada membro, a visão `feriados` e a trava de monitoramentos ativos em uma organização só por pessoa.

[`tests/robo_organizacao.sql`](./tests/robo_organizacao.sql) monta um Escritório e um Solo descartáveis e confere prazo único e responsável, turnos, etapas, Buscar agora, resumo por membro e a fila de convites; rode-o numa transação desfeita.

## Verificar o isolamento (teste automatizado)

[`tests/rls_organizacoes.sql`](./tests/rls_organizacoes.sql) assume a identidade de um membro da organização A e confirma que ele não lê, altera, exclui nem insere dados da organização B (a com mais prazos). Rode-o numa transação desfeita, para não deixar rastro:

```sql
begin;
-- cole aqui o conteúdo de tests/rls_organizacoes.sql
rollback;
```

Sem erro = isolamento ok. Qualquer vazamento interrompe com a mensagem do que A conseguiu fazer.

## Verificar o isolamento (2 contas)

1. Em **Authentication → Users → Add user**, crie `advogada1@exemplo.com` e `advogada2@exemplo.com` (com e-mail confirmado).
2. Abra a aplicação numa janela anônima, entre como a advogada 1 e cadastre um monitoramento.
3. Abra outra janela anônima, entre como a advogada 2: o monitoramento da advogada 1 **não pode aparecer**.
4. Repita para um prazo manual criado pela advogada 1.

Se a advogada 2 enxergar qualquer coisa da advogada 1, a policy não foi aplicada — confira se o `schema.sql` rodou sem erro.

## Tipos gerados para a aplicação

Com a [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase gen types typescript --project-id <seu-projeto> > web/src/lib/database.types.ts
```

Sem a CLI, use o arquivo de tipos versionado em `web/src/lib/database.types.ts` e ajuste-o quando o schema mudar.
