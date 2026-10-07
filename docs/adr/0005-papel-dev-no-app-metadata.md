# Papel dev no `app_metadata`, conferido no banco a cada consulta

A conta dev controla a aplicação inteira. O papel fica em `auth.users.raw_app_meta_data.app_role = 'dev'`, que só a `service_role` altera. O RLS libera tudo para o dev por uma policy `dev_acesso_total` em cada tabela, usando `public.is_dev()`, que lê o papel em `auth.users` — e não do JWT. Ações que exigem a `service_role` (criar conta, redefinir senha, bloquear, excluir, trocar papel) passam pela Edge Function `admin`, que confere o papel no banco antes de agir. O site lê o papel da sessão só para decidir o que mostrar.

## Considered Options

- **`app_metadata` + `is_dev()` lendo `auth.users`** (escolhido): o usuário não consegue se promover; rebaixar ou bloquear vale na consulta seguinte, sem esperar o token expirar.
- **Claim no JWT (`auth.jwt() -> 'app_metadata'`)**: mais barato por consulta, mas um dev rebaixado continua dev até o token expirar (até 1 h).
- **Tabela `perfis` com o papel**: precisaria de policies próprias para impedir autopromoção e duplica o que o Auth já guarda.
- **Painel separado com a `service_role` no navegador**: descartado — a chave ignora o RLS e não pode sair do servidor.

## Consequences

- "Entrar como advogado" não troca de sessão: o dev continua autenticado como dev e o site só passa o `user_id` do advogado às consultas. O RLS permite por causa do `dev_acesso_total`; a atuação vive no `sessionStorage` da aba e é ignorada para quem não é dev.
- Toda escrita de um dev em dados de advogados é registrada pelo gatilho `auditar_dev()`; as ações da Edge Function e o "entrar como" são registrados explicitamente.
- O dev não pode remover o próprio papel, se bloquear nem se excluir (conferido na Edge Function e desabilitado no painel), para o sistema nunca ficar sem administrador por engano.
- O site também pergunta o papel ao banco (`is_dev()`) ao carregar a sessão, porque o `app_metadata` da sessão salva só se atualiza quando o token renova. Promover ou rebaixar vale no próximo carregamento da página, sem sair e entrar.
