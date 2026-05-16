// ═══════════════════════════════════════════════════════════════════
// PHASE 2 · #1 Quick Action FAB (Mobile only)
// ─────────────────────────────────────────────────────────────────
//   ปุ่มลอย + มุมขวาล่าง บนมือถือ
//   แตะ → เด้ง 5 shortcuts → เลือก action → patient picker → open modal
//
//   Shortcuts:
//     📊 บันทึก vital     → _openVitalModal(null, patId, patId)
//     💧 บันทึก I/O      → _openExcretionModal(null, patId, today)
//     📋 บันทึกพยาบาล   → set nursing-pat-id + openModal('modal-add-nursing')
//     ⚠️  อุบัติเหตุ      → set ta-inc-id + openModal('modal-incident')
//     🏥 เปิดผู้พัก       → openPatientProfile(patId)
// ═══════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  let _fabOpen = false;
  let _pickerOpen = false;
  let _pendingAction = null; // function ที่จะรันหลังเลือก patient

  // ── Helpers ──────────────────────────────────────────────────────
  function _escape(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[<>&"']/g, function(c) {
      return { '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function _initials(name) {
    if (!name) return '?';
    const parts = String(name).replace(/^(นาย|นาง|นางสาว|น\.ส\.|ด\.ช\.|ด\.ญ\.|คุณ|พระ|พ\.|ม\.ร\.ว\.)\s*/, '').trim().split(/\s+/);
    return (parts[0] || '').slice(0, 2);
  }

  function _normalize(s) {
    return String(s || '').toLowerCase().trim();
  }

  // ─────────────────────────────────────────────────────────────────
  // FAB BUTTON + SHORTCUTS MENU
  // ─────────────────────────────────────────────────────────────────

  function _renderFAB() {
    if (document.getElementById('fab-container')) return;
    const container = document.createElement('div');
    container.id = 'fab-container';
    container.className = 'fab-container';
    container.innerHTML = '' +
      '<div id="fab-shortcuts" class="fab-shortcuts">' +
      '  <button class="fab-shortcut" data-action="vital" onclick="_fabShortcutClick(\'vital\')">' +
      '    <span class="fab-shortcut-icon">📊</span>' +
      '    <span class="fab-shortcut-label">บันทึก Vital</span>' +
      '  </button>' +
      '  <button class="fab-shortcut" data-action="io" onclick="_fabShortcutClick(\'io\')">' +
      '    <span class="fab-shortcut-icon">💧</span>' +
      '    <span class="fab-shortcut-label">บันทึก I/O</span>' +
      '  </button>' +
      '  <button class="fab-shortcut" data-action="nursing" onclick="_fabShortcutClick(\'nursing\')">' +
      '    <span class="fab-shortcut-icon">📋</span>' +
      '    <span class="fab-shortcut-label">บันทึกพยาบาล</span>' +
      '  </button>' +
      '  <button class="fab-shortcut" data-action="incident" onclick="_fabShortcutClick(\'incident\')">' +
      '    <span class="fab-shortcut-icon">⚠️</span>' +
      '    <span class="fab-shortcut-label">อุบัติเหตุ</span>' +
      '  </button>' +
      '  <button class="fab-shortcut" data-action="open-patient" onclick="_fabShortcutClick(\'open-patient\')">' +
      '    <span class="fab-shortcut-icon">🏥</span>' +
      '    <span class="fab-shortcut-label">เปิดผู้พัก</span>' +
      '  </button>' +
      '</div>' +
      '<button id="fab-main-btn" class="fab-main-btn" onclick="_toggleFAB()" aria-label="เมนูด่วน">' +
      '  <span class="fab-icon-plus">+</span>' +
      '  <span class="fab-icon-close">✕</span>' +
      '</button>' +
      '<div id="fab-backdrop" class="fab-backdrop" onclick="_closeFAB()"></div>';
    document.body.appendChild(container);
  }

  function _toggleFAB() {
    if (_fabOpen) _closeFAB();
    else _openFAB();
  }

  function _openFAB() {
    _renderFAB();
    _fabOpen = true;
    const c = document.getElementById('fab-container');
    if (c) c.classList.add('open');
  }

  function _closeFAB() {
    _fabOpen = false;
    const c = document.getElementById('fab-container');
    if (c) c.classList.remove('open');
  }

  // ─────────────────────────────────────────────────────────────────
  // PATIENT PICKER (overlay)
  // ─────────────────────────────────────────────────────────────────

  function _renderPicker() {
    if (document.getElementById('fab-picker-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'fab-picker-overlay';
    overlay.className = 'fab-picker-overlay';
    overlay.innerHTML = '' +
      '<div class="fab-picker-modal">' +
      '  <div class="fab-picker-header">' +
      '    <div class="fab-picker-title" id="fab-picker-title">เลือกผู้พัก</div>' +
      '    <button class="fab-picker-close" onclick="_closePicker()">✕</button>' +
      '  </div>' +
      '  <div class="fab-picker-search">' +
      '    <span class="fab-picker-search-icon">🔍</span>' +
      '    <input type="text" id="fab-picker-input" class="fab-picker-input" placeholder="ค้นหาชื่อหรือ HN..." autocomplete="off">' +
      '  </div>' +
      '  <div class="fab-picker-results" id="fab-picker-results"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) _closePicker();
    });
    const input = document.getElementById('fab-picker-input');
    if (input) {
      input.addEventListener('input', function(e) {
        _renderPickerResults(e.target.value);
      });
    }
  }

  function _openPicker(actionLabel) {
    _renderPicker();
    _pickerOpen = true;
    const title = document.getElementById('fab-picker-title');
    if (title) title.textContent = actionLabel || 'เลือกผู้พัก';
    const overlay = document.getElementById('fab-picker-overlay');
    if (overlay) overlay.classList.add('open');
    const input = document.getElementById('fab-picker-input');
    if (input) {
      input.value = '';
      setTimeout(function() { input.focus(); }, 100);
    }
    _renderPickerResults('');
  }

  function _closePicker() {
    _pickerOpen = false;
    _pendingAction = null;
    const overlay = document.getElementById('fab-picker-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  function _renderPickerResults(query) {
    const container = document.getElementById('fab-picker-results');
    if (!container) return;
    if (typeof db === 'undefined' || !db.patients) {
      container.innerHTML = '<div class="fab-empty">กำลังโหลดข้อมูล...</div>';
      return;
    }

    const q = _normalize(query);
    let html = '';

    if (!q) {
      // Show Pinned + Recent
      const pinnedIds = window._pinnedPatients || [];
      const recent = (function() {
        try {
          const raw = localStorage.getItem('navasri_recent_patients');
          return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
      })();

      // Pinned section
      const pinnedPatients = pinnedIds
        .map(id => db.patients.find(p => String(p.id) === String(id)))
        .filter(Boolean);
      if (pinnedPatients.length > 0) {
        html += '<div class="fab-section-title">📍 ปักหมุด</div>';
        pinnedPatients.forEach(function(p) {
          html += _renderPickerItem(p, true);
        });
      }

      // Recent section
      const recentFiltered = recent
        .filter(r => !pinnedIds.includes(r.id))
        .map(r => db.patients.find(p => String(p.id) === String(r.id)))
        .filter(Boolean)
        .slice(0, 5);
      if (recentFiltered.length > 0) {
        html += '<div class="fab-section-title">🕐 ดูล่าสุด</div>';
        recentFiltered.forEach(function(p) {
          html += _renderPickerItem(p, false);
        });
      }

      if (!html) {
        html = '<div class="fab-empty">พิมพ์ชื่อหรือ HN เพื่อค้นหาผู้พัก</div>';
      } else {
        html += '<div class="fab-section-title" style="margin-top:14px;">🔍 หรือพิมพ์ค้นหา</div>' +
                '<div class="fab-hint">พิมพ์ชื่อ / HN / เลขบัตร ในช่องด้านบน</div>';
      }
    } else {
      // Search mode
      const results = [];
      for (const p of db.patients) {
        const name = _normalize(p.name);
        const hn = _normalize(p.hn);
        const idcard = _normalize(p.idcard || p.idCard);
        if (name.includes(q) || hn.includes(q) || idcard.includes(q)) {
          results.push(p);
          if (results.length >= 15) break;
        }
      }
      // Sort: active first
      results.sort(function(a, b) {
        const aPri = a.status === 'active' ? 1 : a.status === 'hospital' ? 2 : 3;
        const bPri = b.status === 'active' ? 1 : b.status === 'hospital' ? 2 : 3;
        return aPri - bPri;
      });

      if (results.length === 0) {
        html = '<div class="fab-empty">ไม่พบ "<strong>' + _escape(query) + '</strong>"</div>';
      } else {
        html += '<div class="fab-section-title">🔍 ผลการค้นหา · ' + results.length + ' คน</div>';
        results.forEach(function(p) {
          html += _renderPickerItem(p, (window._pinnedPatients || []).includes(p.id));
        });
      }
    }
    container.innerHTML = html;
  }

  function _renderPickerItem(p, isPinned) {
    if (!p) return '';
    const initials = _initials(p.name);
    let bedDisplay = '';
    if (p.currentBedId && typeof db !== 'undefined' && db.beds) {
      const bed = (db.beds || []).find(b => String(b.id) === String(p.currentBedId));
      if (bed) bedDisplay = bed.bedCode || '';
    }
    const statusBadge = p.status === 'active' ? '' :
                        p.status === 'hospital' ? ' <span class="fab-badge">🏥 รพ.</span>' :
                        p.status === 'discharged' ? ' <span class="fab-badge fab-badge-gray">ออกแล้ว</span>' : '';
    return '<div class="fab-item" onclick="_fabPickPatient(\'' + p.id + '\')">' +
             '<div class="fab-avatar">' + _escape(initials) + '</div>' +
             '<div class="fab-body">' +
               '<div class="fab-name">' + _escape(p.name || '-') + (isPinned ? ' <span class="fab-star">★</span>' : '') + statusBadge + '</div>' +
               '<div class="fab-sub">' +
                 (p.hn ? 'HN ' + _escape(p.hn) : '') +
                 (bedDisplay ? ' · ' + _escape(bedDisplay) : '') +
               '</div>' +
             '</div>' +
             '<div class="fab-arrow">→</div>' +
           '</div>';
  }

  // ─────────────────────────────────────────────────────────────────
  // SHORTCUT HANDLERS
  // ─────────────────────────────────────────────────────────────────

  const SHORTCUT_HANDLERS = {
    'vital': {
      label: 'บันทึก Vital — เลือกผู้พัก',
      action: function(patId) {
        if (typeof _openVitalModal === 'function') {
          _openVitalModal(null, patId, patId);
        } else if (typeof toast === 'function') {
          toast('ฟังก์ชัน Vital ยังไม่พร้อมใช้', 'error');
        }
      }
    },
    'io': {
      label: 'บันทึก I/O — เลือกผู้พัก',
      action: function(patId) {
        if (typeof _openExcretionModal === 'function') {
          const today = new Date().toISOString().slice(0, 10);
          _openExcretionModal(null, patId, today);
        } else if (typeof toast === 'function') {
          toast('ฟังก์ชัน I/O ยังไม่พร้อมใช้', 'error');
        }
      }
    },
    'nursing': {
      label: 'บันทึกพยาบาล — เลือกผู้พัก',
      action: function(patId) {
        // เปิด profile + tab nursing
        if (typeof openPatientProfile === 'function') {
          openPatientProfile(patId, 'nursing');
          setTimeout(function() {
            // เปิด modal นาฬิกาผ่าน UI
            const addBtn = document.querySelector('button[onclick*="openModal(\'modal-add-nursing\')"]');
            if (addBtn) {
              const hiddenPatId = document.getElementById('nursing-pat-id');
              if (hiddenPatId) hiddenPatId.value = patId;
              addBtn.click();
            }
          }, 800);
        }
      }
    },
    'incident': {
      label: 'อุบัติเหตุ — เลือกผู้พัก',
      action: function(patId) {
        // เปิด modal incident ตรงๆ + set typeahead
        const p = (typeof db !== 'undefined') ? (db.patients || []).find(x => String(x.id) === String(patId)) : null;
        if (typeof openModal === 'function') {
          openModal('modal-incident');
          setTimeout(function() {
            const hidId = document.getElementById('ta-inc-id');
            const inpName = document.getElementById('ta-inc-inp');
            if (hidId) hidId.value = patId;
            if (inpName && p) inpName.value = p.name || '';
          }, 100);
        }
      }
    },
    'open-patient': {
      label: 'เปิดผู้พัก — เลือก',
      action: function(patId) {
        if (typeof openPatientProfile === 'function') {
          openPatientProfile(patId);
        }
      }
    }
  };

  function _shortcutClick(action) {
    const handler = SHORTCUT_HANDLERS[action];
    if (!handler) return;
    _closeFAB();
    _pendingAction = handler.action;
    setTimeout(function() {
      _openPicker(handler.label);
    }, 150);
  }

  function _pickPatient(patId) {
    if (!patId) return;
    const action = _pendingAction;
    _closePicker();
    if (typeof action === 'function') {
      setTimeout(function() {
        try {
          action(patId);
        } catch (e) {
          console.error('[fab] action error:', e);
          if (typeof toast === 'function') toast('เปิดฟังก์ชันไม่สำเร็จ', 'error');
        }
      }, 200);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // EXPORT GLOBALS
  // ─────────────────────────────────────────────────────────────────
  window._toggleFAB = _toggleFAB;
  window._closeFAB = _closeFAB;
  window._fabShortcutClick = _shortcutClick;
  window._fabPickPatient = _pickPatient;
  window._closePicker = _closePicker;

  // ── INIT ─────────────────────────────────────────────────────────
  function _init() {
    // Only render FAB on mobile (handled by CSS but check viewport too)
    if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
      _renderFAB();
    } else {
      // For desktop, still render FAB but CSS will hide it (matchMedia ตอน resize)
      _renderFAB();
    }
    // Listen for resize
    if (window.matchMedia) {
      window.matchMedia('(max-width: 768px)').addEventListener('change', function(e) {
        // FAB visibility ขึ้นกับ CSS — ไม่ต้อง re-render
      });
    }
    // Escape closes
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        if (_pickerOpen) _closePicker();
        else if (_fabOpen) _closeFAB();
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
