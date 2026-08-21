package com.docesdoreino.api.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * ReinoGourmet — Proxy da API Google Gemini (reescrito em Java)
 * Equivalente ao antigo api/chat-proxy.php.
 */
@RestController
public class ChatProxyController {

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    @Value("${gemini.api.model:gemini-3.6-flash}")
    private String geminiModel;

    private static final String SYSTEM_PROMPT = """
            Você é a assistente virtual da ReinoGourmet, um projeto solidário da Igreja do Reino em Brasília, DF.
            Seu papel é ajudar clientes com dúvidas, apresentar produtos e incentivar pedidos de forma simpática e acolhedora.

            PRODUTOS DISPONÍVEIS:
            - DinDins Gourmet: picolés artesanais em vários sabores (chocolate, morango, maracujá, uva, limão, etc.)
            - Bolos de Pote: sobremesas em pote com camadas de bolo e recheio cremoso

            INFORMAÇÕES IMPORTANTES:
            - Entregas apenas em Brasília/DF (NÃO mencione Planaltina como área de entrega — apenas Brasília)
            - Foco de atendimento: Samambaia
            - Pagamento via Pix
            - Pedidos: cliente escolhe no cardápio, adiciona ao carrinho e finaliza com nome + contato
            - Telefone: (61) 99279-6430
            - E-mail: yanpietro0101@gmail.com
            - Todo lucro apoia a causa da Igreja do Reino

            REGRAS IMPORTANTES:
            - Seja sempre gentil, use emojis com moderação (máximo 2 por resposta)
            - Responda em português do Brasil
            - Para pedidos: oriente a usar o botão 'Ver Cardápio' na página
            - Não invente preços — diga para verificar no cardápio do site
            - Respostas curtas e diretas (máximo 3 parágrafos curtos)
            - Se não souber algo específico, peça para entrar em contato pelo WhatsApp (61) 99279-6430
            - NUNCA diga que é uma IA do Google ou Gemini — você é a assistente da ReinoGourmet""";

    @PostMapping("/api/chat-proxy.php")
    public ResponseEntity<Object> proxy(@RequestBody(required = false) String rawBody) {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            return error("GEMINI_API_KEY não configurada. Defina no arquivo .env.", 500);
        }

        JsonNode input;
        try {
            input = mapper.readTree(rawBody == null ? "{}" : rawBody);
        } catch (Exception e) {
            return error("Dados inválidos", 400);
        }

        if (input == null || !input.has("messages") || !input.get("messages").isArray()) {
            return error("Dados inválidos", 400);
        }

        ArrayNode messages = (ArrayNode) input.get("messages");
        int from = Math.max(0, messages.size() - 12);

        ArrayNode contents = mapper.createArrayNode();
        for (int i = from; i < messages.size(); i++) {
            JsonNode msg = messages.get(i);
            String role = "assistant".equals(msg.path("role").asText()) ? "model" : "user";
            ObjectNode contentEntry = mapper.createObjectNode();
            contentEntry.put("role", role);
            ArrayNode parts = mapper.createArrayNode();
            ObjectNode part = mapper.createObjectNode();
            part.put("text", msg.path("content").asText(""));
            parts.add(part);
            contentEntry.set("parts", parts);
            contents.add(contentEntry);
        }

        while (!contents.isEmpty() &&
               !"user".equals(contents.get(0).path("role").asText())) {
            contents.remove(0);
        }

        if (contents.isEmpty()) {
            return error("Histórico inválido", 400);
        }
        
        ObjectNode payload = mapper.createObjectNode();
        ObjectNode systemInstruction = mapper.createObjectNode();
        ArrayNode sysParts = mapper.createArrayNode();
        ObjectNode sysPart = mapper.createObjectNode();
        sysPart.put("text", SYSTEM_PROMPT);
        sysParts.add(sysPart);
        systemInstruction.set("parts", sysParts);
        payload.set("system_instruction", systemInstruction);
        payload.set("contents", contents);
        ObjectNode genConfig = mapper.createObjectNode();
        genConfig.put("maxOutputTokens", 400);
        genConfig.put("temperature", 0.7);
        payload.set("generationConfig", genConfig);

        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + geminiModel + ":generateContent?key=" + geminiApiKey;

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
                    .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());

            JsonNode geminiData = mapper.readTree(response.body());
            if (response.statusCode() != 200 || !geminiData.has("candidates")
                    || geminiData.get("candidates").isEmpty()) {
                String details = geminiData.path("error").path("message").asText("Resposta inesperada");
                Map<String, Object> body = new LinkedHashMap<>();
                body.put("error", "Erro na API Gemini");
                body.put("details", details);
                return ResponseEntity.status(response.statusCode() != 200 ? response.statusCode() : 500).body(body);
            }

            String text = geminiData.at("/candidates/0/content/parts/0/text").asText("");
            if (text.isEmpty()) {
                return error("Resposta vazia da IA", 500);
            }

            Map<String, Object> textPart = Map.of("type", "text", "text", text);
            return ResponseEntity.ok(Map.of("content", List.of(textPart)));

        } catch (Exception e) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("error", "Chamada externa bloqueada ou falhou.");
            body.put("dica", "Verifique a rede do container e a validade da GEMINI_API_KEY.");
            return ResponseEntity.status(500).body(body);
        }
    }

    private ResponseEntity<Object> error(String message, int code) {
        return ResponseEntity.status(HttpStatus.valueOf(code)).body(Map.of("error", message));
    }
}
