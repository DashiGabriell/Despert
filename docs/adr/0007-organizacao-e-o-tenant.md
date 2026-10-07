---
status: accepted
---

# A organização é o tenant; o advogado solo é uma organização de um membro

Para vender a escritórios e departamentos jurídicos de empresa sem abandonar o advogado solo, o dono dos dados deixa de ser a conta do advogado e passa a ser a **organização**. Prazos, monitoramentos, feriados, configurações da organização e execuções pertencem a ela; as pessoas entram como **membros**, com um **papel**. O solo é só uma organização de um membro, criada junto com a conta, e não vê telas de equipe. Substitui em parte o ADR-0001: o RLS continua sendo a garantia de isolamento, mas a regra passa de "a linha é minha" para "a linha é de uma organização da qual sou membro".

## Considered Options

- **Organização como tenant, solo = organização de 1** (escolhido): um único modelo de dados e de segurança para os três públicos; o que muda entre eles é o plano.
- **Dois produtos (solo e escritório)**: duplicaria telas, regras e robô, e o solo que contrata um sócio precisaria migrar de sistema.
- **Manter o tenant por usuário e compartilhar prazos entre contas**: cada compartilhamento viraria uma exceção no RLS; o prazo continuaria "de alguém" e se perderia quando essa pessoa saísse.

## Decisões que acompanham o modelo

- No código o termo é `organizacao`; na tela, a organização escolhe ser chamada de "Escritório" ou "Departamento jurídico".
- Um login pode ser membro de várias organizações (advogado associado a dois escritórios, correspondente) e troca entre elas por um seletor.
- Papéis: **Administrador**, **Advogado**, **Assistente** e **Leitura**. Todos os membros veem todos os prazos da organização; "Meus prazos" é só um filtro, ligado por padrão.
- Cada prazo tem um **responsável**: o dono da OAB intimada, ou quem cadastrou o processo avulso. Uma publicação que intima duas OABs da mesma organização gera um único prazo, com o primeiro advogado listado como responsável e os demais como "também intimados".
- Quando um membro sai, o monitoramento da OAB dele para; os prazos já capturados ficam na organização e os abertos vão para o Administrador redistribuir.
- O "entrar como" do dev (ADR-0005) continua igual, agora atuando dentro de uma organização.
- Não há monitoramento pelo nome da parte: o volume e os homônimos do DJEN tornam o alerta pouco confiável. O jurídico de empresa monitora pelas OABs dos seus advogados e por número de processo.

## Consequences

- Toda tabela de dados de negócio ganha `organizacao_id` e a policy passa a consultar a pertença do usuário à organização; esquecer uma tabela continua vazando dados, agora entre organizações.
- O robô percorre organizações, não advogados: junta as OABs de todos os membros, deduplica publicações e escolhe o responsável. A escolha da organização certa continua fora do RLS (ADR-0001).
- O limite do Busca agora e o token de webhook passam a ser da organização.
- As contas existentes viram, cada uma, uma organização de um membro no plano Solo; o dev continua fora de qualquer organização.
