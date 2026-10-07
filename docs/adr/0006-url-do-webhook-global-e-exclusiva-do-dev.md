# URL do webhook do n8n é global e só o dev altera

Existe um único robô (um workflow multitenant numa VPS), então a Production URL do webhook é a mesma para todos os advogados. Ela saiu de `configuracoes` (por advogado) para a linha única `configuracao_sistema`, que todos os autenticados leem e só o dev altera, no painel `/dashitecnology/n8n`. O token de webhook continua por advogado: é ele que identifica quem disparou o Busca agora.

## Considered Options

- **Linha única em `configuracao_sistema`** (escolhido): um lugar para trocar a URL quando o n8n mudar de endereço; o advogado não precisa saber o que é um webhook.
- **Manter por advogado**: cada advogado copiava a URL do n8n, o que exigia acesso ao n8n ou alguém mandando a URL a cada conta nova, e uma troca de servidor quebrava todos.
- **Variável de ambiente do site (`VITE_…`)**: trocar a URL exigiria novo deploy, e a URL ficaria fora do alcance do painel dev.

## Consequences

- O ADR-0004 continua valendo: o Busca agora segue fazendo GET direto do navegador, agora na URL global com o token do advogado.
- Todos os advogados conseguem ler a URL (o navegador precisa dela para disparar). Ela não é segredo: sem um token válido, o robô não processa ninguém.
- Sem URL configurada, o botão Busca agora orienta o advogado a aguardar o administrador do sistema.
- O `schema.sql` migra a URL mais recente que existia por advogado antes de remover a coluna antiga.
