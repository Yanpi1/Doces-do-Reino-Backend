# Rodando o backend com Docker (VS Code)

Isso sobe **apenas o backend** (PHP + MySQL) em containers. O front-end (HTML/CSS/JS)
continua sendo os mesmos arquivos de sempre — eles são servidos pelo próprio container
PHP porque `app.js` usa o caminho relativo `api/api.php`.

## Pré-requisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e rodando
- Extensão **Dev Containers** ou **Docker** no VS Code (opcional, só facilita)

## Passo a passo

1. Abra a pasta do projeto no VS Code.
2. (Opcional) copie `.env.example` para `.env` e coloque sua chave do Gemini:
   ```bash
   cp .env.example .env
   ```
3. No terminal do VS Code, na raiz do projeto:
   ```bash
   docker compose up --build
   ```
4. Acesse:
   - Site: **http://localhost:8080**
   - Painel admin: **http://localhost:8080/admin.html**
   - MySQL (se quiser conectar com um cliente externo): `localhost:3306`
     - banco: `doces_do_reino` | usuário: `doces_user` | senha: `doces_pass`

O banco (`api/banco.sql`) é importado automaticamente na primeira vez que o container
do MySQL sobe (tabelas `produtos`, `config`, `pedidos`, `slides` já com os dados iniciais).

## Login padrão do admin
Usuário: `admin` — Senha: `admin123` (definido em `api/api.php`, ação `login`, fallback quando
não existe a chave `admin_credentials` na tabela `config`).

## Comandos úteis

```bash
docker compose up --build      # sobe tudo (primeira vez ou após mudar Dockerfile)
docker compose up -d           # sobe em segundo plano
docker compose down            # para os containers
docker compose down -v         # para e APAGA os dados do banco (reset total)
docker compose logs -f web     # ver logs do PHP/Apache
docker compose logs -f db      # ver logs do MySQL
```

Os arquivos do projeto estão montados como volume dentro do container `web`, então
qualquer alteração que você fizer nos `.php` (ou nos arquivos de front-end) é refletida
na hora, sem precisar rebuildar a imagem.

## ⚠️ Aviso de segurança

O arquivo `api/config.php` original tinha credenciais reais do InfinityFree, e
`api/chat-proxy.php` tinha uma chave real da API Gemini, ambas hardcoded no código.
Isso foi corrigido: agora os dois leem de variáveis de ambiente. Mas como essas
chaves já estavam expostas no zip enviado, **recomendo fortemente que você as troque/revogue**:
- Senha do banco no InfinityFree (painel do InfinityFree)
- Chave do Gemini em https://aistudio.google.com/app/apikey (revogar a antiga e gerar outra)
