# Multitenancy por RLS, robô fora do RLS

O sistema é multitenant: cada advogado vê apenas seus próprios dados, garantido por `user_id` e Row Level Security no Supabase. O n8n, porém, usa a chave `service_role`, que ignora o RLS — é quem escreve `prazos` e `execucoes` em nome do advogado correto (o `user_id` vem da configuração lida na própria execução).

## Considered Options

- **RLS por `auth.uid()` + `service_role` no robô** (escolhido): a app é segura por política do banco, sem lógica de autorização no front; o robô continua simples.
- **Sem RLS, autorização só na app**: qualquer `anon key` leria dados de todos — inaceitável com dados de processo de terceiros.
- **Robô com JWT do advogado**: exigiria guardar credencial de cada advogado no n8n e trocar de token a cada iteração.

## Consequences

- Toda tabela com dados do advogado precisa de `user_id` + policy `auth.uid() = user_id`; esquecer uma delas vaza dados entre contas.
- O n8n está fora da garantia do banco: um `user_id` errado no workflow escreve no lugar errado sem erro de permissão. A leitura de config por execução é o único ponto que decide isso.
