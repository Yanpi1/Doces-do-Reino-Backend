// ============================
//  REINO GOURMET — ADMIN.JS
//  v2.0 — Tema Escuro + API real
// ============================

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

// ========================
//  AUTH
// ========================
async function doLogin() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const err  = document.getElementById('loginError');
  err.textContent = '';

  try {
    const res = await apiPost('login', { user, pass });
    if (res && res.ok) {
      sessionStorage.setItem('admin_auth', '1');
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('adminPanel').style.display  = 'flex';
      initAdmin();
    } else {
      err.textContent = res?.error || 'Usuário ou senha incorretos.';
      document.getElementById('loginPass').value = '';
    }
  } catch {
    // Fallback local
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      sessionStorage.setItem('admin_auth', '1');
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('adminPanel').style.display  = 'flex';
      initAdmin();
    } else {
      err.textContent = 'Usuário ou senha incorretos.';
      document.getElementById('loginPass').value = '';
    }
  }
}

function doLogout() {
  sessionStorage.removeItem('admin_auth');
  document.getElementById('adminPanel').style.display  = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginError').textContent = '';
}

async function initAdmin() {
  await Promise.all([
    renderAdminGrid(),
    loadPixForm(),
    loadContatoForm(),
    loadLogoForm(),
    loadCarrosselAdmin(),
    renderPedidosAdmin()
  ]);
}

document.addEventListener('DOMContentLoaded', async () => {
  // Tema
  initTheme();

  ['loginUser','loginPass'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  });

  // Logo na tela de login (usa logo_header)
  await renderLogoHeader();

  if (sessionStorage.getItem('admin_auth') === '1') {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display  = 'flex';
    initAdmin();
  }
});

// ========================
//  TABS
// ========================
function showTab(tab, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).style.display = 'block';
  btn.classList.add('active');
  if (tab === 'pedidos') renderPedidosAdmin();
}

// ========================
//  ADMIN PRODUTOS GRID
// ========================
async function renderAdminGrid() {
  const grid = document.getElementById('adminGrid');
  if (!grid) return;
  grid.innerHTML = '<p style="color:var(--texto-suave);grid-column:1/-1;padding:2rem;text-align:center">Carregando...</p>';
  const produtos = await getProdutos();
  invalidateCache('produtos'); // força reload na próxima chamada pública
  if (produtos.length === 0) {
    grid.innerHTML = '<p style="color:var(--texto-suave);grid-column:1/-1;padding:2rem;text-align:center">Nenhum produto cadastrado.</p>';
    return;
  }
  grid.innerHTML = produtos.map(p => {
    const imgEl = p.imagem
      ? `<div class="admin-card-img"><img src="${p.imagem}" alt="${p.nome}"></div>`
      : `<div class="admin-card-img emoji-bg">${p.emoji || '🍨'}</div>`;
    const estoqueStr = p.estoque !== undefined ? p.estoque : '—';
    const estoqueCls = p.estoque == 0 ? 'estoque-zero' : p.estoque <= 3 ? 'estoque-low' : 'estoque-ok';
    return `
      <div class="admin-card">
        ${imgEl}
        <div class="admin-card-body">
          <div class="admin-card-nome">${p.nome}</div>
          <div class="admin-card-meta">
            <span class="admin-card-preco">${formatMoney(p.preco)}</span>
            <span class="estoque-chip ${estoqueCls}">${p.estoque == 0 ? 'Esgotado' : estoqueStr + ' un.'}</span>
          </div>
          <div class="admin-card-actions">
            <button class="btn-edit" onclick="openProdutoModal(${p.id})">✏️ Editar</button>
            <button class="btn-del"  onclick="openDeleteModal(${p.id})">🗑️</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ========================
//  MODAL PRODUTO
// ========================
let deleteTargetId = null;
let _produtosAdmin = [];

async function openProdutoModal(id) {
  document.getElementById('produtoModal').classList.add('open');
  // Limpa preview de upload anterior
  const prevImg = document.getElementById('prodImagemPreview');
  if (prevImg) prevImg.remove();
  const uploadInput = document.getElementById('prodImagemUpload');
  if (uploadInput) uploadInput.value = '';

  if (id) {
    _produtosAdmin = await getProdutos();
    const p = _produtosAdmin.find(x => x.id == id);
    if (!p) return;
    document.getElementById('modalTitle').textContent  = 'Editar Produto';
    document.getElementById('produtoId').value    = p.id;
    document.getElementById('prodNome').value     = p.nome;
    document.getElementById('prodDesc').value     = p.desc || '';
    document.getElementById('prodPreco').value    = p.preco;
    document.getElementById('prodEstoque').value  = p.estoque !== undefined ? p.estoque : '';
    document.getElementById('prodImagem').value   = p.imagem || '';
    document.getElementById('prodEmoji').value    = p.emoji  || '';
  } else {
    document.getElementById('modalTitle').textContent = 'Novo Produto';
    ['produtoId','prodNome','prodDesc','prodPreco','prodEstoque','prodImagem','prodEmoji'].forEach(id => {
      document.getElementById(id).value = '';
    });
  }
}

function closeProdutoModal() { document.getElementById('produtoModal').classList.remove('open'); }

async function salvarProduto() {
  const nome    = document.getElementById('prodNome').value.trim();
  const desc    = document.getElementById('prodDesc').value.trim();
  const preco   = parseFloat(document.getElementById('prodPreco').value);
  const estoque = parseInt(document.getElementById('prodEstoque').value);
  const imagem  = document.getElementById('prodImagem').value.trim();
  const emoji   = document.getElementById('prodEmoji').value.trim();
  const idVal   = document.getElementById('produtoId').value;

  if (!nome || isNaN(preco) || preco < 0) { alert('Preencha nome e preço válido.'); return; }

  const res = await apiPost('save_produto', {
    id: idVal ? parseInt(idVal) : 0,
    nome, desc, preco, estoque: isNaN(estoque) ? 0 : estoque, imagem, emoji
  });

  if (res?.ok) {
    invalidateCache('produtos');
    await renderAdminGrid();
    closeProdutoModal();
  } else {
    alert(res?.error || 'Erro ao salvar produto.');
  }
}

function openDeleteModal(id) { deleteTargetId = id; document.getElementById('deleteModal').classList.add('open'); }
function closeDeleteModal()  { deleteTargetId = null; document.getElementById('deleteModal').classList.remove('open'); }

async function confirmDelete() {
  if (!deleteTargetId) return;
  const res = await apiPost('delete_produto', { id: deleteTargetId });
  if (res?.ok) {
    invalidateCache('produtos');
    await renderAdminGrid();
  }
  closeDeleteModal();
}

// ========================
//  PIX
// ========================
async function loadPixForm() {
  const pix = await apiGet('get_config', { chave: 'pix' });
  if (!pix) return;
  document.getElementById('pixTipo').value  = pix.tipo  || 'Telefone';
  document.getElementById('pixChave').value = pix.chave || '';
  document.getElementById('pixNome').value  = pix.nome  || '';
}

async function salvarPix() {
  const data = {
    tipo:  document.getElementById('pixTipo').value,
    chave: document.getElementById('pixChave').value.trim(),
    nome:  document.getElementById('pixNome').value.trim()
  };
  const res = await apiPost('save_config', { chave: 'pix', valor: data });
  invalidateCache('pix');
  const msg = document.getElementById('pixSucesso');
  msg.style.display = 'block';
  setTimeout(() => msg.style.display = 'none', 2500);
}

// ========================
//  CONTATO
// ========================
async function loadContatoForm() {
  const c = await apiGet('get_config', { chave: 'contato' });
  if (!c) return;
  document.getElementById('contatoTipo').value     = c.tipo      || 'whatsapp';
  document.getElementById('contatoWhatsapp').value = c.whatsapp  || '';
  document.getElementById('contatoMsgWpp').value   = c.msgWpp    || '';
  document.getElementById('contatoIframe').value   = c.iframe    || '';
  document.getElementById('contatoEmail').value    = c.email     || '';
  document.getElementById('contatoAssunto').value  = c.assunto   || '';
  toggleContatoCampos();
}

function toggleContatoCampos() {
  const tipo = document.getElementById('contatoTipo').value;
  document.getElementById('campoWhatsapp').style.display = tipo === 'whatsapp' ? 'block' : 'none';
  document.getElementById('campoIframe').style.display   = tipo === 'iframe'   ? 'block' : 'none';
  document.getElementById('campoEmail').style.display    = tipo === 'email'    ? 'block' : 'none';
}

async function salvarContato() {
  const data = {
    tipo:     document.getElementById('contatoTipo').value,
    whatsapp: document.getElementById('contatoWhatsapp').value.trim(),
    msgWpp:   document.getElementById('contatoMsgWpp').value.trim(),
    iframe:   document.getElementById('contatoIframe').value.trim(),
    email:    document.getElementById('contatoEmail').value.trim(),
    assunto:  document.getElementById('contatoAssunto').value.trim()
  };
  await apiPost('save_config', { chave: 'contato', valor: data });
  invalidateCache('contato');
  const msg = document.getElementById('contatoSucesso');
  msg.style.display = 'block';
  setTimeout(() => msg.style.display = 'none', 2500);
}

// ========================
//  LOGO (header e sobre separados)
// ========================

async function loadLogoForm() {
  // Carrega logo do header
  const urlH = await apiGet('get_config', { chave: 'logo_header' });
  const headerUrl = (typeof urlH === 'string') ? urlH : '';
  document.getElementById('logoHeaderUrl').value = headerUrl;
  if (headerUrl) {
    document.getElementById('logoHeaderPreview').src = headerUrl;
    document.getElementById('logoHeaderPreviewWrap').style.display = 'block';
  } else {
    document.getElementById('logoHeaderPreviewWrap').style.display = 'none';
  }

  // Carrega logo do sobre
  const urlS = await apiGet('get_config', { chave: 'logo_sobre' });
  const sobreUrl = (typeof urlS === 'string') ? urlS : '';
  document.getElementById('logoSobreUrl').value = sobreUrl;
  if (sobreUrl) {
    document.getElementById('logoSobrePreview').src = sobreUrl;
    document.getElementById('logoSobrePreviewWrap').style.display = 'block';
  } else {
    document.getElementById('logoSobrePreviewWrap').style.display = 'none';
  }
}

// ========================
//  COMPRESSÃO DE IMAGEM
// ========================

/**
 * Redimensiona e comprime uma imagem para base64.
 * @param {File} file - Arquivo de imagem
 * @param {number} maxW - Largura máxima em px
 * @param {number} maxH - Altura máxima em px
 * @param {number} quality - Qualidade JPEG (0-1)
 * @returns {Promise<string>} - Data URL comprimida
 */
function compressImage(file, maxW, maxH, quality = 0.88) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = function(e) {
      const img = new Image();
      img.onerror = reject;
      img.onload = function() {
        // Calcula novas dimensões mantendo proporção
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        // Suavização de alta qualidade
        ctx.imageSmoothingEnabled  = true;
        ctx.imageSmoothingQuality  = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        // Usa JPEG para fotos (menor); PNG para logo com transparência
        const mime = (file.type === 'image/png') ? 'image/png' : 'image/jpeg';
        const q    = (mime === 'image/png') ? 1 : quality;
        resolve(canvas.toDataURL(mime, q));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Upload genérico — 'tipo' pode ser 'header' ou 'sobre'
async function handleLogoUpload(event, tipo) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { alert('Imagem muito grande. Use até 10MB.'); return; }

  // Configurações por tipo
  const cfg = {
    header: { maxW: 400,  maxH: 400,  quality: 0.92 },
    sobre:  { maxW: 1200, maxH: 900,  quality: 0.88 }
  }[tipo] || { maxW: 800, maxH: 800, quality: 0.88 };

  try {
    // Indica processamento
    const btnId = tipo === 'header' ? 'logoHeaderPreviewWrap' : 'logoSobrePreviewWrap';
    const dataUrl = await compressImage(file, cfg.maxW, cfg.maxH, cfg.quality);

    if (tipo === 'header') {
      document.getElementById('logoHeaderUrl').value = dataUrl;
      document.getElementById('logoHeaderPreview').src = dataUrl;
      document.getElementById('logoHeaderPreviewWrap').style.display = 'block';
    } else {
      document.getElementById('logoSobreUrl').value = dataUrl;
      document.getElementById('logoSobrePreview').src = dataUrl;
      document.getElementById('logoSobrePreviewWrap').style.display = 'block';
    }
  } catch(err) {
    alert('Erro ao processar imagem. Tente outra.');
    console.error(err);
  }
}

// Upload de imagem para produto (no modal de produto)
async function handleProdutoImgUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { alert('Imagem muito grande. Use até 10MB.'); return; }
  try {
    const dataUrl = await compressImage(file, 800, 800, 0.88);
    document.getElementById('prodImagem').value = dataUrl;
    // Mostra mini-preview
    let prev = document.getElementById('prodImagemPreview');
    if (!prev) {
      prev = document.createElement('img');
      prev.id = 'prodImagemPreview';
      prev.style.cssText = 'max-width:120px;max-height:80px;object-fit:cover;border-radius:8px;margin-top:.5rem;display:block;border:2px solid var(--borda)';
      document.getElementById('prodImagem').insertAdjacentElement('afterend', prev);
    }
    prev.src = dataUrl;
  } catch(err) { alert('Erro ao processar imagem.'); }
}

// Upload de imagem para slide do carrossel
async function handleSlideImgUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { alert('Imagem muito grande. Use até 10MB.'); return; }
  try {
    const dataUrl = await compressImage(file, 1400, 600, 0.90);
    document.getElementById('slideImagem').value = dataUrl;
    // Mostra mini-preview
    let prev = document.getElementById('slideImagemPreview');
    if (!prev) {
      prev = document.createElement('img');
      prev.id = 'slideImagemPreview';
      prev.style.cssText = 'max-width:200px;max-height:80px;object-fit:cover;border-radius:8px;margin-top:.5rem;display:block;border:2px solid var(--borda)';
      document.getElementById('slideImagem').insertAdjacentElement('afterend', prev);
    }
    prev.src = dataUrl;
  } catch(err) { alert('Erro ao processar imagem.'); }
}

// ---- Logo Header ----
async function salvarLogoHeader() {
  const url = document.getElementById('logoHeaderUrl').value.trim();
  // Aviso se base64 muito grande (>1MB encoded ≈ 750KB de imagem)
  if (url.startsWith('data:') && url.length > 1_400_000) {
    alert('⚠️ Imagem ainda muito grande após compressão.\nTente uma imagem menor ou use uma URL externa (hospede no Imgur, Google Drive, etc).');
    return;
  }
  const res = await apiPost('save_config', { chave: 'logo_header', valor: url });
  if (res && res.error) { alert('Erro ao salvar: ' + res.error); return; }
  invalidateCache('logo_header');
  if (url) {
    document.getElementById('logoHeaderPreview').src = url;
    document.getElementById('logoHeaderPreviewWrap').style.display = 'block';
  }
  const msg = document.getElementById('logoHeaderSucesso');
  msg.style.display = 'block';
  setTimeout(() => msg.style.display = 'none', 2500);
}

async function removerLogoHeader() {
  await apiPost('save_config', { chave: 'logo_header', valor: '' });
  invalidateCache('logo_header');
  document.getElementById('logoHeaderUrl').value = '';
  document.getElementById('logoHeaderPreviewWrap').style.display = 'none';
  const msg = document.getElementById('logoHeaderSucesso');
  msg.textContent = '✅ Logo removida!';
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; msg.textContent = '✅ Logo salva!'; }, 2500);
}

// ---- Logo Sobre ----
async function salvarLogoSobre() {
  const url = document.getElementById('logoSobreUrl').value.trim();
  if (url.startsWith('data:') && url.length > 1_400_000) {
    alert('⚠️ Imagem ainda muito grande após compressão.\nTente uma imagem menor ou use uma URL externa (hospede no Imgur, Google Drive, etc).');
    return;
  }
  const res = await apiPost('save_config', { chave: 'logo_sobre', valor: url });
  if (res && res.error) { alert('Erro ao salvar: ' + res.error); return; }
  invalidateCache('logo_sobre');
  if (url) {
    document.getElementById('logoSobrePreview').src = url;
    document.getElementById('logoSobrePreviewWrap').style.display = 'block';
  }
  const msg = document.getElementById('logoSobreSucesso');
  msg.style.display = 'block';
  setTimeout(() => msg.style.display = 'none', 2500);
}

async function removerLogoSobre() {
  await apiPost('save_config', { chave: 'logo_sobre', valor: '' });
  invalidateCache('logo_sobre');
  document.getElementById('logoSobreUrl').value = '';
  document.getElementById('logoSobrePreviewWrap').style.display = 'none';
  const msg = document.getElementById('logoSobreSucesso');
  msg.textContent = '✅ Foto removida!';
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; msg.textContent = '✅ Foto salva!'; }, 2500);
}

// ========================
//  CARROSSEL ADMIN
// ========================
async function loadCarrosselAdmin() {
  const cfg = await apiGet('get_config', { chave: 'carrossel' });
  if (cfg) {
    document.getElementById('carrosselAtivo').checked = cfg.ativo || false;
    document.getElementById('carrosselEyebrowAdmin').value = cfg.eyebrow || 'Destaques';
    document.getElementById('carrosselTituloAdmin').value  = cfg.titulo  || 'Em Destaque';
  }
  await renderSlidesGrid();
}

async function toggleCarrosselAtivo() {
  const cfg = await apiGet('get_config', { chave: 'carrossel' }) || {};
  cfg.ativo = document.getElementById('carrosselAtivo').checked;
  await apiPost('save_config', { chave: 'carrossel', valor: cfg });
  invalidateCache('carrossel');
}

async function salvarCarrosselConfig() {
  const cfg = await apiGet('get_config', { chave: 'carrossel' }) || {};
  cfg.eyebrow = document.getElementById('carrosselEyebrowAdmin').value.trim() || 'Destaques';
  cfg.titulo  = document.getElementById('carrosselTituloAdmin').value.trim()  || 'Em Destaque';
  await apiPost('save_config', { chave: 'carrossel', valor: cfg });
  invalidateCache('carrossel');
  const msg = document.getElementById('carrosselConfigSucesso');
  msg.style.display = 'block';
  setTimeout(() => msg.style.display = 'none', 2500);
}

async function renderSlidesGrid() {
  const grid = document.getElementById('slidesGrid');
  if (!grid) return;
  const slides = await apiGet('get_slides') || [];
  if (slides.length === 0) {
    grid.innerHTML = '<p style="color:var(--texto-suave);grid-column:1/-1;padding:2rem;text-align:center">Nenhum slide criado ainda. Clique em "+ Novo Slide".</p>';
    return;
  }
  grid.innerHTML = slides.map((s) => {
    const imgEl = s.imagem
      ? `<div class="admin-card-img"><img src="${s.imagem}" alt="${s.titulo}"></div>`
      : `<div class="admin-card-img emoji-bg">${s.emoji || '🍨'}</div>`;
    return `
      <div class="admin-card">
        ${imgEl}
        <div class="admin-card-body">
          <div class="admin-card-nome">${s.titulo}</div>
          <div class="admin-card-meta">
            ${s.preco ? `<span class="admin-card-preco">R$ ${parseFloat(s.preco).toFixed(2).replace('.',',')}</span>` : ''}
          </div>
          <div class="admin-card-actions">
            <button class="btn-edit" onclick="openSlideModal(${s.id})">✏️ Editar</button>
            <button class="btn-del"  onclick="deleteSlide(${s.id})">🗑️</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

let slideEditId = null;

function openSlideModal(id) {
  slideEditId = id || null;
  document.getElementById('slideModal').classList.add('open');
  // Limpa preview de upload anterior
  const prevImg = document.getElementById('slideImagemPreview');
  if (prevImg) prevImg.remove();
  const uploadInput = document.getElementById('slideImagemUpload');
  if (uploadInput) uploadInput.value = '';
  if (slideEditId) {
    // Busca o slide pelo ID da API para preencher
    apiGet('get_slides').then(slides => {
      const s = (slides || []).find(x => x.id == slideEditId);
      if (!s) return;
      document.getElementById('slideModalTitle').textContent = 'Editar Slide';
      document.getElementById('slideIdx').value    = s.id;
      document.getElementById('slideTitulo').value = s.titulo || '';
      document.getElementById('slideDesc').value   = s.desc   || '';
      document.getElementById('slidePreco').value  = s.preco  || '';
      document.getElementById('slideImagem').value = s.imagem || '';
      document.getElementById('slideEmoji').value  = s.emoji  || '';
    });
  } else {
    document.getElementById('slideModalTitle').textContent = 'Novo Slide';
    document.getElementById('slideIdx').value = '';
    ['slideTitulo','slideDesc','slidePreco','slideImagem','slideEmoji'].forEach(id => document.getElementById(id).value = '');
  }
}

function closeSlideModal() { document.getElementById('slideModal').classList.remove('open'); slideEditId = null; }

async function salvarSlide() {
  const s = {
    id:     parseInt(document.getElementById('slideIdx').value) || 0,
    titulo: document.getElementById('slideTitulo').value.trim(),
    desc:   document.getElementById('slideDesc').value.trim(),
    preco:  document.getElementById('slidePreco').value.trim(),
    imagem: document.getElementById('slideImagem').value.trim(),
    emoji:  document.getElementById('slideEmoji').value.trim()
  };
  if (!s.titulo) { alert('Informe um título.'); return; }
  const res = await apiPost('save_slide', s);
  if (res?.ok) {
    invalidateCache('carrossel');
    await renderSlidesGrid();
    closeSlideModal();
  } else {
    alert(res?.error || 'Erro ao salvar slide.');
  }
}

async function deleteSlide(id) {
  if (!confirm('Remover este slide?')) return;
  const res = await apiPost('delete_slide', { id });
  if (res?.ok) { invalidateCache('carrossel'); await renderSlidesGrid(); }
}

// ========================
//  PEDIDOS ADMIN
// ========================
async function renderPedidosAdmin() {
  const lista = document.getElementById('pedidosLista');
  if (!lista) return;
  lista.innerHTML = '<p style="color:var(--texto-suave);padding:2rem;text-align:center">Carregando...</p>';
  const pedidos = await apiGet('get_pedidos') || [];

  if (pedidos.length === 0) {
    lista.innerHTML = '<div class="empty-pedidos"><p>📦 Nenhum pedido registrado ainda.</p><p style="color:var(--texto-suave);font-size:.9rem">Os pedidos aparecerão aqui quando clientes finalizarem compras.</p></div>';
    return;
  }

  const statusOpts   = ['pendente','confirmado','entregue','cancelado'];
  const statusColors = { pendente: '#f59e0b', confirmado: '#3b82f6', entregue: '#22c55e', cancelado: '#ef4444' };

  lista.innerHTML = pedidos.map(p => `
    <div class="pedido-card">
      <div class="pedido-card-top">
        <div class="pedido-card-info">
          <div class="pedido-nome">${p.nome}</div>
          <div class="pedido-meta">
            <span>📅 ${p.data || p.criado}</span>
            <span>|</span>
            <span>${p.contato_tipo === 'whatsapp' ? '💬' : p.contato_tipo === 'email' ? '✉️' : '📞'} ${p.contato}</span>
          </div>
        </div>
        <div class="pedido-card-right">
          <div class="pedido-total">${formatMoney(p.total)}</div>
          <select class="pedido-status-select" style="border-color:${statusColors[p.status]||'#ccc'};color:${statusColors[p.status]||'#333'}"
            onchange="atualizarStatusPedido(${p.id}, this.value)">
            ${statusOpts.map(s => `<option value="${s}" ${s===p.status?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="pedido-itens">
        ${(p.itens||[]).map(it => `<span class="pedido-item-chip">${it.qty}× ${it.nome}</span>`).join('')}
      </div>
    </div>`).join('');
}

async function atualizarStatusPedido(id, novoStatus) {
  await apiPost('update_status_pedido', { id, status: novoStatus });
  // Re-render para atualizar cores
  await renderPedidosAdmin();
}

async function limparPedidos() {
  if (!confirm('Limpar todo o histórico de pedidos? Esta ação não pode ser desfeita.')) return;
  await apiPost('limpar_pedidos', {});
  await renderPedidosAdmin();
}
