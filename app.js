/* ============================================
   SPARK SIDEBAR CUSTOMIZER v3
   Generates GHL-compatible Custom CSS + Custom JS
   ============================================ */

// ===== DEFAULT MENU ITEMS =====
const DEFAULT_ITEMS = [
  { id: 'sb_launchpad', name: 'Launchpad', type: 'native', visible: true },
  { id: 'sb_dashboard', name: 'Dashboard', type: 'native', visible: true },
  { id: 'sb_conversations', name: 'Conversations', type: 'native', visible: true },
  { id: 'sb_calendars', name: 'Calendars', type: 'native', visible: true },
  { id: 'sb_contacts', name: 'Contacts', type: 'native', visible: true },
  { id: 'sb_opportunities', name: 'Opportunities', type: 'native', visible: true },
  { id: 'sb_payments', name: 'Payments', type: 'native', visible: true },
  { id: 'sb_email-marketing', name: 'Marketing', type: 'native', visible: true },
  { id: 'sb_automation', name: 'Automation', type: 'native', visible: true },
  { id: 'sb_sites', name: 'Sites', type: 'native', visible: true },
  { id: 'sb_memberships', name: 'Memberships', type: 'native', visible: true },
  { id: 'sb_app-media', name: 'Media Storage', type: 'native', visible: true },
  { id: 'sb_reputation', name: 'Reputation', type: 'native', visible: true },
  { id: 'sb_reporting', name: 'Reporting', type: 'native', visible: true },
  { id: 'sb_app-marketplace', name: 'App Marketplace', type: 'native', visible: true },
  { id: 'sb_location-mobile-app', name: 'Mobile App', type: 'native', visible: true },
  { id: 'sb_settings', name: 'Settings', type: 'native', visible: true },
];

// Original names for rename detection
const ORIGINAL_NAMES = {};
DEFAULT_ITEMS.forEach(i => { ORIGINAL_NAMES[i.id] = i.name; });

// ===== STATE =====
let state = {
  items: JSON.parse(JSON.stringify(DEFAULT_ITEMS)),
  colors: {
    bg: '#111827',
    text: '#8ba3be',
    hover: '#1f2937',
    active: '#2563eb',
    activeText: '#ffffff',
    icon: '#607d9b',
  },
  fontSize: 13,
  borderRadius: 6,
  logo: { url: '' },
};

let draggedItem = null;
let draggedEl = null;
let editingItemId = null;
let nextCustomId = 1;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initColorSync();
  initRangeInputs();
  initLogoInput();
  initButtons();
  renderItemsList();

  // When iframe loads, inject CSS+JS into it
  const iframe = document.getElementById('preview-iframe');
  iframe.addEventListener('load', () => { setTimeout(injectPreview, 1500); });
});

// ===== COLOR SYNC =====
function initColorSync() {
  const pairs = [
    ['color-bg', 'color-bg-text', 'bg'],
    ['color-text', 'color-text-text', 'text'],
    ['color-hover', 'color-hover-text', 'hover'],
    ['color-active', 'color-active-text', 'active'],
    ['color-active-text-color', 'color-active-text-color-text', 'activeText'],
    ['color-icon', 'color-icon-text', 'icon'],
  ];
  pairs.forEach(([pid, tid, key]) => {
    const p = document.getElementById(pid);
    const t = document.getElementById(tid);
    p.addEventListener('input', () => { t.value = p.value; state.colors[key] = p.value; injectPreview(); });
    t.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(t.value)) { p.value = t.value; state.colors[key] = t.value; injectPreview(); }
    });
    t.addEventListener('blur', () => { t.value = p.value; });
  });
}

function initRangeInputs() {
  const fs = document.getElementById('font-size');
  const fsv = document.getElementById('font-size-value');
  fs.addEventListener('input', () => { state.fontSize = +fs.value; fsv.textContent = fs.value + 'px'; injectPreview(); });
  const br = document.getElementById('border-radius');
  const brv = document.getElementById('border-radius-value');
  br.addEventListener('input', () => { state.borderRadius = +br.value; brv.textContent = br.value + 'px'; injectPreview(); });
}

function initLogoInput() {
  const el = document.getElementById('logo-url');
  el.addEventListener('input', () => { state.logo.url = el.value; injectPreview(); });
}

function initButtons() {
  document.getElementById('btn-add-folder').addEventListener('click', addFolder);
  document.getElementById('btn-add-divider').addEventListener('click', addDivider);
  document.getElementById('btn-save').addEventListener('click', saveConfig);
  document.getElementById('btn-load').addEventListener('click', loadConfig);
  document.getElementById('btn-export-css').addEventListener('click', () => showExportModal('css'));
  document.getElementById('btn-export-js').addEventListener('click', () => showExportModal('js'));
  document.getElementById('btn-deploy').addEventListener('click', deployToVercel);
  document.getElementById('btn-refresh-preview').addEventListener('click', refreshPreview);
  document.getElementById('modal-close').addEventListener('click', () => document.getElementById('modal-overlay').classList.remove('open'));
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('modal-overlay').classList.remove('open'); });
  document.getElementById('btn-copy').addEventListener('click', copyCode);
  document.getElementById('deploy-modal-close').addEventListener('click', () => document.getElementById('deploy-modal-overlay').classList.remove('open'));
  document.getElementById('deploy-modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('deploy-modal-overlay').classList.remove('open'); });
  document.querySelectorAll('.btn-copy-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(document.getElementById(btn.dataset.target).textContent).then(() => showToast('Copiado!', 'success'));
    });
  });
  document.getElementById('edit-modal-close').addEventListener('click', closeEditModal);
  document.getElementById('edit-modal-cancel').addEventListener('click', closeEditModal);
  document.getElementById('edit-modal-save').addEventListener('click', saveEditModal);
  document.getElementById('edit-modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeEditModal(); });
}

// ===== TREE HELPERS =====
function findItem(items, id) {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) { const f = findItem(item.children, id); if (f) return f; }
  }
  return null;
}
function removeItem(items, id) {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) return items.splice(i, 1)[0];
    if (items[i].children) { const r = removeItem(items[i].children, id); if (r) return r; }
  }
  return null;
}
function insertAfter(items, tid, item) {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === tid) { items.splice(i + 1, 0, item); return true; }
    if (items[i].children && insertAfter(items[i].children, tid, item)) return true;
  }
  return false;
}
function insertBefore(items, tid, item) {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === tid) { items.splice(i, 0, item); return true; }
    if (items[i].children && insertBefore(items[i].children, tid, item)) return true;
  }
  return false;
}
function isDescendant(folder, tid) {
  if (!folder.children) return false;
  return folder.children.some(c => c.id === tid || (c.children && isDescendant(c, tid)));
}

// ===== RENDER ITEMS LIST =====
function renderItemsList() {
  const container = document.getElementById('items-list');
  container.innerHTML = '';
  renderItemsRecursive(state.items, container);
  injectPreview();
}

function renderItemsRecursive(items, container) {
  items.forEach(item => {
    container.appendChild(createItemEl(item));
    if (item.type === 'folder' && item.children) {
      const cc = document.createElement('div');
      cc.className = 'folder-children' + (item.collapsed ? ' collapsed' : '');
      renderItemsRecursive(item.children, cc);
      container.appendChild(cc);
    }
  });
}

function createItemEl(item) {
  const el = document.createElement('div');
  el.className = 'menu-item';
  if (item.type === 'folder') el.classList.add('is-folder');
  if (item.type === 'divider') el.classList.add('is-divider');
  el.dataset.id = item.id;
  el.draggable = true;

  // drag handle
  const dh = document.createElement('span');
  dh.className = 'drag-handle';
  dh.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';
  el.appendChild(dh);

  if (item.type === 'folder') {
    const tog = document.createElement('span');
    tog.className = 'folder-toggle' + (item.collapsed ? ' collapsed' : '');
    tog.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
    tog.addEventListener('click', e => { e.stopPropagation(); item.collapsed = !item.collapsed; renderItemsList(); });
    el.appendChild(tog);
  }

  const name = document.createElement('span');
  name.className = 'item-name';
  if (item.type === 'divider') { name.textContent = '--- Divisor ---'; name.style.opacity = '0.4'; name.style.fontStyle = 'italic'; }
  else name.textContent = item.name;
  el.appendChild(name);

  const ctrls = document.createElement('span');
  ctrls.className = 'item-controls';

  if (item.type !== 'divider') {
    const eb = document.createElement('button');
    eb.className = 'btn-icon';
    eb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    eb.title = 'Editar';
    eb.addEventListener('click', e => { e.stopPropagation(); openEditModal(item.id); });
    ctrls.appendChild(eb);

    const vb = document.createElement('button');
    vb.className = 'visibility-toggle' + (item.visible === false ? ' hidden-item' : '');
    vb.innerHTML = item.visible === false
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    vb.addEventListener('click', e => { e.stopPropagation(); item.visible = !item.visible; renderItemsList(); });
    ctrls.appendChild(vb);
  }

  if (item.type !== 'native') {
    const db = document.createElement('button');
    db.className = 'btn-icon danger';
    db.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    db.addEventListener('click', e => { e.stopPropagation(); removeItem(state.items, item.id); renderItemsList(); });
    ctrls.appendChild(db);
  }

  el.appendChild(ctrls);
  el.addEventListener('dragstart', handleDragStart);
  el.addEventListener('dragend', handleDragEnd);
  el.addEventListener('dragover', handleDragOver);
  el.addEventListener('dragleave', handleDragLeave);
  el.addEventListener('drop', handleDrop);
  return el;
}

// ===== DRAG AND DROP =====
function handleDragStart(e) { draggedItem = this.dataset.id; draggedEl = this; this.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; }
function handleDragEnd() { this.classList.remove('dragging'); document.querySelectorAll('.drag-over-top,.drag-over-bottom,.folder-drop-target').forEach(e => e.classList.remove('drag-over-top','drag-over-bottom','folder-drop-target')); draggedItem = null; draggedEl = null; }
function handleDragOver(e) {
  e.preventDefault(); if (this === draggedEl) return;
  document.querySelectorAll('.drag-over-top,.drag-over-bottom,.folder-drop-target').forEach(e => e.classList.remove('drag-over-top','drag-over-bottom','folder-drop-target'));
  const r = this.getBoundingClientRect(); const y = e.clientY - r.top; const t = findItem(state.items, this.dataset.id);
  if (t && t.type === 'folder' && y > r.height * 0.25 && y < r.height * 0.75) this.classList.add('folder-drop-target');
  else if (y < r.height / 2) this.classList.add('drag-over-top');
  else this.classList.add('drag-over-bottom');
}
function handleDragLeave() { this.classList.remove('drag-over-top','drag-over-bottom','folder-drop-target'); }
function handleDrop(e) {
  e.preventDefault(); e.stopPropagation(); if (this === draggedEl || !draggedItem) return;
  const tid = this.dataset.id; const target = findItem(state.items, tid); const source = findItem(state.items, draggedItem);
  if (!source || !target) return; if (source.type === 'folder' && isDescendant(source, tid)) return;
  const r = this.getBoundingClientRect(); const y = e.clientY - r.top; const removed = removeItem(state.items, draggedItem); if (!removed) return;
  if (target.type === 'folder' && y > r.height * 0.25 && y < r.height * 0.75) { if (!target.children) target.children = []; target.children.push(removed); target.collapsed = false; }
  else if (y < r.height / 2) insertBefore(state.items, tid, removed);
  else insertAfter(state.items, tid, removed);
  renderItemsList();
}

// ===== ADD ITEMS =====
function addFolder() {
  const id = 'folder_' + nextCustomId++;
  state.items.push({ id, name: 'Nova Pasta', type: 'folder', visible: true, collapsed: false, children: [] });
  renderItemsList(); openEditModal(id);
}
function addDivider() {
  state.items.push({ id: 'divider_' + nextCustomId++, type: 'divider' });
  renderItemsList();
}

// ===== EDIT MODAL =====
function openEditModal(itemId) {
  const item = findItem(state.items, itemId); if (!item) return;
  editingItemId = itemId;
  const body = document.getElementById('edit-modal-body');
  const title = document.getElementById('edit-modal-title');

  if (item.type === 'folder') {
    title.textContent = 'Editar Pasta';
    body.innerHTML = '<div class="edit-field"><label>Nome da Pasta</label><input type="text" id="edit-name" value="' + esc(item.name) + '"></div>';
  } else {
    title.textContent = 'Editar: ' + item.name;
    body.innerHTML = '<div class="edit-field"><label>Nome exibido na sidebar</label><input type="text" id="edit-name" value="' + esc(item.name) + '"></div>';
  }
  document.getElementById('edit-modal-overlay').classList.add('open');
  setTimeout(() => { const n = document.getElementById('edit-name'); if (n) { n.focus(); n.select(); } }, 100);
}
function closeEditModal() { document.getElementById('edit-modal-overlay').classList.remove('open'); editingItemId = null; }
function saveEditModal() {
  const item = findItem(state.items, editingItemId); if (!item) return;
  const n = document.getElementById('edit-name'); if (n) item.name = n.value || item.name;
  closeEditModal(); renderItemsList();
}

// ===== SAVE / LOAD =====
function saveConfig() {
  localStorage.setItem('spark-sidebar-v3', JSON.stringify(state));
  showToast('Configuracao salva!', 'success');
}
function loadConfig() {
  const s = localStorage.getItem('spark-sidebar-v3');
  if (!s) { showToast('Nenhuma configuracao salva.'); return; }
  try {
    const c = JSON.parse(s); state.items = c.items; state.colors = c.colors; state.fontSize = c.fontSize; state.borderRadius = c.borderRadius; state.logo = c.logo || { url: '' };
    syncUI(); renderItemsList(); showToast('Configuracao carregada!', 'success');
  } catch (e) { showToast('Erro ao carregar.'); }
}
function syncUI() {
  const m = { bg: ['color-bg','color-bg-text'], text: ['color-text','color-text-text'], hover: ['color-hover','color-hover-text'], active: ['color-active','color-active-text'], activeText: ['color-active-text-color','color-active-text-color-text'], icon: ['color-icon','color-icon-text'] };
  Object.entries(m).forEach(([k,[p,t]]) => { document.getElementById(p).value = state.colors[k]; document.getElementById(t).value = state.colors[k]; });
  document.getElementById('font-size').value = state.fontSize; document.getElementById('font-size-value').textContent = state.fontSize + 'px';
  document.getElementById('border-radius').value = state.borderRadius; document.getElementById('border-radius-value').textContent = state.borderRadius + 'px';
  document.getElementById('logo-url').value = state.logo.url || '';
}

// ===== EXPORT =====
function showExportModal(type) {
  document.getElementById('modal-title').textContent = type === 'css' ? 'Custom CSS (cole no campo Custom CSS)' : 'Custom JS (cole no campo Custom JS)';
  document.getElementById('modal-code').textContent = type === 'css' ? generateCSS() : generateJS();
  document.getElementById('modal-overlay').classList.add('open');
}
function copyCode() {
  navigator.clipboard.writeText(document.getElementById('modal-code').textContent).then(() => showToast('Copiado!', 'success'));
}

// ===== DEPLOY =====
async function deployToVercel() {
  const ov = document.getElementById('deploy-modal-overlay'); const ld = document.getElementById('deploy-loading'); const rs = document.getElementById('deploy-result'); const er = document.getElementById('deploy-error');
  ld.style.display = 'flex'; rs.style.display = 'none'; er.style.display = 'none'; ov.classList.add('open');
  try {
    const res = await fetch('/api/deploy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ css: generateCSS(), js: generateJS() }) });
    const data = await res.json(); ld.style.display = 'none';
    if (data.success && data.url) {
      document.getElementById('deploy-css-tag').textContent = "@import url('" + data.cssUrl + "');";
      document.getElementById('deploy-js-tag').textContent = '<script src="' + data.jsUrl + '"></script>';
      rs.style.display = 'block'; document.getElementById('deploy-modal-title').textContent = 'Deploy Concluido!';
    } else { document.getElementById('deploy-error-msg').textContent = data.error || 'Erro'; er.style.display = 'block'; }
  } catch (e) { ld.style.display = 'none'; document.getElementById('deploy-error-msg').textContent = 'Server offline. Rode: node server.js'; er.style.display = 'block'; }
}

// ===========================================================
//  GENERATE CSS — uses proven GHL patterns
// ===========================================================
function generateCSS() {
  const c = state.colors;
  const fs = state.fontSize;
  const br = state.borderRadius;
  let orderCSS = '';
  let hideCSS = '';
  let renameCSS = '';
  let dividerCSS = '';
  let dividerCount = 0;

  function walk(items, orderStart) {
    let ord = orderStart;
    items.forEach(item => {
      ord++;
      if (item.type === 'native') {
        // Order
        orderCSS += `#sidebar-v2 .hl_nav-header > nav > a#${item.id} { order: ${ord} !important; }\n`;
        // Hide
        if (!item.visible) hideCSS += `#${item.id} { display: none !important; }\n`;
        // Rename (CSS-only technique: text-indent + ::after)
        if (item.name !== ORIGINAL_NAMES[item.id]) {
          renameCSS += `#${item.id} .nav-title { display: block !important; text-indent: -99999px !important; line-height: 0 !important; }\n`;
          renameCSS += `#${item.id} .nav-title::after { content: "${item.name.replace(/"/g, '\\"')}" !important; line-height: initial !important; display: block !important; text-indent: 0 !important; }\n`;
        }
      }
      if (item.type === 'divider') {
        dividerCount++;
        // Dividers are injected by JS, styled by CSS
      }
      if (item.type === 'folder') {
        // Folder items get high order values, JS moves them
        if (item.children) walk(item.children, ord * 100);
      }
    });
  }
  walk(state.items, 0);

  // Logo CSS
  let logoCSS = '';
  if (state.logo.url) {
    logoCSS = `
/* Custom Logo */
#sidebar-v2 .agency-logo-container img.agency-logo {
  content: url('${state.logo.url}') !important;
  max-width: 180px !important;
  height: 40px !important;
  object-fit: contain !important;
}`;
  }

  return `/* =========================================
   SPARK SIDEBAR THEME
   Gerado por Spark Sidebar Customizer
   ========================================= */

/* === Sidebar Background === */
.sidebar-v2-location #sidebar-v2 .default-bg-color,
.sidebar-v2-location #sidebar-v2.default-bg-color,
.sidebar-v2-agency #sidebar-v2 .default-bg-color,
.sidebar-v2-agency #sidebar-v2.default-bg-color,
.v2-open #sidebar-v2 {
  background: ${c.bg} !important;
}
${logoCSS}

/* === Location Switcher === */
#location-switcher-sidbar-v2 .hl_switcher-loc-name {
  color: ${c.activeText} !important;
}
#location-switcher-sidbar-v2 .hl_switcher-loc-city {
  color: ${c.text} !important;
}

/* === Search Bar === */
#globalSearchOpener .search-placeholder,
#globalSearchOpener .search-shortcut,
#sidebar-v2 .search-icon {
  color: ${c.text} !important;
}

/* === Menu Text Color === */
#sidebar-v2 .hl_nav-header a .nav-title,
#sidebar-v2 .hl_nav-settings a .nav-title,
nav .text-white,
nav span {
  color: ${c.text} !important;
  font-size: ${fs}px !important;
}

/* === Menu Icon Color (stroke-based) === */
#sidebar-v2 nav svg path {
  stroke: ${c.icon} !important;
}
/* Icons that use fill (Contacts, Sites, Agency Partners) */
#sb_contacts svg path,
#sb_sites svg path,
#sb_agency-partners svg path {
  fill: ${c.icon} !important;
  stroke: none !important;
}
/* Img icons opacity */
#sidebar-v2 .hl_nav-header a img,
#sidebar-v2 .hl_nav-settings a img {
  opacity: 0.65 !important;
  transition: opacity 0.2s ease !important;
}
/* Custom link FA icons */
#sidebar-v2 a.custom-link i {
  color: ${c.icon} !important;
}

/* === Hover State === */
#sidebar-v2 .hl_nav-header a:hover,
#sidebar-v2 .hl_nav-settings a:hover {
  background: ${c.hover} !important;
  border-radius: ${br}px !important;
  opacity: 1 !important;
}
#sidebar-v2 .hl_nav-header a:hover .nav-title,
#sidebar-v2 .hl_nav-settings a:hover .nav-title {
  color: ${c.activeText} !important;
}
#sidebar-v2 .hl_nav-header a:hover img {
  opacity: 1 !important;
}
#sidebar-v2 a.custom-link:hover i {
  color: ${c.activeText} !important;
}

/* === Active State === */
#sidebar-v2 .hl_nav-header a.active,
#sidebar-v2 .hl_nav-header a.exact-active {
  background: ${c.active} !important;
  border-radius: ${br}px !important;
  opacity: 1 !important;
}
#sidebar-v2 .hl_nav-header a.active .nav-title,
#sidebar-v2 .hl_nav-header a.exact-active .nav-title {
  color: ${c.activeText} !important;
  font-weight: 600 !important;
}
#sidebar-v2 .hl_nav-header a.active img,
#sidebar-v2 .hl_nav-header a.exact-active img {
  opacity: 1 !important;
}

/* === Flexbox Reorder === */
.hl_nav-header > nav {
  display: flex !important;
  flex-flow: column nowrap !important;
}
${orderCSS}
/* === Hidden Items === */
${hideCSS}
/* === Renamed Items === */
${renameCSS}
/* === Base Item Styling === */
#sidebar-v2 .hl_nav-header nav > a {
  transition: background 0.2s ease, opacity 0.2s ease !important;
  margin: 1px 8px !important;
  border-radius: ${br}px !important;
}

/* === Hide original GHL dividers (we add our own via JS) === */
#sidebar-v2 .hl_nav-header nav > .divider {
  display: none !important;
}

/* === Spark Divider === */
.spark-divider {
  height: 1px !important;
  margin: 8px 16px !important;
  background: ${c.text} !important;
  opacity: 0.15 !important;
  flex-shrink: 0 !important;
}

/* === Spark Folder === */
.spark-folder-header {
  display: flex !important;
  align-items: center !important;
  padding: 8px 20px !important;
  cursor: pointer !important;
  user-select: none !important;
}
.spark-folder-header:hover {
  background: ${c.hover} !important;
  border-radius: ${br}px !important;
  margin: 0 8px !important;
}
.spark-folder-label {
  font-size: 10px !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.08em !important;
  color: ${c.text} !important;
  opacity: 0.5 !important;
}
.spark-folder-arrow {
  width: 12px !important;
  height: 12px !important;
  margin-right: 6px !important;
  transition: transform 0.2s ease !important;
  color: ${c.text} !important;
  opacity: 0.4 !important;
}
.spark-folder-arrow.open {
  transform: rotate(90deg) !important;
}
.spark-folder-children {
  display: flex !important;
  flex-direction: column !important;
}
.spark-folder-children.collapsed {
  display: none !important;
}

/* === Collapse Button === */
#sidebar-v2 .hl_collapse-button {
  color: ${c.text} !important;
}
`;
}

// ===========================================================
//  GENERATE JS — MutationObserver + routeChangeEvent
// ===========================================================
function generateJS() {
  const config = {
    items: state.items,
    colors: state.colors,
  };

  return `<script>
/* =========================================
   SPARK SIDEBAR JS
   Gerado por Spark Sidebar Customizer
   ========================================= */
(function() {
  var CONFIG = ${JSON.stringify(config)};

  function applySidebar() {
    var sidebar = document.getElementById('sidebar-v2');
    if (!sidebar) return;
    var nav = sidebar.querySelector('.hl_nav-header nav');
    if (!nav) return;

    // Remove previously injected spark elements
    sidebar.querySelectorAll('.spark-folder-header, .spark-folder-children, .spark-divider').forEach(function(el) { el.remove(); });

    // Process config items
    CONFIG.items.forEach(function(item) {
      if (item.type === 'folder' && item.visible !== false) {
        createFolder(item, nav);
      }
      if (item.type === 'divider') {
        createDivider(nav, item.id);
      }
    });
  }

  function createFolder(folder, nav) {
    var header = document.createElement('div');
    header.className = 'spark-folder-header';
    header.setAttribute('data-spark-id', folder.id);
    header.innerHTML = '<svg class="spark-folder-arrow' + (folder.collapsed ? '' : ' open') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg><span class="spark-folder-label">' + escHTML(folder.name) + '</span>';

    var children = document.createElement('div');
    children.className = 'spark-folder-children' + (folder.collapsed ? ' collapsed' : '');
    children.setAttribute('data-spark-id', folder.id + '-children');

    header.addEventListener('click', function() {
      var arrow = header.querySelector('.spark-folder-arrow');
      if (children.classList.contains('collapsed')) {
        children.classList.remove('collapsed');
        arrow.classList.add('open');
      } else {
        children.classList.add('collapsed');
        arrow.classList.remove('open');
      }
    });

    nav.appendChild(header);

    // Move child items into folder
    if (folder.children) {
      folder.children.forEach(function(child) {
        if (child.visible === false) return;
        if (child.type === 'divider') { createDivider(children, child.id); return; }
        var elId = child.type === 'native' ? child.id : child.id;
        var el = document.getElementById(elId);
        if (el) children.appendChild(el);
      });
    }

    nav.appendChild(children);
  }

  function createDivider(container, id) {
    var d = document.createElement('div');
    d.className = 'spark-divider';
    d.setAttribute('data-spark-id', id);
    container.appendChild(d);
  }

  function escHTML(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // Initial run with MutationObserver
  var observer = new MutationObserver(function(mutations, obs) {
    var nav = document.querySelector('#sidebar-v2 .hl_nav-header nav');
    if (nav && nav.children.length > 3) {
      obs.disconnect();
      setTimeout(applySidebar, 300);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Re-run on SPA route changes
  window.addEventListener('routeChangeEvent', function() {
    setTimeout(applySidebar, 500);
  });

  // Fallback: also try after load
  window.addEventListener('load', function() {
    setTimeout(applySidebar, 1000);
  });
})();
</script>`;
}

// ===== LIVE PREVIEW INJECTION =====
function injectPreview() {
  try {
    const iframe = document.getElementById('preview-iframe');
    if (!iframe || !iframe.contentDocument) return;
    const doc = iframe.contentDocument;

    // Inject or update CSS
    let style = doc.getElementById('spark-preview-css');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'spark-preview-css';
      (doc.head || doc.documentElement).appendChild(style);
    }
    style.textContent = generateCSS();

    // Inject or update JS (only once per iframe load, via a flag)
    if (!iframe._sparkJsInjected) {
      const js = generateJS();
      // Extract JS content from <script>...</script> wrapper
      const jsContent = js.replace(/^<script>\n?/, '').replace(/<\/script>$/, '');
      const script = doc.createElement('script');
      script.id = 'spark-preview-js';
      script.textContent = jsContent;
      (doc.body || doc.documentElement).appendChild(script);
      iframe._sparkJsInjected = true;
    }
  } catch (e) {
    // Cross-origin blocked. This is normal for GHL.
    // The preview won't update live, but Deploy still works perfectly.
  }
}

function refreshPreview() {
  const iframe = document.getElementById('preview-iframe');
  iframe._sparkJsInjected = false;
  iframe.src = iframe.src; // reload
}

// ===== HELPERS =====
function esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
function showToast(msg, type) {
  const t = document.getElementById('toast'); t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => { t.className = 'toast'; }, 2500);
}
