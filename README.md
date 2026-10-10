# Obra 128 · Salg Resort — Gestão de Materiais

Sistema responsivo em português para almoxarifado, com banco persistente D1 e autenticação da hospedagem Sites.

## Operação
1. Cadastre material: código único, nome, categoria, unidade, finalidade e mínimo.
2. Registre entrada ou reposição. O saldo começa em zero.
3. Registre entrega: material, quantidade, nome e matrícula do destinatário.
4. Materiais devolvíveis geram custódia com prazo de 24 horas corridas. Consumíveis geram baixa definitiva.
5. Registre devolução total/parcial ou ocorrência na custódia. Devolução parcial preserva o prazo original.
6. Danos retiram itens de circulação e os colocam em manutenção. Perda/extravio são baixas com histórico. Retorno de manutenção repõe o saldo disponível. Reposição é uma nova entrada, sem apagar a perda.
7. Consulte o painel ou emita CSV e relatório de impressão (salvar como PDF).

## Regras
- Datas e horas são geradas no servidor; exibição no horário de Brasília.
- O responsável pelo registro é a identidade autenticada; nome/matrícula são do destinatário.
- O histórico é preservado; não existe exclusão de movimentos pela interface.
- O estoque disponível não inclui itens em custódia ou manutenção.
- Alertas aparecem quando disponível é menor ou igual ao mínimo configurado.
- Atualização automática a cada 30 segundos e botão de atualização manual.
- Alterações simultâneas usam versão com compare-and-swap no D1. A operação em conflito não é aplicada: o operador recebe instrução para revisar o saldo e confirmar novamente.
- Não há dados fictícios no banco. Os dados de testes ficam exclusivamente no processo de teste.
- Período dos relatórios filtra movimentações; estoque e pendências são posição atual.
- Alertas são exibidos no sistema; não há envio automático de mensagens.
- A publicação inicial é privada ao proprietário. O compartilhamento com outras pessoas é feito pelos controles de acesso do Site. Todos os visitantes autorizados nesta versão têm acesso operacional, sem perfis separados de somente leitura.
- Código-fonte também disponível em `Ermes-eksm/Sistema_de_Materiais`. Esta cópia não contém dados operacionais, credenciais ou o identificador privado de hospedagem. Atualizações no GitHub não são publicadas automaticamente no Site.

## Desenvolvimento e validação
- `node tests/domain.test.mjs`: testes de regras de negócio, sem gravar dados reais.
- `npx tsc --noEmit`: verificação de tipos.
- Banco definido em `db/schema.ts`; migrações em `drizzle/`.
- Acesso HTTP autenticado em `app/api/state/route.ts`; domínio em `app/domain.ts`.
- O registro persistido contém o estado e o histórico completos, com versão para controle concorrente.
- A interface não foi validada em navegador nesta sessão por indisponibilidade da ferramenta de controle de navegador exigida pelo ambiente.

## Executar localmente

Use Node.js 22.13 ou superior e pnpm. Instale com `pnpm install`, execute `pnpm dev` e utilize o acesso local de desenvolvimento. Para validar: `node tests/domain.test.mjs` e `pnpm exec tsc --noEmit`. O banco D1 local deve receber a migração em `drizzle/0000_dear_tenebrous.sql` antes das primeiras operações.

## Hospedagem

A aplicação utiliza Worker, autenticação Sites e D1; GitHub Pages sozinho não executa esse backend. Configure uma nova identidade de hospedagem para um novo ambiente. O arquivo `.openai/hosting.json` desta cópia contém apenas as definições de bindings.
