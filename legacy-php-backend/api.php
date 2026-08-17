<?php
// ============================================
//  IGREJA DO REINO — API PRINCIPAL
//  Endpoint único: /api/api.php?action=...
// ============================================

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Lê o body JSON
$input = [];
if (in_array($method, ['POST','PUT'])) {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true) ?? [];
}

// ---- ROTEADOR ----
switch ($action) {

    // ========================
    // PRODUTOS
    // ========================
    case 'get_produtos':
        $db = getDB();
        $rows = $db->query('SELECT * FROM produtos ORDER BY ordem ASC, id ASC')->fetchAll();
        jsonResponse($rows);

    case 'save_produto':
        $db = getDB();
        $nome    = trim($input['nome'] ?? '');
        $desc    = trim($input['desc'] ?? '');
        $preco   = (float)($input['preco'] ?? 0);
        $estoque = (int)($input['estoque'] ?? 0);
        $imagem  = trim($input['imagem'] ?? '');
        $emoji   = trim($input['emoji'] ?? '🍨');
        $id      = (int)($input['id'] ?? 0);

        if (!$nome || $preco < 0) jsonResponse(['error'=>'Nome e preço são obrigatórios.'], 400);

        if ($id > 0) {
            $stmt = $db->prepare('UPDATE produtos SET nome=?, `desc`=?, preco=?, estoque=?, imagem=?, emoji=? WHERE id=?');
            $stmt->execute([$nome, $desc, $preco, $estoque, $imagem, $emoji, $id]);
            jsonResponse(['ok'=>true, 'id'=>$id]);
        } else {
            $stmt = $db->prepare('INSERT INTO produtos (nome, `desc`, preco, estoque, imagem, emoji) VALUES (?,?,?,?,?,?)');
            $stmt->execute([$nome, $desc, $preco, $estoque, $imagem, $emoji]);
            jsonResponse(['ok'=>true, 'id'=>(int)$db->lastInsertId()]);
        }

    case 'delete_produto':
        $db  = getDB();
        $id  = (int)($input['id'] ?? 0);
        if (!$id) jsonResponse(['error'=>'ID inválido.'], 400);
        $db->prepare('DELETE FROM produtos WHERE id=?')->execute([$id]);
        jsonResponse(['ok'=>true]);

    case 'update_estoque':
        // Decrementa estoque de múltiplos produtos ao confirmar pedido
        $db   = getDB();
        $itens = $input['itens'] ?? [];
        foreach ($itens as $item) {
            $db->prepare('UPDATE produtos SET estoque = GREATEST(0, estoque - ?) WHERE id=?')
               ->execute([(int)$item['qty'], (int)$item['id']]);
        }
        jsonResponse(['ok'=>true]);

    // ========================
    // CONFIG (pix, contato, logo, carrossel)
    // ========================
    case 'get_config':
        $db    = getDB();
        $chave = $_GET['chave'] ?? '';
        if (!$chave) jsonResponse(['error' => 'Chave nao informada.'], 400);
        $stmt  = $db->prepare('SELECT valor FROM config WHERE chave=?');
        $stmt->execute([$chave]);
        $row   = $stmt->fetch();
        $valor = $row ? ($row['valor'] ?? '') : '';
        // Chaves de logo sao sempre string pura - nunca decodificar como JSON
        $logoKeys = ['logo', 'logo_header', 'logo_sobre'];
        if (in_array($chave, $logoKeys)) {
            jsonResponse($valor);
        }
        // Demais chaves: tenta JSON, senao devolve string
        $decoded = ($valor !== '') ? json_decode($valor, true) : null;
        jsonResponse($decoded !== null ? $decoded : $valor);

    case 'save_config':
        $db    = getDB();
        $chave = trim($input['chave'] ?? '');
        $valor = $input['valor'] ?? '';
        if (!$chave) jsonResponse(['error'=>'Chave não informada.'], 400);
        // Se valor é array/object, codifica como JSON
        $valorStr = is_string($valor) ? $valor : json_encode($valor, JSON_UNESCAPED_UNICODE);
        $stmt = $db->prepare('INSERT INTO config (chave, valor) VALUES (?,?) ON DUPLICATE KEY UPDATE valor=?');
        $stmt->execute([$chave, $valorStr, $valorStr]);
        jsonResponse(['ok'=>true]);

    // ========================
    // SLIDES (carrossel)
    // ========================
    case 'get_slides':
        $db   = getDB();
        $rows = $db->query('SELECT * FROM slides ORDER BY ordem ASC, id ASC')->fetchAll();
        jsonResponse($rows);

    case 'save_slide':
        $db    = getDB();
        $titulo = trim($input['titulo'] ?? '');
        $desc   = trim($input['desc']   ?? '');
        $preco  = $input['preco'] !== '' ? (float)$input['preco'] : null;
        $imagem = trim($input['imagem'] ?? '');
        $emoji  = trim($input['emoji']  ?? '🍨');
        $id     = (int)($input['id'] ?? 0);

        if (!$titulo) jsonResponse(['error'=>'Título obrigatório.'], 400);

        if ($id > 0) {
            $stmt = $db->prepare('UPDATE slides SET titulo=?, `desc`=?, preco=?, imagem=?, emoji=? WHERE id=?');
            $stmt->execute([$titulo, $desc, $preco, $imagem, $emoji, $id]);
            jsonResponse(['ok'=>true, 'id'=>$id]);
        } else {
            $stmt = $db->prepare('INSERT INTO slides (titulo, `desc`, preco, imagem, emoji) VALUES (?,?,?,?,?)');
            $stmt->execute([$titulo, $desc, $preco, $imagem, $emoji]);
            jsonResponse(['ok'=>true, 'id'=>(int)$db->lastInsertId()]);
        }

    case 'delete_slide':
        $db = getDB();
        $id = (int)($input['id'] ?? 0);
        if (!$id) jsonResponse(['error'=>'ID inválido.'], 400);
        $db->prepare('DELETE FROM slides WHERE id=?')->execute([$id]);
        jsonResponse(['ok'=>true]);

    // ========================
    // PEDIDOS
    // ========================
    case 'get_pedidos':
        $db   = getDB();
        $rows = $db->query('SELECT * FROM pedidos ORDER BY criado DESC')->fetchAll();
        // Parse JSON do campo itens
        foreach ($rows as &$r) {
            $r['itens'] = json_decode($r['itens'] ?? '[]', true);
            $r['data']  = date('d/m/Y H:i', strtotime($r['criado']));
        }
        jsonResponse($rows);

    case 'save_pedido':
        $db   = getDB();
        $nome        = trim($input['nome'] ?? '');
        $contato     = trim($input['contato'] ?? '');
        $tipoContato = trim($input['contatoTipo'] ?? '');
        $itens       = json_encode($input['itens'] ?? [], JSON_UNESCAPED_UNICODE);
        $total       = (float)($input['total'] ?? 0);
        if (!$nome) jsonResponse(['error'=>'Nome obrigatório.'], 400);
        $stmt = $db->prepare('INSERT INTO pedidos (nome, contato, contato_tipo, itens, total) VALUES (?,?,?,?,?)');
        $stmt->execute([$nome, $contato, $tipoContato, $itens, $total]);
        jsonResponse(['ok'=>true, 'id'=>(int)$db->lastInsertId()]);

    case 'update_status_pedido':
        $db     = getDB();
        $id     = (int)($input['id'] ?? 0);
        $status = $input['status'] ?? 'pendente';
        $valid  = ['pendente','confirmado','entregue','cancelado'];
        if (!$id || !in_array($status, $valid)) jsonResponse(['error'=>'Dados inválidos.'], 400);
        $db->prepare('UPDATE pedidos SET status=? WHERE id=?')->execute([$status, $id]);
        jsonResponse(['ok'=>true]);

    case 'limpar_pedidos':
        $db = getDB();
        $db->exec('DELETE FROM pedidos');
        jsonResponse(['ok'=>true]);

    // ========================
    // AUTH (login simples)
    // ========================
    case 'login':
        $user = trim($input['user'] ?? '');
        $pass = $input['pass'] ?? '';
        // Busca na config
        $db   = getDB();
        $stmt = $db->prepare("SELECT valor FROM config WHERE chave='admin_credentials'");
        $stmt->execute();
        $row  = $stmt->fetch();
        if ($row) {
            $creds = json_decode($row['valor'], true);
            $ok = ($user === ($creds['user'] ?? 'admin') && password_verify($pass, $creds['hash'] ?? ''));
        } else {
            // Fallback padrão: admin / admin123
            $ok = ($user === 'admin' && $pass === 'admin123');
        }
        if ($ok) {
            jsonResponse(['ok'=>true]);
        } else {
            jsonResponse(['ok'=>false, 'error'=>'Usuário ou senha incorretos.'], 401);
        }

    default:
        jsonResponse(['error'=>'Ação não reconhecida: ' . $action], 404);
}
