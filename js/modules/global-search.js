// ═══════════════════════════════════════════════════════════════════
// PHASE 2 · #5 Global Search (Cmd+K / Ctrl+K)
// ─────────────────────────────────────────────────────────────────
//   - Desktop: popup กลางจอ (max-width 640px)
//   - Mobile: full-screen overlay (จากปุ่ม 🔍 ใน topbar)
//   - Index: patients, staff, items, invoices, expenses, suppliers, menu
//   - Keyboard: Cmd+K open / ↑↓ navigate / Enter select / Esc close
// ═══════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── Menu items (สำหรับ search) ──────────────────────────────────
  const MENU_ITEMS = [
    { icon: '📊', label: 'Dashboard',           page: 'dashboard',         keywords: 'dashboard หน้าหลัก ภาพรวม' },
    { icon: '🔍', label: 'BI & วิเคราะห์กำไร',   page: 'bi',                keywords: 'bi กำไร วิเคราะห์ business intelligence' },
    { icon: '🏥', label: 'ผู้รับบริการ',          page: 'patients',          keywords: 'ผู้รับบริการ ผู้พัก คนไข้ patients' },
    { icon: '🛏️', label: 'ห้องและเตียง',         page: 'rooms',             keywords: 'ห้อง เตียง room bed' },
    { icon: '👤', label: 'พนักงาน',              page: 'staff',             keywords: 'พนักงาน staff คน' },
    { icon: '📋', label: 'รายงานสุขภาพ',         page: 'healthreport',      keywords: 'รายงานสุขภาพ health report' },
    { icon: '📦', label: 'คลังสต็อก',           page: 'stock',             keywords: 'สต็อก stock คลัง สินค้า' },
    { icon: '📋', label: 'เบิกสินค้า',          page: 'requisition',       keywords: 'เบิก requisition' },
    { icon: '🕐', label: 'รายละเอียดการเบิก',   page: 'history',           keywords: 'ประวัติเบิก history' },
    { icon: '📈', label: 'สรุปวิเคราะห์การเบิก', page: 'report',            keywords: 'สรุป report' },
    { icon: '⚠️', label: 'อุบัติเหตุ & แผลกดทับ', page: 'incident',         keywords: 'อุบัติเหตุ incident แผลกดทับ' },
    { icon: '🍽️', label: 'โภชนาการ & สายให้อาหาร', page: 'dietary',       keywords: 'โภชนาการ อาหาร dietary' },
    { icon: '💰', label: 'ระบบบัญชี',           page: 'billing',           keywords: 'บัญชี ใบแจ้งหนี้ billing invoice' },
    { icon: '🏦', label: 'มัดจำ & เงินประกัน',  page: 'deposits',          keywords: 'มัดจำ deposit ประกัน' },
    { icon: '💸', label: 'ค่าใช้จ่าย',          page: 'expenses',          keywords: 'ค่าใช้จ่าย expense' },
    { icon: '🔧', label: 'ครุภัณฑ์ & ซ่อมบำรุง', page: 'assets',           keywords: 'ครุภัณฑ์ assets ซ่อม' },
    { icon: '🔑', label: 'จัดการ Account',      page: 'accounts',          keywords: 'account จัดการ ผู้ใช้' },
    { icon: '🧾', label: 'ใบแจ้งหนี้ผู้จำหน่าย',  page: 'supplierinvoices',  keywords: 'supplier invoice ผู้จำหน่าย' },
    { icon: '🏭', label: 'ผู้จำหน่าย',          page: 'suppliers',         keywords: 'supplier ผู้จำหน่าย' },
    { icon: '📋', label: 'คำขอซื้อ',            page: 'purchaserequests',  keywords: 'pr purchase request คำขอซื้อ' },
    { icon: '📊', label: 'รายงานสต็อก',         page: 'stockreport',       keywords: 'รายงานสต็อก stock report' },
    { icon: '💬', label: 'Line & ตั้งค่า',      page: 'settings',          keywords: 'line ตั้งค่า settings' },
  ];

  // ── State ────────────────────────────────────────────────────────
  let _isOpen = false;
  let _selectedIndex = 0;
  let _currentResults = [];

  // ── Helpers ──────────────────────────────────────────────────────
  function _normalize(s) {
    return String(s || '').toLowerCase().trim();
  }

  function _initials(name) {
    if (!name) return '?';
    const parts = String(name).replace(/^(นาย|นาง|นางสาว|น\.ส\.|ด\.ช\.|ด\.ญ\.|คุณ|พระ|พ\.|ม\.ร\.ว\.)\s*/, '').trim().split(/\s+/);
    if (parts.length === 0) return '?';
    return (parts[0] || '').slice(0, 2);
  }

  function _escape(s) {
    if (!s) return '';
    return String(s).replace(/[<>&"']/g, function(c) {
      return { '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function _highlight(text, query) {
    if (!text || !query) return _escape(text);
    const lower = String(text).toLowerCase();
    const q = query.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx < 0) return _escape(text);
    return _escape(text.slice(0, idx)) +
           '<mark>' + _escape(text.slice(idx, idx + query.length)) + '</mark>' +
           _escape(text.slice(idx + query.length));
  }

  // ─────────────────────────────────────────────────────────────────
  // SEARCH (in-memory across all entities)
  // ─────────────────────────────────────────────────────────────────

  function _searchPatients(q) {
    if (typeof db === 'undefined' || !db.patients) return [];
    const results = [];
    for (const p of db.patients) {
      const name = _normalize(p.name);
      const hn = _normalize(p.hn);
      const idcard = _normalize(p.idcard || p.idCard);
      if (name.includes(q) || hn.includes(q) || idcard.includes(q)) {
        // hide discharged patients from search by default unless explicitly searching for them
        const status = p.status;
        results.push({
          category: 'ผู้รับบริการ',
          categoryIcon: '🏥',
          id: p.id,
          name: p.name,
          subtitle: [
            p.hn ? 'HN ' + p.hn : '',
            p.currentBedCode || '',
            p.dob ? (typeof calcAge === 'function' ? calcAge(p.dob) : '') : '',
            status === 'discharged' ? '(ออกแล้ว)' : status === 'hospital' ? '(อยู่ รพ.)' : ''
          ].filter(Boolean).join(' · '),
          initials: _initials(p.name),
          action: function() { if (typeof openPatientProfile === 'function') openPatientProfile(p.id); },
          // Priority: active patients first
          _priority: status === 'active' ? 1 : status === 'hospital' ? 2 : 3,
        });
      }
      if (results.length >= 12) break;
    }
    results.sort(function(a, b) { return a._priority - b._priority; });
    return results.slice(0, 6);
  }

  function _searchStaff(q) {
    if (typeof db === 'undefined' || !db.staff) return [];
    const results = [];
    for (const s of db.staff) {
      const name = _normalize(s.name);
      const position = _normalize(s.position);
      if (name.includes(q) || position.includes(q)) {
        results.push({
          category: 'พนักงาน',
          categoryIcon: '👤',
          id: s.id,
          name: s.name,
          subtitle: [s.position || '', s.role || ''].filter(Boolean).join(' · '),
          initials: _initials(s.name),
          action: function() { if (typeof showPage === 'function') showPage('staff'); },
        });
      }
      if (results.length >= 4) break;
    }
    return results;
  }

  function _searchItems(q) {
    if (typeof db === 'undefined' || !db.items) return [];
    const results = [];
    for (const it of db.items) {
      const name = _normalize(it.name);
      const code = _normalize(it.code);
      const barcode = _normalize(it.barcode);
      if (name.includes(q) || code.includes(q) || barcode.includes(q)) {
        results.push({
          category: 'สินค้า',
          categoryIcon: '📦',
          id: it.id,
          name: it.name,
          subtitle: [it.code || '', it.unit || '', 'คงเหลือ ' + (it.qty || 0)].filter(Boolean).join(' · '),
          initials: '📦',
          action: function() { if (typeof showPage === 'function') showPage('stock'); },
        });
      }
      if (results.length >= 5) break;
    }
    return results;
  }

  function _searchInvoices(q) {
    if (typeof db === 'undefined' || !db.invoices) return [];
    const results = [];
    for (const inv of db.invoices) {
      const docNo = _normalize(inv.docNo);
      const patName = _normalize(inv.patientName);
      if (docNo.includes(q) || patName.includes(q)) {
        results.push({
          category: 'ใบแจ้งหนี้',
          categoryIcon: '💰',
          id: inv.id,
          name: inv.docNo || ('Invoice #' + inv.id),
          subtitle: [
            inv.patientName || '',
            inv.amount ? '฿' + (inv.amount || 0).toLocaleString() : '',
            inv.status === 'paid' ? '✓ ชำระแล้ว' : 'รอชำระ'
          ].filter(Boolean).join(' · '),
          initials: '💰',
          action: function() { if (typeof showPage === 'function') showPage('billing'); },
        });
      }
      if (results.length >= 4) break;
    }
    return results;
  }

  function _searchExpenses(q) {
    if (typeof db === 'undefined' || !db.expenses) return [];
    const results = [];
    for (const ex of db.expenses) {
      const docNo = _normalize(ex.docNo);
      if (docNo.includes(q)) {
        results.push({
          category: 'ค่าใช้จ่าย',
          categoryIcon: '💸',
          id: ex.id,
          name: ex.docNo || ('Expense #' + ex.id),
          subtitle: [
            ex.supplierName || '',
            ex.amount ? '฿' + (ex.amount || 0).toLocaleString() : ''
          ].filter(Boolean).join(' · '),
          initials: '💸',
          action: function() { if (typeof showPage === 'function') showPage('expenses'); },
        });
      }
      if (results.length >= 3) break;
    }
    return results;
  }

  function _searchSuppliers(q) {
    if (typeof db === 'undefined' || !db.suppliers) return [];
    const results = [];
    for (const sp of db.suppliers) {
      const name = _normalize(sp.name);
      const code = _normalize(sp.code);
      if (name.includes(q) || code.includes(q)) {
        results.push({
          category: 'ผู้จำหน่าย',
          categoryIcon: '🏭',
          id: sp.id,
          name: sp.name,
          subtitle: sp.code || '',
          initials: '🏭',
          action: function() { if (typeof showPage === 'function') showPage('suppliers'); },
        });
      }
      if (results.length >= 3) break;
    }
    return results;
  }

  function _searchMenu(q) {
    const results = [];
    for (const m of MENU_ITEMS) {
      const label = _normalize(m.label);
      const keywords = _normalize(m.keywords);
      if (label.includes(q) || keywords.includes(q)) {
        results.push({
          category: 'เมนู',
          categoryIcon: '☰',
          id: m.page,
          name: m.label,
          subtitle: '',
          initials: m.icon,
          action: function() { if (typeof showPage === 'function') showPage(m.page); },
        });
      }
      if (results.length >= 4) break;
    }
    return results;
  }

  function _runSearch(query) {
    const q = _normalize(query);
    if (!q || q.length < 1) return [];
    const allResults = [];
    // ลำดับ: ผู้รับบริการ > เมนู > สินค้า > ใบแจ้งหนี้ > พนักงาน > ค่าใช้จ่าย > ผู้จำหน่าย
    allResults.push.apply(allResults, _searchPatients(q));
    allResults.push.apply(allResults, _searchMenu(q));
    allResults.push.apply(allResults, _searchItems(q));
    allResults.push.apply(allResults, _searchInvoices(q));
    allResults.push.apply(allResults, _searchStaff(q));
    allResults.push.apply(allResults, _searchExpenses(q));
    allResults.push.apply(allResults, _searchSuppliers(q));
    return allResults.slice(0, 20);
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────

  function _renderResults(results, query) {
    if (!results || results.length === 0) {
      return query
        ? '<div class="gs-empty">ไม่พบผลลัพธ์สำหรับ <strong>"' + _escape(query) + '"</strong></div>'
        : '<div class="gs-empty">เริ่มพิมพ์เพื่อค้นหา…<br><small style="opacity:0.6;">ผู้รับบริการ · สินค้า · เอกสาร · พนักงาน · เมนู</small></div>';
    }

    // Group by category
    const groups = {};
    const groupOrder = [];
    results.forEach(function(r, idx) {
      if (!groups[r.category]) {
        groups[r.category] = { icon: r.categoryIcon, items: [] };
        groupOrder.push(r.category);
      }
      groups[r.category].items.push({ result: r, index: idx });
    });

    let html = '';
    groupOrder.forEach(function(cat) {
      const g = groups[cat];
      html += '<div class="gs-group-title">' + g.icon + ' ' + _escape(cat) + ' · ' + g.items.length + '</div>';
      g.items.forEach(function(it) {
        const r = it.result;
        const isSelected = it.index === _selectedIndex;
        html += '<div class="gs-result' + (isSelected ? ' selected' : '') + '" data-idx="' + it.index + '" onclick="_globalSearchSelect(' + it.index + ')">' +
                  '<div class="gs-result-avatar">' + _escape(r.initials) + '</div>' +
                  '<div class="gs-result-body">' +
                    '<div class="gs-result-name">' + _highlight(r.name, query) + '</div>' +
                    (r.subtitle ? '<div class="gs-result-sub">' + _escape(r.subtitle) + '</div>' : '') +
                  '</div>' +
                  '<div class="gs-result-arrow">→</div>' +
                '</div>';
      });
    });
    html += '<div class="gs-footer"><kbd>↑</kbd><kbd>↓</kbd> เลือก · <kbd>↵</kbd> เปิด · <kbd>esc</kbd> ปิด · ' + results.length + ' ผลลัพธ์</div>';
    return html;
  }

  function _renderModal() {
    if (document.getElementById('global-search-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'global-search-overlay';
    overlay.className = 'gs-overlay';
    overlay.innerHTML =
      '<div class="gs-modal">' +
        '<div class="gs-header">' +
          '<span class="gs-icon">🔍</span>' +
          '<input type="text" id="gs-input" class="gs-input" placeholder="ค้นหาผู้รับบริการ · สินค้า · เอกสาร · เมนู…" autocomplete="off">' +
          '<button class="gs-close" onclick="closeGlobalSearch()" title="ปิด">esc</button>' +
        '</div>' +
        '<div class="gs-results" id="gs-results"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeGlobalSearch();
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────

  function openSearch() {
    _renderModal();
    _isOpen = true;
    _selectedIndex = 0;
    _currentResults = [];
    const overlay = document.getElementById('global-search-overlay');
    if (overlay) overlay.classList.add('open');
    const input = document.getElementById('gs-input');
    if (input) {
      input.value = '';
      input.focus();
      _updateResults('');
    }
  }

  function closeSearch() {
    _isOpen = false;
    const overlay = document.getElementById('global-search-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  function _updateResults(query) {
    _currentResults = _runSearch(query);
    if (_selectedIndex >= _currentResults.length) _selectedIndex = 0;
    const container = document.getElementById('gs-results');
    if (container) container.innerHTML = _renderResults(_currentResults, query);
    // scroll selected into view
    _scrollSelectedIntoView();
  }

  function _scrollSelectedIntoView() {
    const sel = document.querySelector('.gs-result.selected');
    if (sel && typeof sel.scrollIntoView === 'function') {
      sel.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }

  function _select(idx) {
    const r = _currentResults[idx];
    if (!r) return;
    closeSearch();
    setTimeout(function() {
      try { r.action(); } catch (e) { console.error('[search] action error:', e); }
    }, 50);
  }

  // ─────────────────────────────────────────────────────────────────
  // KEYBOARD + EVENT HANDLERS
  // ─────────────────────────────────────────────────────────────────

  function _handleKeydown(e) {
    // Cmd+K / Ctrl+K opens search (anywhere except in inputs that aren't ours)
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (_isOpen) closeSearch();
      else openSearch();
      return;
    }
    if (!_isOpen) return;
    const input = document.getElementById('gs-input');
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _selectedIndex = Math.min(_selectedIndex + 1, _currentResults.length - 1);
      const container = document.getElementById('gs-results');
      if (container && input) container.innerHTML = _renderResults(_currentResults, input.value);
      _scrollSelectedIntoView();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      _selectedIndex = Math.max(_selectedIndex - 1, 0);
      const container = document.getElementById('gs-results');
      if (container && input) container.innerHTML = _renderResults(_currentResults, input.value);
      _scrollSelectedIntoView();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      _select(_selectedIndex);
      return;
    }
  }

  function _handleInput(e) {
    _selectedIndex = 0;
    _updateResults(e.target.value);
  }

  // ─────────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────────
  window.openGlobalSearch = openSearch;
  window.closeGlobalSearch = closeSearch;
  window._globalSearchSelect = _select;

  // ── INIT ─────────────────────────────────────────────────────────
  function _init() {
    document.addEventListener('keydown', _handleKeydown);
    // bind input listener when modal exists
    document.addEventListener('input', function(e) {
      if (e.target && e.target.id === 'gs-input') _handleInput(e);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
