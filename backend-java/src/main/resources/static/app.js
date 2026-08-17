// ============================
//  REINO GOURMET — APP.JS
//  v2.0 — Tema Escuro + API real
// ============================

// URL base da API — ajuste se necessário
const API_BASE = 'api/api.php';

// Cache local (evita requisições repetidas na mesma sessão)
let _cache = { produtos: null, pix: null, contato: null, logo_header: null, logo_sobre: null, carrossel: null };
window._produtosCache = [];
function getProdutosSync() { return window._produtosCache || []; }

// ========================
//  DARK MODE
// ========================
function initTheme() {
  const saved = localStorage.getItem('ir_theme') || 'light';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ir_theme', theme);
  // Atualiza ícone do botão (se existir)
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.title = theme === 'dark' ? 'Mudar para claro' : 'Mudar para escuro';
  const icon = document.getElementById('themeToggleIcon');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ========================
//  API HELPERS
// ========================
async function apiGet(action, params = {}) {
  const url = new URL(API_BASE, location.href);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (e) {
    console.error('API GET error:', action, e);
    return null;
  }
}

async function apiPost(action, data = {}) {
  const url = new URL(API_BASE, location.href);
  url.searchParams.set('action', action);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (e) {
    console.error('API POST error:', action, e);
    return null;
  }
}

// ========================
//  DATA ACCESS (com fallback localStorage)
// ========================

async function getProdutos() {
  if (_cache.produtos) return _cache.produtos;
  const data = await apiGet('get_produtos');
  if (data && Array.isArray(data)) {
    _cache.produtos = data;
    window._produtosCache = data;
    return data;
  }
  // Fallback localStorage
  try { const s = localStorage.getItem('ir_produtos'); return s ? JSON.parse(s) : [...PRODUTOS_DEFAULT]; }
  catch { return [...PRODUTOS_DEFAULT]; }
}

async function getPix() {
  if (_cache.pix) return _cache.pix;
  const data = await apiGet('get_config', { chave: 'pix' });
  if (data && data.chave) { _cache.pix = data; return data; }
  try { const s = localStorage.getItem('ir_pix'); return s ? JSON.parse(s) : { ...PIX_DEFAULT }; }
  catch { return { ...PIX_DEFAULT }; }
}

async function getContato() {
  if (_cache.contato) return _cache.contato;
  const data = await apiGet('get_config', { chave: 'contato' });
  if (data && data.tipo) { _cache.contato = data; return data; }
  try { const s = localStorage.getItem('ir_contato'); return s ? JSON.parse(s) : { ...CONTATO_DEFAULT }; }
  catch { return { ...CONTATO_DEFAULT }; }
}

// Logo padrão (usada quando não há logo configurada no painel admin)
const LOGO_DEFAULT = 'assets/logo-doces-do-reino.png';

// Dois logos independentes
async function getLogoHeader() {
  // false = já buscado mas vazio; null = ainda não buscado
  if (_cache.logo_header !== null) return _cache.logo_header || LOGO_DEFAULT;
  const data = await apiGet('get_config', { chave: 'logo_header' });
  const url = (typeof data === 'string') ? data.trim() : '';
  _cache.logo_header = url || false; // false evita nova busca para URL vazia
  return url || LOGO_DEFAULT;
}

async function getLogoSobre() {
  if (_cache.logo_sobre !== null) return _cache.logo_sobre || '';
  const data = await apiGet('get_config', { chave: 'logo_sobre' });
  const url = (typeof data === 'string') ? data.trim() : '';
  _cache.logo_sobre = url || false;
  return url;
}

// Mantém compatibilidade com código antigo (usa logo_header como padrão)
async function getLogo() { return getLogoHeader(); }

async function getCarrossel() {
  if (_cache.carrossel) return _cache.carrossel;

  // Busca config e slides em paralelo
  const [cfg, slides] = await Promise.all([
    apiGet('get_config', { chave: 'carrossel' }),
    apiGet('get_slides')
  ]);

  // cfg pode ser: objeto {ativo, eyebrow, titulo}, null, ou string vazia
  let base = { ativo: false, eyebrow: 'Destaques', titulo: 'Em Destaque' };
  if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
    base = { ...base, ...cfg };
  }

  // slides é sempre array da tabela slides
  base.slides = (slides && Array.isArray(slides)) ? slides : [];

  _cache.carrossel = base;
  return base;
}

function invalidateCache(key = null) {
  if (key) _cache[key] = null;
  else _cache = { produtos: null, pix: null, contato: null, logo_header: null, logo_sobre: null, carrossel: null };
}

// Defaults para fallback
const PRODUTOS_DEFAULT = [
  { id: 1, nome: "DinDin Ninho com Nutella", desc: "Super cremoso, feito com leite Ninho verdadeiro e muita Nutella.", preco: 4.50, emoji: "🍫", imagem: "", estoque: 10 },
  { id: 2, nome: "DinDin Morango Sensação",  desc: "Aquele sabor de morango cremoso com casquinha de chocolate crocante.", preco: 4.00, emoji: "🍓", imagem: "", estoque: 8 },
  { id: 3, nome: "DinDin Paçoca Cremosa",    desc: "Feito com amendoim selecionado, sabor marcante e delicioso.", preco: 3.50, emoji: "🥜", imagem: "", estoque: 5 }
];
const PIX_DEFAULT     = { tipo: "Telefone", chave: "(61) 99279-6430", nome: "ReinoGourmet" };
const CONTATO_DEFAULT = { tipo: "whatsapp", whatsapp: "5561992796430", msgWpp: "Olá! Quero fazer um pedido.", iframe: "", email: "yanpietro0101@gmail.com", assunto: "Pedido ReinoGourmet" };

// ========================
//  LOGO (duas independentes)
// ========================

// Logo do Header/Footer/Login — ícone pequeno
async function renderLogoHeader() {
  const url = await getLogoHeader();
  // Header
  const emojiH = document.getElementById('logoIconEmoji');
  const imgH   = document.getElementById('logoIconImg');
  if (emojiH && imgH) {
    if (url) { imgH.src = url; imgH.style.display = 'block'; emojiH.style.display = 'none'; }
    else      { imgH.style.display = 'none'; emojiH.style.display = 'inline'; }
  }
  // Footer
  const emojiF = document.getElementById('footerLogoEmoji');
  const imgF   = document.getElementById('footerLogoImg');
  if (emojiF && imgF) {
    if (url) { imgF.src = url; imgF.style.display = 'inline-block'; emojiF.style.display = 'none'; }
    else      { imgF.style.display = 'none'; emojiF.style.display = 'inline'; }
  }
  // Login admin
  const emojiL = document.getElementById('loginLogoEmoji');
  const imgL   = document.getElementById('loginLogoImg');
  if (emojiL && imgL) {
    if (url) { imgL.src = url; imgL.style.display = 'block'; emojiL.style.display = 'none'; }
    else      { imgL.style.display = 'none'; emojiL.style.display = 'inline'; }
  }
  // Sidebar admin
  const adminLogo = document.getElementById('adminLogoIcon');
  if (adminLogo) adminLogo.textContent = url ? '' : '⛪';
  const adminLogoImg = document.getElementById('adminLogoImg');
  if (adminLogoImg) {
    if (url) { adminLogoImg.src = url; adminLogoImg.style.display = 'inline-block'; }
    else      { adminLogoImg.style.display = 'none'; }
  }
}

// Logo da seção Sobre — foto grande
async function renderLogoSobre() {
  const url = await getLogoSobre();
  const placeholder = document.getElementById('sobrePlaceholder');
  const sobreImg    = document.getElementById('sobreLogoImg');
  if (placeholder && sobreImg) {
    if (url) { sobreImg.src = url; sobreImg.style.display = 'block'; placeholder.style.display = 'none'; }
    else      { sobreImg.style.display = 'none'; placeholder.style.display = 'flex'; }
  }
}

// Renderiza ambas (conveniente para o init)
async function renderLogo() {
  await Promise.all([renderLogoHeader(), renderLogoSobre()]);
}

// ========================
//  CARROSSEL
// ========================
let carrosselIdx = 0;

async function renderCarrossel() {
  const wrap = document.getElementById('carrosselWrap');
  if (!wrap) return;
  const cfg = await getCarrossel();
  if (!cfg.ativo || !cfg.slides || cfg.slides.length === 0) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';
  document.getElementById('carrosselEyebrow').textContent = cfg.eyebrow || 'Destaques';
  document.getElementById('carrosselTitulo').textContent  = cfg.titulo  || 'Em Destaque';

  const track = document.getElementById('carrosselTrack');
  track.innerHTML = cfg.slides.map((s) => `
    <div class="carrossel-slide">
      <div class="carrossel-img-wrap">
        ${s.imagem ? `<img src="${s.imagem}" alt="${s.titulo}">` : `<div class="carrossel-emoji">${s.emoji || '🍨'}</div>`}
      </div>
      ${s.imagem ? '<div class="carrossel-img-overlay-slide"></div>' : ''}
      <div class="carrossel-info">
        <div class="carrossel-slide-titulo">${s.titulo}</div>
        <div class="carrossel-slide-desc">${s.desc || ''}</div>
        ${s.preco ? `<div class="carrossel-slide-preco">R$ ${parseFloat(s.preco).toFixed(2).replace('.',',')}</div>` : ''}
      </div>
    </div>`).join('');

  const dots = document.getElementById('carrosselDots');
  dots.innerHTML = cfg.slides.map((_, i) => `<span class="carrossel-dot${i===0?' active':''}" onclick="carrosselGoTo(${i})"></span>`).join('');

  carrosselIdx = 0;
  _carrosselTotal = cfg.slides.length;
  carrosselUpdate();
}

function carrosselUpdate() {
  const track = document.getElementById('carrosselTrack');
  if (track) track.style.transform = `translateX(-${carrosselIdx * 100}%)`;
  document.querySelectorAll('.carrossel-dot').forEach((d, i) => d.classList.toggle('active', i === carrosselIdx));
}

// Total de slides (atualizado ao renderizar)
let _carrosselTotal = 0;

async function carrosselNext() {
  if (_carrosselTotal < 2) return;
  carrosselIdx = (carrosselIdx + 1) % _carrosselTotal;
  carrosselUpdate();
}

async function carrosselPrev() {
  if (_carrosselTotal < 2) return;
  carrosselIdx = (carrosselIdx - 1 + _carrosselTotal) % _carrosselTotal;
  carrosselUpdate();
}

function carrosselGoTo(i) { carrosselIdx = i; carrosselUpdate(); }

// Auto-play (usa _carrosselTotal em vez de re-buscar da API)
setInterval(() => {
  if (_carrosselTotal > 1 && document.getElementById('carrosselWrap')?.style.display !== 'none') {
    carrosselNext();
  }
}, 4500);

// ========================
//  MAPA MODAL
// ========================
function abrirMapa() { document.getElementById('mapaModal')?.classList.add('open'); }
function fecharMapa() { document.getElementById('mapaModal')?.classList.remove('open'); }

// ========================
//  CHECKOUT CONTATO TIPO
// ========================
let contatoTipoAtual = 'whatsapp';

function setContatoTipo(tipo) {
  contatoTipoAtual = tipo;
  document.querySelectorAll('.contato-tipo-btn').forEach(b => b.classList.remove('active'));
  const map = { whatsapp: 'btnContatoWpp', telefone: 'btnContatoTel', email: 'btnContatoEmail' };
  document.getElementById(map[tipo])?.classList.add('active');
  const placeholders = { whatsapp: 'Ex: (61) 99999-9999', telefone: 'Ex: (61) 99999-9999', email: 'Ex: seuemail@exemplo.com' };
  document.getElementById('clientContato').placeholder = placeholders[tipo] || '';
}

// ========================
//  CARRINHO
// ========================
let cart = {};

async function addToCart(id) {
  const produtos = await getProdutos();
  const p = produtos.find(x => x.id == id);
  if (!p) return;
  const noCarrinho = cart[id] || 0;
  if (p.estoque !== undefined && noCarrinho >= p.estoque) return;
  cart[id] = noCarrinho + 1;
  updateCartUI();
}

function removeFromCart(id) {
  if (cart[id] > 1) cart[id]--;
  else delete cart[id];
  updateCartUI();
}

function removeItemCompletely(id) { delete cart[id]; updateCartUI(); }

async function cartTotal() {
  const produtos = await getProdutos();
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = produtos.find(x => x.id == id);
    return sum + (p ? p.preco * qty : 0);
  }, 0);
}

function cartCount() { return Object.values(cart).reduce((s, v) => s + v, 0); }
function formatMoney(val) { return 'R$ ' + parseFloat(val).toFixed(2).replace('.', ','); }

async function updateCartUI() {
  const el = document.getElementById('cartCount');
  if (el) el.textContent = cartCount();
  await renderCartItems();
  await renderProdutos();
}

async function renderCartItems() {
  const cartItems   = document.getElementById('cartItems');
  const cartFooter  = document.getElementById('cartFooter');
  const cartTotalEl = document.getElementById('cartTotal');
  if (!cartItems) return;

  const produtos = await getProdutos();
  const entries  = Object.entries(cart).filter(([, qty]) => qty > 0);

  if (entries.length === 0) {
    cartItems.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-circle">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" stroke-width="1.5" stroke-linecap="round">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          <div class="cart-empty-badge">0</div>
        </div>
        <p class="cart-empty-title">Carrinho vazio</p>
        <p class="cart-empty-sub">Adicione DinDins ou Bolos de Pote para fazer seu pedido!</p>
        <a href="#produtos" class="cart-empty-btn" onclick="closeCartPanel()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>
          Ver Cardápio
        </a>
        <div class="cart-empty-hints">
          <div class="cart-empty-hint">
            <div class="cart-empty-hint-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A07840" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
            </div>
            <div><span>Pagamento via Pix</span><br>Rápido e seguro</div>
          </div>
          <div class="cart-empty-hint">
            <div class="cart-empty-hint-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A07840" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            </div>
            <div><span>Entrega em Brasília/DF</span><br>Foco em Samambaia</div>
          </div>
        </div>
      </div>`;
    if (cartFooter) cartFooter.style.display = 'none';
    return;
  }

  if (cartFooter) cartFooter.style.display = 'block';
  const total = await cartTotal();
  if (cartTotalEl) cartTotalEl.textContent = formatMoney(total);

  cartItems.innerHTML = entries.map(([id, qty]) => {
    const p = produtos.find(x => x.id == id);
    if (!p) { delete cart[id]; return ''; }
    const imgEl = p.imagem
      ? `<div class="cart-item-img"><img src="${p.imagem}" alt="${p.nome}"></div>`
      : `<div class="cart-item-img emoji">${p.emoji || '🍨'}</div>`;
    return `
      <div class="cart-item">
        ${imgEl}
        <div class="cart-item-info">
          <div class="cart-item-nome">${p.nome}</div>
          <div class="cart-item-preco">${qty}× ${formatMoney(p.preco)}</div>
        </div>
        <div class="cart-item-ctrl">
          <button class="qty-btn-sm" onclick="removeFromCart(${id})">−</button>
          <span>${qty}</span>
          <button class="qty-btn-sm" onclick="addToCart(${id})">+</button>
        </div>
        <button class="cart-item-remove" onclick="removeItemCompletely(${id})" title="Remover">✕</button>
      </div>`;
  }).join('');
}

function toggleCart() {
  if (cartCount() > 0) goToCheckout();
  else {
    document.getElementById('cartPanel')?.classList.toggle('open');
    document.getElementById('cartOverlay')?.classList.toggle('open');
  }
}

function closeCartPanel() {
  document.getElementById('cartPanel')?.classList.remove('open');
  document.getElementById('cartOverlay')?.classList.remove('open');
}

// ========================
//  RENDER PRODUTOS
// ========================
async function renderProdutos() {
  const grid = document.getElementById('produtosGrid');
  if (!grid) return;

  const produtos = await getProdutos();
  if (produtos.length === 0) {
    grid.innerHTML = '<p class="empty-state">Nenhum produto cadastrado ainda.</p>';
    return;
  }

  grid.innerHTML = produtos.map(p => {
    const qty = cart[p.id] || 0;
    const esgotado = p.estoque !== undefined && p.estoque <= 0;
    const limiteAtingido = p.estoque !== undefined && qty >= p.estoque;

    const imgEl = p.imagem
      ? `<div class="produto-img"><img src="${p.imagem}" alt="${p.nome}"><div class="produto-img-overlay"></div></div>`
      : `<div class="produto-img emoji-bg"><span class="produto-emoji">${p.emoji || '🍨'}</span></div>`;

    const estoqueTag = esgotado
      ? `<div class="estoque-tag esgotado">Esgotado</div>`
      : p.estoque !== undefined && p.estoque <= 5
        ? `<div class="estoque-tag poucos">Últimas ${p.estoque} un.</div>`
        : p.estoque !== undefined
          ? `<div class="estoque-tag disponivel">${p.estoque} disponíveis</div>`
          : '';

    const actionBtn = esgotado
      ? `<button class="btn-add esgotado" disabled>Esgotado</button>`
      : qty === 0
        ? `<button class="btn-add" onclick="addToCart(${p.id})">+ Adicionar</button>`
        : `<div class="qty-ctrl">
             <button class="qty-btn" onclick="removeFromCart(${p.id})">−</button>
             <span class="qty-num">${qty}</span>
             <button class="qty-btn" onclick="addToCart(${p.id})" ${limiteAtingido ? 'disabled' : ''}>+</button>
           </div>`;

    return `
      <div class="produto-card${esgotado ? ' esgotado-card' : ''}">
        <div class="produto-img-wrap">
          ${imgEl}
          ${estoqueTag}
        </div>
        <div class="produto-body">
          <div class="produto-nome">${p.nome}</div>
          <div class="produto-desc">${p.desc}</div>
          <div class="produto-footer">
            <div class="produto-preco">${formatMoney(p.preco)}</div>
            <div class="produto-actions">${actionBtn}</div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ========================
//  CHECKOUT
// ========================
async function goToCheckout() {
  if (cartCount() === 0) return;
  closeCartPanel();
  const modal = document.getElementById('checkoutModal');
  if (modal) {
    modal.classList.add('open');
    document.getElementById('checkoutStep1').style.display = 'block';
    document.getElementById('checkoutStep2').style.display = 'none';
    document.getElementById('checkoutStep3').style.display = 'none';
    document.getElementById('clientName').value    = '';
    document.getElementById('clientContato').value = '';
    setContatoTipo('whatsapp');
  }
}

function closeCheckout() { document.getElementById('checkoutModal')?.classList.remove('open'); }

async function goToPayment() {
  const name    = document.getElementById('clientName').value.trim();
  const contato = document.getElementById('clientContato').value.trim();
  if (!name)    { document.getElementById('clientName').style.borderColor    = 'var(--ouro)'; document.getElementById('clientName').focus();    return; }
  if (!contato) { document.getElementById('clientContato').style.borderColor = 'var(--ouro)'; document.getElementById('clientContato').focus(); return; }
  document.getElementById('clientName').style.borderColor    = '';
  document.getElementById('clientContato').style.borderColor = '';

  const produtos = await getProdutos();
  const pix      = await getPix();
  const entries  = Object.entries(cart).filter(([, qty]) => qty > 0);
  const total    = await cartTotal();

  document.getElementById('resumoItens').innerHTML = entries.map(([id, qty]) => {
    const p = produtos.find(x => x.id == id);
    if (!p) return '';
    return `<div class="resumo-item"><span>${qty}× ${p.nome}</span><span>${formatMoney(p.preco * qty)}</span></div>`;
  }).join('');

  document.getElementById('resumoTotal').textContent = formatMoney(total);

  const iconMap = { whatsapp: '💬', telefone: '📞', email: '✉️' };
  document.getElementById('resumoContato').innerHTML = `
    <div class="resumo-contato-box">
      <span>${iconMap[contatoTipoAtual] || '📱'}</span>
      <span><strong>${contatoTipoAtual.charAt(0).toUpperCase()+contatoTipoAtual.slice(1)}:</strong> ${contato}</span>
    </div>`;

  document.getElementById('pixKeyDisplay').textContent  = pix.chave;
  document.getElementById('pixTipoDisplay').textContent = `Tipo: ${pix.tipo}`;
  document.getElementById('pixNomeDisplay').textContent = `Titular: ${pix.nome}`;

  document.getElementById('checkoutStep1').style.display = 'none';
  document.getElementById('checkoutStep2').style.display = 'block';
}

function backToStep1() {
  document.getElementById('checkoutStep1').style.display = 'block';
  document.getElementById('checkoutStep2').style.display = 'none';
}

async function confirmarPedido() {
  const name    = document.getElementById('clientName').value.trim();
  const contato = document.getElementById('clientContato').value.trim();
  document.getElementById('sucessoNome').textContent = `Obrigado, ${name}! 🎉`;

  const produtos = await getProdutos();
  const total    = await cartTotal();
  const itens    = [];

  Object.entries(cart).forEach(([id, qty]) => {
    const p = produtos.find(x => x.id == id);
    if (p) itens.push({ id: p.id, nome: p.nome, qty, preco: p.preco });
  });

  // Salva pedido no banco
  await apiPost('save_pedido', { nome: name, contato, contatoTipo: contatoTipoAtual, itens, total });
  // Decrementa estoque
  await apiPost('update_estoque', { itens });

  // Invalida cache de produtos para recarregar estoque atualizado
  invalidateCache('produtos');

  document.getElementById('checkoutStep2').style.display = 'none';
  document.getElementById('checkoutStep3').style.display = 'block';
  cart = {};
  updateCartUI();
}

async function copyPix() {
  const pix = await getPix();
  navigator.clipboard.writeText(pix.chave).then(() => {
    const btn = document.querySelector('.copy-btn');
    if (btn) { btn.textContent = '✅ Copiado!'; setTimeout(() => btn.textContent = '📋 Copiar', 2000); }
  }).catch(() => alert('Chave Pix: ' + pix.chave));
}

// ========================
//  CONTATO EMBED
// ========================
async function renderContato() {
  const area = document.getElementById('contatoEmbed');
  if (!area) return;
  const c = await getContato();

  if (c.tipo === 'whatsapp') {
    const msg = encodeURIComponent(c.msgWpp || '');
    const num = (c.whatsapp || '').replace(/\D/g, '');
    area.innerHTML = `
      <div class="contato-wpp-card">
        <div class="contato-wpp-icon">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </div>
        <div class="contato-wpp-info">
          <h3>Fale pelo WhatsApp</h3>
          <p>Tire dúvidas ou faça pedidos diretamente.</p>
          <a href="https://wa.me/${num}?text=${msg}" target="_blank" class="btn-wpp">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Abrir WhatsApp
          </a>
        </div>
      </div>`;
  } else if (c.tipo === 'iframe' && c.iframe) {
    area.innerHTML = `<iframe src="${c.iframe}" class="contato-iframe" frameborder="0" allowfullscreen></iframe>`;
  } else if (c.tipo === 'email') {
    const assunto = encodeURIComponent(c.assunto || '');
    area.innerHTML = `
      <div class="contato-wpp-card">
        <div class="contato-wpp-icon" style="background:#f0e6ff">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </div>
        <div class="contato-wpp-info">
          <h3>Envie um e-mail</h3>
          <p>${c.email}</p>
          <a href="mailto:${c.email}?subject=${assunto}" class="btn-primary" style="display:inline-block;margin-top:.75rem;text-decoration:none">✉️ Enviar E-mail</a>
        </div>
      </div>`;
  } else {
    area.innerHTML = `<p class="empty-state" style="color:var(--texto-suave);text-align:center;padding:2rem">Configure o contato no painel admin.</p>`;
  }
}

// ========================
//  INIT
// ========================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();

  if (document.getElementById('produtosGrid')) {
    // Carrega tudo em paralelo
    await Promise.all([
      renderLogo(),
      renderCarrossel(),
      renderProdutos(),
      renderContato()
    ]);
    updateCartUI();

    document.getElementById('checkoutModal')?.addEventListener('click', function(e) { if (e.target === this) closeCheckout(); });
    document.getElementById('mapaModal')?.addEventListener('click',     function(e) { if (e.target === this) fecharMapa(); });
    document.getElementById('cartOverlay')?.addEventListener('click', closeCartPanel);
  }
});