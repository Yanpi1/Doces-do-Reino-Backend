<?php
/**
 * ReinoGourmet — Proxy da API Google Gemini (GRATUITA)
 * Compatível com InfinityFree (usa file_get_contents em vez de curl)
 * Coloque este arquivo em: /api/chat-proxy.php
 *
 * ✅ Como obter sua chave GRATUITA:
 *    1. Acesse: https://aistudio.google.com/app/apikey
 *    2. Clique em "Create API Key"
 *    3. Copie a chave e cole abaixo
 *    (Não precisa de cartão de crédito!)
 */

// ── Sua chave da API Google Gemini ────────────────────
// Definida via variável de ambiente GEMINI_API_KEY (ver docker-compose.yml / .env)
define('GEMINI_API_KEY', getenv('AIzaSyBElfhu5Pl7Msx0GocLQv0EwbKCKViRWts') ?: '');
// ──────────────────────────────────────────────────────

define('GEMINI_MODEL', 'gemini-1.5-flash');

// Segurança: só aceita requisições do próprio domínio
$allowed_origins = [
    'https://' . ($_SERVER['HTTP_HOST'] ?? ''),
    'http://'  . ($_SERVER['HTTP_HOST'] ?? ''),
    'http://localhost',
    'http://127.0.0.1',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins) || empty($origin)) {
    header('Access-Control-Allow-Origin: ' . ($origin ?: '*'));
} else {
    http_response_code(403);
    echo json_encode(['error' => 'Origem não permitida']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

if (!GEMINI_API_KEY) {
    http_response_code(500);
    echo json_encode(['error' => 'GEMINI_API_KEY não configurada. Defina no arquivo .env.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['messages'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Dados inválidos']);
    exit;
}

// ── System prompt ──────────────────────────────────────
$system_prompt = "Você é a assistente virtual da ReinoGourmet, um projeto solidário da Igreja do Reino em Brasília, DF.
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
- NUNCA diga que é uma IA do Google ou Gemini — você é a assistente da ReinoGourmet";

// ── Converter histórico para formato Gemini ────────────
$raw_messages = array_slice($input['messages'], -12);
$contents = [];

foreach ($raw_messages as $msg) {
    $role = ($msg['role'] === 'assistant') ? 'model' : 'user';
    $contents[] = [
        'role'  => $role,
        'parts' => [['text' => $msg['content']]],
    ];
}

if (empty($contents) || $contents[0]['role'] !== 'user') {
    http_response_code(400);
    echo json_encode(['error' => 'Histórico inválido']);
    exit;
}

// ── Payload ────────────────────────────────────────────
$payload = json_encode([
    'system_instruction' => [
        'parts' => [['text' => $system_prompt]],
    ],
    'contents'         => $contents,
    'generationConfig' => [
        'maxOutputTokens' => 400,
        'temperature'     => 0.7,
    ],
]);

// ── Chamar API com file_get_contents ───────────────────
$url = 'https://generativelanguage.googleapis.com/v1beta/models/'
     . GEMINI_MODEL
     . ':generateContent?key='
     . GEMINI_API_KEY;

$context = stream_context_create([
    'http' => [
        'method'        => 'POST',
        'header'        => "Content-Type: application/json\r\n",
        'content'       => $payload,
        'timeout'       => 30,
        'ignore_errors' => true,
    ],
    'ssl' => [
        'verify_peer'      => false,
        'verify_peer_name' => false,
    ],
]);

$response = @file_get_contents($url, false, $context);

// ── Verificar se file_get_contents funcionou ───────────
if ($response === false) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Chamada externa bloqueada pelo servidor.',
        'dica'  => 'O InfinityFree pode estar bloqueando requisições externas. Considere mover o proxy para Vercel ou Render (ambos gratuitos).',
    ]);
    exit;
}

// Pegar HTTP status code real dos headers de resposta
$http_code = 200;
if (isset($http_response_header)) {
    foreach ($http_response_header as $h) {
        if (preg_match('#HTTP/\d+\.\d+\s+(\d+)#', $h, $m)) {
            $http_code = (int) $m[1];
        }
    }
}

// ── Converter resposta Gemini → formato Anthropic ──────
$gemini_data = json_decode($response, true);

if ($http_code !== 200 || empty($gemini_data['candidates'])) {
    http_response_code($http_code ?: 500);
    echo json_encode([
        'error'   => 'Erro na API Gemini',
        'details' => $gemini_data['error']['message'] ?? 'Resposta inesperada',
    ]);
    exit;
}

$text = $gemini_data['candidates'][0]['content']['parts'][0]['text'] ?? '';

if (empty($text)) {
    http_response_code(500);
    echo json_encode(['error' => 'Resposta vazia da IA']);
    exit;
}

// Retornar no formato que o chat-widget.js já espera
http_response_code(200);
echo json_encode([
    'content' => [
        ['type' => 'text', 'text' => $text],
    ],
]);
