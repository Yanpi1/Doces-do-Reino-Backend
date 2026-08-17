package com.docesdoreino.api.web;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.text.SimpleDateFormat;
import java.util.*;

/**
 * IGREJA DO REINO — API PRINCIPAL (Java)
 * Endpoint único: /api/api.php?action=...
 * Reescrita 1:1 do antigo api/api.php em PHP, mantendo o mesmo contrato
 * (mesmas actions, mesmos parâmetros, mesmo formato de resposta) para que
 * o front-end (app.js / admin.js) continue funcionando sem nenhuma alteração.
 */
@RestController
public class ApiController {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper = new ObjectMapper();
    private static final List<String> STATUS_VALIDOS =
            List.of("pendente", "confirmado", "entregue", "cancelado");
    private static final List<String> LOGO_KEYS =
            List.of("logo", "logo_header", "logo_sobre");

    @Autowired
    public ApiController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @RequestMapping(value = "/api/api.php",
            method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT})
    public ResponseEntity<Object> handle(@RequestParam(value = "action", required = false) String action,
                                          @RequestParam Map<String, String> allParams,
                                          @RequestBody(required = false) String rawBody) {
        Map<String, Object> input = parseBody(rawBody);
        if (action == null) action = "";

        try {
            return switch (action) {
                // ==================== PRODUTOS ====================
                case "get_produtos" -> ok(jdbc.queryForList(
                        "SELECT * FROM produtos ORDER BY ordem ASC, id ASC"));

                case "save_produto" -> saveProduto(input);
                case "delete_produto" -> deleteProduto(input);
                case "update_estoque" -> updateEstoque(input);

                // ==================== CONFIG ====================
                case "get_config" -> getConfig(allParams.get("chave"));
                case "save_config" -> saveConfig(input);

                // ==================== SLIDES ====================
                case "get_slides" -> ok(jdbc.queryForList(
                        "SELECT * FROM slides ORDER BY ordem ASC, id ASC"));
                case "save_slide" -> saveSlide(input);
                case "delete_slide" -> deleteSlide(input);

                // ==================== PEDIDOS ====================
                case "get_pedidos" -> getPedidos();
                case "save_pedido" -> savePedido(input);
                case "update_status_pedido" -> updateStatusPedido(input);
                case "limpar_pedidos" -> {
                    jdbc.update("DELETE FROM pedidos");
                    yield ok(Map.of("ok", true));
                }

                // ==================== AUTH ====================
                case "login" -> login(input);

                default -> error("Ação não reconhecida: " + action, 404);
            };
        } catch (Exception e) {
            return error("Erro interno: " + e.getMessage(), 500);
        }
    }

    // ==================== PRODUTOS ====================

    private ResponseEntity<Object> saveProduto(Map<String, Object> input) {
        String nome = str(input, "nome").trim();
        String desc = str(input, "desc").trim();
        double preco = num(input, "preco");
        int estoque = (int) num(input, "estoque");
        String imagem = str(input, "imagem").trim();
        String emoji = input.get("emoji") != null && !str(input, "emoji").isBlank()
                ? str(input, "emoji").trim() : "🍨";
        int id = (int) num(input, "id");

        if (nome.isEmpty() || preco < 0) {
            return error("Nome e preço são obrigatórios.", 400);
        }

        if (id > 0) {
            jdbc.update("UPDATE produtos SET nome=?, \"desc\"=?, preco=?, estoque=?, imagem=?, emoji=? WHERE id=?",
                    nome, desc, preco, estoque, imagem, emoji, id);
            return ok(Map.of("ok", true, "id", id));
        } else {
            KeyHolder kh = new GeneratedKeyHolder();
            jdbc.update(con -> {
                PreparedStatement ps = con.prepareStatement(
                        "INSERT INTO produtos (nome, \"desc\", preco, estoque, imagem, emoji) VALUES (?,?,?,?,?,?)",
                        Statement.RETURN_GENERATED_KEYS);
                ps.setString(1, nome);
                ps.setString(2, desc);
                ps.setDouble(3, preco);
                ps.setInt(4, estoque);
                ps.setString(5, imagem);
                ps.setString(6, emoji);
                return ps;
            }, kh);
            return ok(Map.of("ok", true, "id", keyOf(kh)));
        }
    }

    private ResponseEntity<Object> deleteProduto(Map<String, Object> input) {
        int id = (int) num(input, "id");
        if (id == 0) return error("ID inválido.", 400);
        jdbc.update("DELETE FROM produtos WHERE id=?", id);
        return ok(Map.of("ok", true));
    }

    @SuppressWarnings("unchecked")
    private ResponseEntity<Object> updateEstoque(Map<String, Object> input) {
        Object itensObj = input.get("itens");
        List<Map<String, Object>> itens = itensObj instanceof List
                ? (List<Map<String, Object>>) itensObj : List.of();
        for (Map<String, Object> item : itens) {
            int qty = (int) num(item, "qty");
            int id = (int) num(item, "id");
            jdbc.update("UPDATE produtos SET estoque = GREATEST(0, estoque - ?) WHERE id=?", qty, id);
        }
        return ok(Map.of("ok", true));
    }

    // ==================== CONFIG ====================

    private ResponseEntity<Object> getConfig(String chave) {
        if (chave == null || chave.isBlank()) return error("Chave nao informada.", 400);
        List<String> rows = jdbc.query("SELECT valor FROM config WHERE chave=?",
                (rs, i) -> rs.getString("valor"), chave);
        String valor = rows.isEmpty() ? "" : (rows.get(0) == null ? "" : rows.get(0));

        // Chaves de logo sao sempre string pura - nunca decodificar como JSON
        if (LOGO_KEYS.contains(chave)) {
            return ok(valor);
        }
        // Demais chaves: tenta JSON, senao devolve string
        if (!valor.isEmpty()) {
            try {
                Object decoded = mapper.readValue(valor, Object.class);
                return ok(decoded);
            } catch (Exception ignored) {
                // não é JSON válido, devolve string mesmo
            }
        }
        return ok(valor);
    }

    private ResponseEntity<Object> saveConfig(Map<String, Object> input) throws Exception {
        String chave = str(input, "chave").trim();
        Object valor = input.containsKey("valor") ? input.get("valor") : "";
        if (chave.isEmpty()) return error("Chave não informada.", 400);

        String valorStr = (valor == null) ? "" : (valor instanceof String ? (String) valor : mapper.writeValueAsString(valor));
        jdbc.update("INSERT INTO config (chave, valor) VALUES (?,?) " +
                        "ON CONFLICT (chave) DO UPDATE SET valor=EXCLUDED.valor, atualizado=CURRENT_TIMESTAMP",
                chave, valorStr);
        return ok(Map.of("ok", true));
    }

    // ==================== SLIDES ====================

    private ResponseEntity<Object> saveSlide(Map<String, Object> input) {
        String titulo = str(input, "titulo").trim();
        String desc = str(input, "desc").trim();
        Object precoRaw = input.get("preco");
        Double preco = (precoRaw == null || "".equals(precoRaw)) ? null : num(input, "preco");
        String imagem = str(input, "imagem").trim();
        String emoji = input.get("emoji") != null && !str(input, "emoji").isBlank()
                ? str(input, "emoji").trim() : "🍨";
        int id = (int) num(input, "id");

        if (titulo.isEmpty()) return error("Título obrigatório.", 400);

        if (id > 0) {
            jdbc.update("UPDATE slides SET titulo=?, \"desc\"=?, preco=?, imagem=?, emoji=? WHERE id=?",
                    titulo, desc, preco, imagem, emoji, id);
            return ok(Map.of("ok", true, "id", id));
        } else {
            KeyHolder kh = new GeneratedKeyHolder();
            Double precoFinal = preco;
            jdbc.update(con -> {
                PreparedStatement ps = con.prepareStatement(
                        "INSERT INTO slides (titulo, \"desc\", preco, imagem, emoji) VALUES (?,?,?,?,?)",
                        Statement.RETURN_GENERATED_KEYS);
                ps.setString(1, titulo);
                ps.setString(2, desc);
                if (precoFinal == null) ps.setNull(3, java.sql.Types.DECIMAL);
                else ps.setDouble(3, precoFinal);
                ps.setString(4, imagem);
                ps.setString(5, emoji);
                return ps;
            }, kh);
            return ok(Map.of("ok", true, "id", keyOf(kh)));
        }
    }

    private ResponseEntity<Object> deleteSlide(Map<String, Object> input) {
        int id = (int) num(input, "id");
        if (id == 0) return error("ID inválido.", 400);
        jdbc.update("DELETE FROM slides WHERE id=?", id);
        return ok(Map.of("ok", true));
    }

    // ==================== PEDIDOS ====================

    private ResponseEntity<Object> getPedidos() throws Exception {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM pedidos ORDER BY criado DESC");
        SimpleDateFormat out = new SimpleDateFormat("dd/MM/yyyy HH:mm");
        for (Map<String, Object> row : rows) {
            Object itensRaw = row.get("itens");
            String itensStr = itensRaw == null ? "[]" : itensRaw.toString();
            try {
                row.put("itens", mapper.readValue(itensStr, Object.class));
            } catch (Exception e) {
                row.put("itens", List.of());
            }
            Object criado = row.get("criado");
            if (criado instanceof Timestamp ts) {
                row.put("data", out.format(ts));
            }
        }
        return ok(rows);
    }

    private ResponseEntity<Object> savePedido(Map<String, Object> input) throws Exception {
        String nome = str(input, "nome").trim();
        String contato = str(input, "contato").trim();
        String contatoTipo = str(input, "contatoTipo").trim();
        String itensJson = mapper.writeValueAsString(
                input.get("itens") != null ? input.get("itens") : List.of());
        double total = num(input, "total");

        if (nome.isEmpty()) return error("Nome obrigatório.", 400);

        KeyHolder kh = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(
                    "INSERT INTO pedidos (nome, contato, contato_tipo, itens, total) VALUES (?,?,?,?,?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, nome);
            ps.setString(2, contato);
            ps.setString(3, contatoTipo);
            ps.setString(4, itensJson);
            ps.setDouble(5, total);
            return ps;
        }, kh);
        return ok(Map.of("ok", true, "id", keyOf(kh)));
    }

    private ResponseEntity<Object> updateStatusPedido(Map<String, Object> input) {
        int id = (int) num(input, "id");
        String status = input.get("status") != null ? str(input, "status") : "pendente";
        if (id == 0 || !STATUS_VALIDOS.contains(status)) return error("Dados inválidos.", 400);
        jdbc.update("UPDATE pedidos SET status=? WHERE id=?", status, id);
        return ok(Map.of("ok", true));
    }

    // ==================== AUTH ====================

    @SuppressWarnings("unchecked")
    private ResponseEntity<Object> login(Map<String, Object> input) {
        String user = str(input, "user").trim();
        String pass = str(input, "pass");

        List<String> rows = jdbc.query(
                "SELECT valor FROM config WHERE chave='admin_credentials'",
                (rs, i) -> rs.getString("valor"));

        boolean ok;
        if (!rows.isEmpty() && rows.get(0) != null) {
            try {
                Map<String, Object> creds = mapper.readValue(rows.get(0), new TypeReference<>() {});
                String expectedUser = creds.get("user") != null ? creds.get("user").toString() : "admin";
                String hash = creds.get("hash") != null ? creds.get("hash").toString() : "";
                // password_hash() do PHP gera prefixo $2y$; a lib de BCrypt do Java espera $2a$.
                String normalizedHash = hash.startsWith("$2y$") ? "$2a$" + hash.substring(4) : hash;
                ok = user.equals(expectedUser) && !hash.isEmpty() && BCrypt.checkpw(pass, normalizedHash);
            } catch (Exception e) {
                ok = false;
            }
        } else {
            // Fallback padrão: admin / admin123
            ok = user.equals("admin") && pass.equals("admin123");
        }

        if (ok) return ok(Map.of("ok", true));
        return error("Usuário ou senha incorretos.", 401, Map.of("ok", false));
    }

    // ==================== HELPERS ====================

    private Map<String, Object> parseBody(String rawBody) {
        if (rawBody == null || rawBody.isBlank()) return new HashMap<>();
        try {
            return mapper.readValue(rawBody, new TypeReference<>() {});
        } catch (Exception e) {
            return new HashMap<>();
        }
    }

    private String str(Map<String, Object> input, String key) {
        Object v = input.get(key);
        return v == null ? "" : v.toString();
    }

    private double num(Map<String, Object> input, String key) {
        Object v = input.get(key);
        if (v == null) return 0;
        if (v instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(v.toString());
        } catch (Exception e) {
            return 0;
        }
    }

    private int keyOf(KeyHolder kh) {
        Number key = kh.getKey();
        return key == null ? 0 : key.intValue();
    }

    private ResponseEntity<Object> ok(Object data) {
        return ResponseEntity.ok(data);
    }

    private ResponseEntity<Object> error(String message, int code) {
        return ResponseEntity.status(HttpStatus.valueOf(code)).body(Map.of("error", message));
    }

    private ResponseEntity<Object> error(String message, int code, Map<String, Object> extra) {
        Map<String, Object> body = new LinkedHashMap<>(extra);
        body.put("error", message);
        return ResponseEntity.status(HttpStatus.valueOf(code)).body(body);
    }
}
