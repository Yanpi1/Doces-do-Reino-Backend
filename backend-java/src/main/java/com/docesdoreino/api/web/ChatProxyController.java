package com.docesdoreino.api.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@RestController
@CrossOrigin(
        origins = "*",
        allowedHeaders = "*",
        methods = {
                RequestMethod.POST,
                RequestMethod.OPTIONS
        }
)
public class ChatProxyController {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${groq.api.key:}")
        private String groqApiKey;

    @Value("${groq.api.model:openai/gpt-oss-120b}")
        private String groqModel;

    @PostMapping("/api/chat-proxy.php")
    public ResponseEntity<?> chat(@RequestBody JsonNode request) {

        try {
            if (groqApiKey == null || groqApiKey.isBlank()) {
                return error(
                        "GROQ_API_KEY não configurada",
                        "Configure GROQ_API_KEY no Render.",
                        HttpStatus.INTERNAL_SERVER_ERROR
                );
            }

            JsonNode incomingMessages = request.path("messages");

            if (!incomingMessages.isArray() || incomingMessages.isEmpty()) {
                return error(
                        "Histórico inválido",
                        "Nenhuma mensagem foi enviada.",
                        HttpStatus.BAD_REQUEST
                );
            }

            ArrayNode messages = objectMapper.createArrayNode();

            // Personalidade do assistente
            ObjectNode systemMessage = objectMapper.createObjectNode();
            systemMessage.put("role", "system");
            systemMessage.put(
                    systemMessage.put(
                    "content",
                    """
                    Você é a assistente virtual da Doces do Reino.
                
                    Responda sempre em português do Brasil.
                    Seja simpática, objetiva e natural.
                
                    REGRAS DE FORMATAÇÃO:
                    - Não use tabelas.
                    - Não use caracteres "|" para separar informações.
                    - Não faça blocos enormes de texto.
                    - Use frases curtas.
                    - Quando listar produtos, use no máximo 5 itens por resposta.
                    - Use uma linha por produto.
                    - Formato recomendado:
                      🍫 Nome do produto — R$ 12,90
                    - Se houver muitos produtos, pergunte qual categoria o cliente quer ver.
                    - Não use Markdown complexo.
                    - Não use cabeçalhos gigantes.
                    - Evite repetir informações.
                
                    Ajude com:
                    - produtos
                    - preços
                    - pedidos
                    - Pix
                    - contato
                    - dúvidas sobre a loja
                
                    Se o cliente pedir o cardápio inteiro, não despeje tudo de uma vez.
                    Pergunte qual categoria ele quer: chocolates, brigadeiros, bolos, etc.
                
                    Não invente informações.
                    """
                );

            messages.add(systemMessage);

            // Converte o histórico recebido pelo frontend
            for (JsonNode item : incomingMessages) {

                String role = item.path("role").asText("");
                String content = item.path("content").asText("");

                if (content.isBlank()) {
                    continue;
                }

                // Groq aceita: user / assistant / system
                if (!role.equals("user")
                        && !role.equals("assistant")
                        && !role.equals("system")) {
                    continue;
                }

                ObjectNode msg = objectMapper.createObjectNode();
                msg.put("role", role);
                msg.put("content", content);

                messages.add(msg);
            }

            if (messages.size() <= 1) {
                return error(
                        "Histórico inválido",
                        "Nenhuma mensagem válida encontrada.",
                        HttpStatus.BAD_REQUEST
                );
            }

            ObjectNode body = objectMapper.createObjectNode();

            body.put("model", groqModel);
            body.set("messages", messages);
            body.put("temperature", 0.7);
            body.put("max_tokens", 800);

            HttpHeaders headers = new HttpHeaders();

            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(groqApiKey);

            HttpEntity<String> entity = new HttpEntity<>(
                    objectMapper.writeValueAsString(body),
                    headers
            );

            String url =
                    "https://api.groq.com/openai/v1/chat/completions";

            ResponseEntity<String> groqResponse =
                    restTemplate.exchange(
                            url,
                            HttpMethod.POST,
                            entity,
                            String.class
                    );

            JsonNode json =
                    objectMapper.readTree(groqResponse.getBody());

            String resposta =
                    json.path("choices")
                            .path(0)
                            .path("message")
                            .path("content")
                            .asText("");

            if (resposta.isBlank()) {
                return error(
                        "Resposta vazia da Groq",
                        json.toString(),
                        HttpStatus.BAD_GATEWAY
                );
            }

            Map<String, Object> result = new HashMap<>();

            // Mantenho "reply" para facilitar seu frontend
            result.put("reply", resposta);

            return ResponseEntity.ok(result);

        } catch (HttpClientErrorException e) {

            return error(
                    "Erro na API Groq",
                    e.getResponseBodyAsString(),
                    HttpStatus.BAD_REQUEST
            );

        } catch (Exception e) {

            return error(
                    "Erro interno",
                    e.getMessage(),
                    HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @RequestMapping(
            value = "/api/chat-proxy.php",
            method = RequestMethod.OPTIONS
    )
    public ResponseEntity<Void> options() {
        return ResponseEntity.ok().build();
    }

    private ResponseEntity<Map<String, String>> error(
            String error,
            String details,
            HttpStatus status
    ) {

        Map<String, String> body = new HashMap<>();

        body.put("error", error);
        body.put("details", details == null ? "" : details);

        return ResponseEntity.status(status).body(body);
    }
}
