# Publicação com Docker Compose e Portainer

Esta instalação usa login próprio por e-mail e senha. Não depende de ChatGPT para autenticar. O servidor só aceita identidades assinadas pelo gateway; não publique o Worker ou o Vite diretamente.

## Configuração no servidor Linux

Requisitos: Docker Engine com Compose, domínio apontando para o servidor e portas 80/443 disponíveis. Use apenas uma réplica: o banco SQLite fica no volume local. Não use este Compose como stack Swarm.

Na pasta `site` do repositório, crie um arquivo de senha fora do Git. Exemplo no terminal do servidor:

```bash
sudo install -d -m 700 /opt/sol-secrets
read -rsp 'Senha inicial (12 a 128 caracteres): ' SOL_PASSWORD
printf '%s' "$SOL_PASSWORD" | sudo tee /opt/sol-secrets/admin-password >/dev/null
unset SOL_PASSWORD
sudo chown 1000:1000 /opt/sol-secrets/admin-password
sudo chmod 400 /opt/sol-secrets/admin-password
export APP_HOST=contabil.w4solution.com.br
export ADMIN_EMAIL=silvacayke@gmail.com
export ADMIN_PASSWORD_PATH=/opt/sol-secrets/admin-password
export CADDYFILE_PATH="$PWD/Caddyfile"
docker compose config --quiet
docker compose build --pull
docker compose up -d
docker compose ps
```

Domínio e e-mail acima são os definidos para esta instalação. Caddy obtém e renova o certificado HTTPS automaticamente. O serviço da aplicação não publica a porta 8787. O volume persiste folhas, histórico, usuários e sessões. A senha inicial só é usada se não existir nenhuma conta; reiniciar não redefine senhas.

## Portainer

Construa a imagem no mesmo host Docker com o comando acima (`calculos-trabalhistas:1.0`), ou envie-a para seu registry e ajuste `image`. Em Stacks, use o conteúdo de `docker-compose.yml`, retirando apenas `build: .` para usar a imagem pronta. Configure as quatro variáveis APP_HOST, ADMIN_EMAIL, ADMIN_PASSWORD_PATH e CADDYFILE_PATH. Os caminhos dos arquivos devem existir **no host Docker**, não no computador que abre o Portainer. Não cole a senha em variáveis nem no editor da stack. Em atualizações, mantenha o nome da stack para reutilizar o mesmo volume.

Após subir, abra o domínio HTTPS, entre com o administrador e crie a empresa. Em Empresa e acesso, gere convite para o e-mail do contador. Ele usa `/auth/register` com o código. O convite expira em sete dias e só funciona uma vez. Para uma conta existente, entre e aceite o convite dentro do sistema.

## Controles implementados

- Senhas com scrypt e salt individual; mínimo 12 caracteres.
- Cookie HttpOnly, Secure em HTTPS e SameSite; sessão de até oito horas, expira com 30 minutos sem atividade.
- Troca de senha encerra todas as sessões da conta. Sair revoga a sessão no servidor.
- Limitação persistente de tentativas por conta e endereço, verificação de Origin nas alterações e limite de tamanho das requisições.
- Permissões por empresa verificadas no servidor. Remover contador bloqueia consultas e alterações daquela empresa.
- Contêiner da aplicação sem root, sistema de arquivos somente leitura, rede interna e volume separado.

Não há MFA ou recuperação automática por e-mail nesta versão. Para recuperar acesso, coloque a nova senha em arquivo secreto e execute no contêiner:

```bash
docker compose exec calculos-trabalhistas node server/reset-password.mjs silvacayke@gmail.com /run/secrets/admin_password
```

Esse comando usa o conteúdo atual do arquivo e invalida as sessões. Remova permissões de acesso ao Portainer de pessoas que não administram os dados: acesso ao host/volume permite ler o banco. Configure criptografia do disco e backups criptografados no servidor; a aplicação não criptografa o SQLite em repouso.

## Backup e migração

Antes de atualizar, pare `calculos-trabalhistas`, faça uma cópia do volume inteiro `calculos_trabalhistas_data` (nome real prefixado pela stack) e reinicie. Inclua `accounts.sqlite` e toda a pasta `d1`; não copie apenas um arquivo de um banco em execução. Guarde os backups fora do servidor com acesso restrito e teste uma restauração em instalação isolada antes de depender deles. Não execute `docker compose down -v` em produção.

A instalação nova começa vazia. Os dados locais e os lançamentos fictícios não são enviados automaticamente. Para uma migração deliberada: use um backup SQLite consistente da instalação anterior, inicialize a nova instalação uma vez, pare a aplicação e monte o backup como somente leitura em `/migration/legacy.sqlite` num contêiner temporário com o mesmo volume. Execute:

```bash
docker compose run --rm --no-deps -v /caminho/backup.sqlite:/migration/legacy.sqlite:ro --entrypoint node calculos-trabalhistas server/import-legacy.mjs /migration/legacy.sqlite silvacayke@gmail.com local_seedy
```

O último argumento identifica o administrador antigo; confirme-o na origem. O importador exige destino vazio, preserva folhas e histórico e vincula somente as empresas desse administrador à conta indicada. Contadores precisam de novos convites. Revise os dados fictícios antes de usar a base para folha real.

## Verificação antes de liberar acesso

Execute build e testes de autenticação, confira a saúde dos contêineres e valide HTTPS, login, convite e backup/restauração no servidor de destino. O teste HTTP usa banco temporário com dados fictícios e não altera a base da empresa:

```bash
npm ci
npm run build
node tests/auth-security.mjs
node tests/auth-identity.mjs
node tests/gateway-http.mjs
```

Não há garantia de segurança absoluta. Atualize dependências e imagens periodicamente, restrinja o Portainer à administração e monitore disponibilidade e espaço do volume. A configuração HTTPS e o contêiner ainda precisam ser validados no host de publicação.
