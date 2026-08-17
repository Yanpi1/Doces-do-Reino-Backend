# Backend em Java (Maven + Spring Boot) rodando com Docker

O backend foi **reescrito do zero em Java** (Spring Boot, gerenciado via **Maven**),
substituindo o antigo backend PHP. O front-end (HTML/CSS/JS) não mudou — os mesmos
arquivos (`index.html`, `app.js`, `admin.js`, etc.) agora são servidos pelo próprio
processo Java, porque `app.js` já usava o caminho relativo `api/api.php`, que o novo
backend também expõe em `/api/api.php`.

## Estrutura

```
backend-java/            ← projeto Maven (o backend novo)
  pom.xml
  Dockerfile
  src/main/java/...      ← código Java (controllers, config)
  src/main/resources/
    application.properties
    static/              ← front-end EMPACOTADO no jar (é esta cópia que roda de fato)
frontend/                 ← mesma cópia do front-end, só pra facilitar edição/visualização
                             (se editar aqui, também copie pra backend-java/src/main/resources/static/)
legacy-php-backend/       ← backend PHP antigo, mantido só como referência/histórico
docker-compose.yml
```

⚠️ **Importante:** o Spring Boot só serve os arquivos que estão dentro de
`backend-java/src/main/resources/static/` (porque eles ficam empacotados dentro do
`.jar` na hora do build). A pasta `frontend/` na raiz é só uma cópia de conveniência —
se você editar o HTML/CSS/JS, edite (ou copie) para as duas pastas, senão a mudança não
aparece no site.

## Pré-requisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e rodando
- Não precisa ter Java nem Maven instalados na sua máquina — tudo roda dentro do container
  (o `Dockerfile` faz `mvn clean package` na etapa de build).

## Passo a passo

1. (Opcional) copie `.env.example` para `.env` e coloque sua chave do Gemini:
   ```bash
   cp .env.example .env
   ```
2. No terminal do VS Code, na raiz do projeto:
   ```bash
   docker compose up --build
   ```
   A primeira vez demora um pouco mais (o Maven baixa as dependências do Spring Boot
   dentro do container). Nas próximas, fica bem mais rápido por causa do cache de camadas.
3. Acesse:
   - Site: **http://localhost:8080**
   - Painel admin: **http://localhost:8080/admin.html**
   - API: **http://localhost:8080/api/api.php?action=get_produtos**

## Login padrão do admin
Usuário: `admin` — Senha: `admin123` (fallback usado quando não existe a chave
`admin_credentials` na tabela `config`; a verificação usa BCrypt, compatível com hashes
gerados pelo `password_hash()` do PHP).

## Comandos úteis

```bash
docker compose up --build      # builda o jar Java e sobe tudo
docker compose up -d           # sobe em segundo plano
docker compose down            # para os containers
docker compose down -v         # para e APAGA os dados do banco (reset total)
docker compose logs -f web     # ver logs do Spring Boot
docker compose logs -f db      # ver logs do MySQL
```

## ⚠️ Importante: alterou algo no código?

Diferente do PHP (que era interpretado na hora), o Java **precisa ser recompilado**.
Depois de mudar qualquer arquivo em `backend-java/src` (ou mesmo os arquivos de
front-end, já que ficam empacotados dentro do `.jar`), rode:

```bash
docker compose up --build web
```

## O que foi migrado do PHP pro Java

| PHP original                | Equivalente Java                                      |
|------------------------------|--------------------------------------------------------|
| `api/api.php` (roteador)     | `ApiController.java` — mesmo endpoint `/api/api.php?action=...`, mesmas actions |
| `api/chat-proxy.php`         | `ChatProxyController.java` — `/api/chat-proxy.php`, mesma lógica com a API Gemini |
| `api/config.php`             | `application.properties` + `CorsConfig.java` + `JdbcTemplate` (autoconfigurado pelo Spring) |
| `api/banco.sql`              | Reaproveitado como está (fica em `legacy-php-backend/banco.sql`, montado no container do MySQL) |

Todas as *actions* (`get_produtos`, `save_produto`, `delete_produto`, `update_estoque`,
`get_config`, `save_config`, `get_slides`, `save_slide`, `delete_slide`, `get_pedidos`,
`save_pedido`, `update_status_pedido`, `limpar_pedidos`, `login`) foram reescritas com
o mesmo comportamento, parâmetros e formato de resposta JSON do PHP original — então o
front-end não precisou de nenhuma alteração.

## ⚠️ Aviso de segurança (herdado do backend antigo)

O `api/config.php` original (agora em `legacy-php-backend/`) tinha credenciais reais do
InfinityFree hardcoded, e `api/chat-proxy.php` tinha uma chave real da API Gemini também
hardcoded. O novo backend Java não usa mais esses valores fixos — tudo vem de variáveis
de ambiente — mas como essas chaves já estavam expostas no zip original, continua valendo
a recomendação de **trocar/revogar as duas**:
- Senha do banco no painel do InfinityFree
- Chave do Gemini em https://aistudio.google.com/app/apikey (revogar a antiga e gerar outra)
