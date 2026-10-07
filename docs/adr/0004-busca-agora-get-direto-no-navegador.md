# "Busca agora" chama o n8n direto do navegador

O botão Busca agora faz um GET na Production URL do webhook do n8n com o token do advogado na query string, direto do navegador. Quando o n8n estiver em outro domínio, o navegador pode bloquear a leitura da resposta (CORS); contornamos com um fallback `no-cors` e **não** lemos a resposta — o resultado da execução é observado pela tabela de execuções, que a app já assina em tempo real.

## Considered Options

- **GET direto com fallback `no-cors`** (escolhido): zero peças novas, o disparo é um evento raro e o retorno já chega por outro canal (execuções no banco).
- **Proxy via Edge Function do Supabase**: resposta legível sempre, mas é mais um serviço para manter, com segredo e URL próprios, só para evitar um `fetch` que falha silenciosamente de propósito.

## Consequences

- O `fetch` que "falha" é esperado — quem ler o código vai querer consertá-lo (ver ADR, não é bug).
- O token viaja na query string do webhook: ele é por advogado e revogável (gerar novo), não é credencial de infraestrutura. O n8n valida o token contra o banco antes de qualquer coisa.
