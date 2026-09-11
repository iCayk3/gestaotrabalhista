# SOL — Gestão trabalhista

Para autenticação própria, HTTPS e instalação no Portainer, siga [DEPLOYMENT.md](DEPLOYMENT.md). Essa configuração substitui as instruções antigas da plataforma.

## Fluxo principal atualizado

A operação agora acontece em três telas dentro de Gestão da folha:

1. **Colaboradores:** matrícula, nome, cargo, setor, admissão e desligamento. Contratos com vigência, salário, divisor de jornada, periculosidade ou insalubridade, anuênio automático, opção de adicional noturno e outro adicional fixo identificado.
2. **Lançamentos mensais:** selecionar competência e colaborador. O contrato vigente é copiado para o lançamento; informar quantidades de horas extras 50% e 100%, horas noturnas efetivas (conversão automática), bonificações, comissões, feriados e calendário, descontos, adiantamentos e bases confirmadas. Salvar abre a tela de resultados.
3. **Resultados:** bruto, adicionais, horas extras e DSR calculados, INSS, IRRF informado, líquido preliminar, valor pago, diferenças e pendências. Memória detalhada e CSV da competência selecionada.

Nenhuma importação de planilha é necessária ou oferecida no fluxo. O importador antigo permanece apenas no código como referência; não está acessível na interface. Os registros antigos continuam preservados.

Salário e adicionais mudam por vigência. Alterar o cadastro não recalcula silenciosamente os meses já salvos. Para uma correção histórica, abrir o mês, usar Reaplicar contrato vigente, revisar as bases e salvar com justificativa. Mês novo não copia bonificações ou horas extras de meses anteriores.

Horas extras são calculadas pela base remuneratória confirmada dividida pelo divisor, multiplicada pela quantidade e pelo fator 1,5 ou 2. A base inicial inclui salário e adicionais fixos cadastrados e deve ser conferida. Insalubridade usa base explicitamente informada. A contagem de DSR considera domingos, feriados informados sem duplicação e sábado útil; o contador pode ajustar a jornada. Nos novos lançamentos, o adicional noturno urbano aplica 20% e converte horas efetivas entre 22h e 5h pelo fator 60/52,5, sem intervalos. Registros anteriores preservam horas já convertidas. Reaplicar o contrato converte a quantidade antiga para a nova unidade ou zera quando não há direito cadastrado. Não transforma registros de ponto. DSR de comissões/outras verbas e regimes especiais ainda exigem tratamento específico. IRRF continua informado pelo contador. Competências de admissão requerem revisão da proporcionalidade. Não é uma cobertura automática de todas as hipóteses da CLT.

Testes atualizados: `node tests/run-calculations.mjs` e `node tests/api-direct.mjs`. O primeiro substitui a execução direta do teste do motor por empacotamento das dependências TypeScript; ambos são locais e usam dados fictícios.

As seções abaixo documentam a base anterior e as limitações da apuração; o fluxo acima prevalece sobre instruções antigas de importação.

Aplicativo web de conferência assistida baseado no modelo SOL fornecido. O diretório `site` contém o aplicativo. Os dados de colaboradores não fazem parte do código-fonte nem do pacote publicado.

## Uso

1. Entre com seu e-mail e senha e crie sua empresa.
2. Em Empresa e acesso, confira município, UF e convenção coletiva aplicável.
3. Importe o arquivo XLSX no formato SOL. A prévia informa meses importados e meses de salário zero ignorados. O importador atual suporta um colaborador na aba Planilha1, conforme o arquivo de referência. Importe outros arquivos ou crie lançamentos manualmente.
4. Revise as competências: incidências, base de INSS, IRRF apurado, calendário, descontos e valor comprovadamente pago.
5. Salve com justificativa. Consulte as versões anteriores em Histórico. Exportar conferência gera um CSV com os filtros atuais e identificação de pendências.
6. Gere convite para o e-mail do contador. Ele poderá criar a conta em `/auth/register`; se já tiver conta, poderá aceitar o código dentro do aplicativo. Nenhum convite é enviado por e-mail automaticamente.

## Escopo contábil desta versão

- INSS de empregado em 2026, progressivo, com truncamento em duas casas decimais por faixa conforme o Manual de Orientação do eSocial. Base de R$ 2.329,00 resulta em R$ 185,29. Motor sol-2026.4 corrige o arredondamento anterior; a memória recalculada pode diferir de snapshots históricos preservados.
- Periculosidade de 30% sobre salário-base, somente quando marcada como aplicável pelo responsável.
- Anuênio automático nos novos lançamentos: salário × anos completos no final da competência × 1%. Não faz rateio intramês. A premissa de 1% vem da planilha e fica pendente de validação da convenção; não constitui direito geral da CLT. Meses anteriores preservam sua regra registrada.
- Horas extras recebem valores monetários já apurados. DSR recebe dias úteis e repousos/feriados sem duplicidade, informados e conferidos pelo contador.
- Desconto de faltas e DSR informado em reais. Não aplica automaticamente a base de desconto duvidosa do modelo original.
- IRRF é informado pelo contador, inclusive zero. Base de INSS sugerida é preliminar e não substitui classificação de incidências.
- Férias e 13º são simuladores de valores brutos com remuneração e médias informadas. Não calculam períodos aquisitivos, afastamentos, rescisões, médias históricas automaticamente, abono ou descontos específicos.
- Não gera eSocial, guias, contracheques oficiais, FGTS ou encargos patronais. Não calcula múltiplos vínculos. Anos diferentes de 2026 ficam sem líquido calculado até haver tabela apropriada.
- Uma diferença positiva é saldo a conferir; não é ordem de pagar. Diferença negativa não autoriza desconto ou recuperação automática.
- Limite inicial de 500 lançamentos por empresa e 20 empresas administradas por usuário. Identificação por nome e competência: para homônimos, inclua matrícula no nome de exibição.

## Segurança e dados

Autenticação própria por e-mail e senha no gateway Node. Autorização por associação entre usuário e empresa, verificada no servidor. Administrador gerencia regras e acessos; contador revisa lançamentos. SQL parametrizado, bloqueio de requisições de origem externa, limites e validação no servidor. Convites são vinculados ao e-mail autenticado, expiram em 7 dias e têm somente seu hash salvo. Remoção de acesso invalida convites da empresa.

Dados persistidos em D1; o navegador não é fonte de armazenamento da folha. Arquivos XLSX são lidos localmente no navegador, sem executar macros ou fórmulas. Após confirmação, somente os dados estruturados são enviados à empresa online. O arquivo completo não é armazenado. Histórico preserva o estado e a memória de cálculo de cada salvamento, sem rota de alteração ou exclusão do histórico. Edições usam controle de versão para detectar conflito.

Use o gateway com HTTPS conforme DEPLOYMENT.md. O Worker rejeita cabeçalhos de identidade sem assinatura interna. O login simulado foi desativado também no desenvolvimento. Não publique dados pessoais no código nem em exemplos.

Esta primeira versão não constitui certificação LGPD nem auditoria de segurança independente. Antes de operação ampla, definir retenção/exclusão, recuperação de backups e teste de restauração, contratos de tratamento, suporte a desligamentos, monitoramento e revisão independente. Exportações CSV contêm dados pessoais; guarde-as com as mesmas restrições de acesso. A exportação não substitui backup integral do banco.

## Arquitetura e versão desktop

`lib/payroll/engine.ts` concentra as funções de cálculo puras. `lib/payroll/validation.ts` valida entradas. `lib/payroll/import-sol.ts` lê o XLSX sem dependência externa. `app/api/workspace/route.ts` implementa armazenamento e autorização. `db/schema.ts` e `drizzle/` definem o banco e suas migrações. `app/workspace.tsx` implementa a interface.

Uma futura versão desktop pode reutilizar interface e motor em Tauri ou Electron, acessando a mesma API autenticada. Autenticação desktop, armazenamento de credenciais no cofre do sistema, assinatura/atualização do instalador e sincronização offline ainda não foram implementados. Não embutir banco de produção, tokens administrativos ou segredo de autenticação no aplicativo desktop.

## Desenvolvimento e testes

Node 24 ou superior. Instale com `npm run install:ci`, rode `npm run dev`. `npm run build` gera o Worker. Configure `DB` no manifesto do Sites. Gere migrações com `npm run db:generate` e aplique-as localmente pelo Wrangler conforme README do starter. Hospedagem aplica migrações na publicação.

### Portainer / Docker Compose

Siga DEPLOYMENT.md para criar a imagem, configurar domínio e senha por arquivo secreto e subir a stack. Somente Caddy publica portas 80/443. O volume mantém os bancos entre reinícios. Não exponha a porta interna 8787, o Vite ou o Wrangler na internet.

- `node tests/engine.mjs`: limites das faixas de INSS, anuênio histórico, descontos, DSR, férias, 13º e validação.
- `node tests/api-direct.mjs`: usa o código real das rotas com autenticação simulada apenas no processo de teste e SQLite em memória. Testa isolamento, persistência, convites, revogação, controle de versão e CSRF. Não modifica a autenticação do aplicativo.
- `npx tsc --noEmit`: verificação de tipos.

## Fontes verificadas

- INSS: https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal
- CLT: https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm
- Lei 4.090/1962: https://www.planalto.gov.br/ccivil_03/leis/l4090.htm

Convenção coletiva de São João de Pirabas/PA ainda não fornecida. O aplicativo não presume qual sindicato é aplicável somente pelo município.
