# Obra 128 · Salg Resort — Gestão de Materiais

Sistema responsivo em português para almoxarifado, com banco persistente D1 e contas próprias por e-mail e senha, sem exigir conta no ChatGPT.

## Operação
1. Cadastre material: código único, nome, categoria, unidade, finalidade e mínimo.
2. Registre entrada ou reposição. O saldo começa em zero.
3. Cadastre o destinatário em Pessoas com nome completo e exatamente os 6 primeiros dígitos do CPF. Depois registre a entrega selecionando material, quantidade e pessoa.
4. Materiais devolvíveis geram custódia com prazo de 24 horas corridas. Consumíveis geram baixa definitiva.
5. Registre devolução total/parcial ou ocorrência na custódia. Devolução parcial preserva o prazo original.
6. Danos retiram itens de circulação e os colocam em manutenção. Perda/extravio são baixas com histórico. Retorno de manutenção repõe o saldo disponível. Reposição é uma nova entrada, sem apagar a perda.
7. Consulte o painel ou emita CSV e relatório de impressão (salvar como PDF).

## Regras
- Datas e horas são geradas no servidor; exibição no horário de Brasília.
- O responsável pelo registro é a conta autenticada do almoxarifado. Destinatários têm identificador interno e prefixo de CPF de seis dígitos (texto, preservando zeros iniciais); nunca é necessário informar CPF completo. Matrículas antigas permanecem identificadas como dados anteriores.
- O histórico é preservado; não existe exclusão de movimentos pela interface.
- O estoque disponível não inclui itens em custódia ou manutenção.
- Alertas aparecem quando disponível é menor ou igual ao mínimo configurado.
- Atualização automática a cada 30 segundos e botão de atualização manual.
- Alterações simultâneas usam versão com compare-and-swap no D1. A operação em conflito não é aplicada: o operador recebe instrução para revisar o saldo e confirmar novamente.
- Não há dados fictícios no banco. Os dados de testes ficam exclusivamente no processo de teste.
- Período dos relatórios filtra movimentações; estoque e pendências são posição atual.
- Alertas são exibidos no sistema; não há envio automático de mensagens.
- A tela de login e cadastro é pública. O estoque só pode ser consultado e alterado com sessão válida. O cadastro de contas é aberto: qualquer pessoa que crie uma conta tem acesso operacional à mesma obra. Não há aprovação de contas nem perfil separado de somente leitura.
- Código mantido no repositório do Site e copiado para `Ermes-eksm/Sistema_de_Materiais`. Alterações no GitHub não são publicadas automaticamente.

## Desenvolvimento e validação
- `node tests/domain.test.mjs`: testes de regras de negócio, sem gravar dados reais.
- `npx tsc --noEmit`: verificação de tipos.
- Banco definido em `db/schema.ts`; migrações em `drizzle/`.
- Acesso HTTP autenticado em `app/api/state/route.ts`; domínio em `app/domain.ts`.
- O registro persistido contém o estado e o histórico completos, com versão para controle concorrente.
- A interface não foi validada em navegador nesta sessão por indisponibilidade da ferramenta de controle de navegador exigida pelo ambiente.

## Contas e recuperação
- Cadastro com nome, e-mail e senha de 12 a 128 caracteres. E-mails são normalizados, mas não há verificação de propriedade por mensagem.
- Senhas protegidas com PBKDF2-SHA256, 100.000 iterações e salt aleatório de 256 bits; senhas não são armazenadas em texto.
- Sessões aleatórias de 256 bits, com hash SHA-256 no banco e cookie HttpOnly, Secure, SameSite=Lax. Validade de 7 dias. Sair invalida a sessão no servidor.
- Cadastro e recuperação exibem um código aleatório uma única vez. O banco guarda somente o hash. O usuário precisa guardar esse código; a aplicação não envia e-mails de recuperação.
- Recuperar a senha invalida sessões anteriores e substitui o código de recuperação.
- Login/cadastro/recuperação têm limitação por origem de rede e e-mail. Identificadores de limite são hashes, não IPs em texto. Requisições de escrita exigem Origin correspondente.
- As migrações acrescentam tabelas de autenticação sem substituir o inventário existente.
- `node tests/auth.test.mjs` testa as rotas com SQLite em memória e as regras de autenticação. Não cria contas na produção.

## Almoxarifado único: SSMA
- Login, cadastro e recuperação direcionam diretamente ao SSMA, sem seleção de área.
- Todas as sessões, inclusive as já existentes, acessam apenas o inventário SSMA (registro 2). Nenhuma nova tabela, migração ou recriação de inventário é necessária.
- Os EPIs, pessoas, saldos, movimentos, pendências e histórico do SSMA são preservados. Contas e senhas também continuam válidas.
- O módulo de materiais gerais foi removido do acesso e da interface. O registro original é mantido como origem de recuperação e não é apagado fisicamente.
- Requisições antigas com área Obra são rejeitadas, evitando que abas antigas registrem operações no SSMA por engano.

## Relatórios de estoque e compra
- Em Relatórios, selecione Estoque atual, Pedido de compra ou Movimentações e pendências. Cada relatório pode ser impresso/salvo como PDF; estoque e pedido têm exportação CSV própria.
- Estoque atual mostra saldo disponível, custódia, manutenção, baixas acumuladas e estoque mínimo do almoxarifado da sessão.
- Pedido de compra usa alvo = mínimo × 1,5 e quantidade a comprar = máximo(0, alvo − disponível). Inclui todos os materiais com mínimo positivo e saldo abaixo do alvo.
- Unidades de contagem reconhecidas (un, unidade, par, kit, caixa, pacote e abreviações) arredondam o alvo e a quantidade para cima até o inteiro. Outras unidades usam até três casas decimais, arredondadas para cima.
- Mínimo zero exclui o item do pedido. Materiais em uso/manutenção não entram no saldo disponível. Emitir o pedido não altera o inventário e não representa compra efetivada.
- Testes: `node tests/purchase.test.mjs`.

## Recuperação do estoque original
Quando o inventário SSMA (registro 2) ainda não existe, a API autenticada copia integralmente o inventário original (registro 1), preservando saldos, identificadores, histórico e versão. A cópia ocorre no banco, sem reconstruir ou expor dados operacionais no código. A origem permanece intacta. A operação é atômica e idempotente; um SSMA já existente nunca é substituído.

## Cópia GitHub
Esta cópia não inclui credenciais, dados operacionais ou o identificador do Site. A aplicação requer backend Worker e D1; não funciona somente no GitHub Pages. Use Node.js 22.13+ e pnpm. Execute `pnpm install`, `pnpm dev` e aplique as migrações D1 em ordem no ambiente local. `pnpm build` gera o Worker. Login em produção exige HTTPS para o cookie seguro.
