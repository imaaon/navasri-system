// ═══════════════════════════════════════════════════════════════════
// PHASE 2 · #6 Recent / Pinned Patients
// ─────────────────────────────────────────────────────────────────
//   Recent:  เปิดดูล่าสุด 5 คน  → localStorage (device-specific)
//   Pinned:  ปักหมุดผู้พัก       → Supabase user_pins (user-specific)
//
//   Render targets:
//     - Desktop: sidebar widget (ก่อน .nav-section "หลัก")
//     - Mobile:  More drawer (bottom-tab-bar overlay)
// ═══════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── Constants ─────────────────────────────────────────────────────
  const LS_KEY_RECENT = 'navasri_recent_patients';
  const RECENT_LIMIT = 5;
  // [Phase 3 · 20 พ.ค. 69] จำกัดจำนวน pin ต่อ user เพื่อรองรับ bulk handover workflow
  const PIN_LIMIT = 7;

  // ── State (memory cache) ──────────────────────────────────────────
  window._pinnedPatients = window._pinnedPatients || [];  // array of patient IDs

  // ── Initials helper ──────────────────────────────────────────────
  function _initials(name) {
    if (!name) return '?';
    const parts = String(name).replace(/^(นาย|นาง|นางสาว|น\.ส\.|ด\.ช\.|ด\.ญ\.|คุณ|พระ|พ\.|ม\.ร\.ว\.)\s*/, '').trim().split(/\s+/);
    if (parts.length === 0) return '?';
    const first = parts[0] || '';
    return first.slice(0, 2);
  }

  // ── Time ago helper ──────────────────────────────────────────────
  function _timeAgo(ts) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'เมื่อสักครู่';
    if (min < 60) return min + 'm';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + 'h';
    const day = Math.floor(hr / 24);
    return day + 'd';
  }

  // ─────────────────────────────────────────────────────────────────
  // RECENT (localStorage)
  // ─────────────────────────────────────────────────────────────────

  function getRecent() {
    try {
      const raw = localStorage.getItem(LS_KEY_RECENT);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr;
    } catch (e) {
      return [];
    }
  }

  function pushRecent(patientId) {
    if (!patientId) return;
    let recent = getRecent();
    // remove if exists (to move to top)
    recent = recent.filter(r => r.id !== patientId);
    // prepend
    recent.unshift({ id: patientId, ts: Date.now() });
    // limit
    recent = recent.slice(0, RECENT_LIMIT);
    try {
      localStorage.setItem(LS_KEY_RECENT, JSON.stringify(recent));
    } catch (e) {}
    renderRecentPinned();
  }

  function clearRecent() {
    try { localStorage.removeItem(LS_KEY_RECENT); } catch (e) {}
    renderRecentPinned();
  }

  // ─────────────────────────────────────────────────────────────────
  // PINNED (Supabase user_pins)
  // ─────────────────────────────────────────────────────────────────

  // Helper: เข้าถึง currentUser แบบปลอดภัย (เพราะเป็น let ใน auth.js)
  function _getCurrentUser() {
    try {
      return (typeof currentUser !== 'undefined') ? currentUser : null;
    } catch (e) {
      return null;
    }
  }

  async function loadPins() {
    const u = _getCurrentUser();
    if (typeof supa === 'undefined' || !u?.authId) {
      window._pinnedPatients = [];
      return [];
    }
    try {
      const { data, error } = await supa
        .from('user_pins')
        .select('patient_id, pinned_at')
        .eq('user_auth_id', u.authId)
        .order('pinned_at', { ascending: false });
      if (error) {
        console.warn('[pins] load error:', error.message);
        window._pinnedPatients = [];
        return [];
      }
      window._pinnedPatients = (data || []).map(p => p.patient_id);
      return window._pinnedPatients;
    } catch (e) {
      console.warn('[pins] load exception:', e);
      window._pinnedPatients = [];
      return [];
    }
  }

  async function togglePin(patientId) {
    const u = _getCurrentUser();
    if (!patientId || !u?.authId) return false;
    const isPinned = window._pinnedPatients.includes(patientId);
    try {
      if (isPinned) {
        // unpin
        const { error } = await supa
          .from('user_pins')
          .delete()
          .eq('user_auth_id', u.authId)
          .eq('patient_id', patientId);
        if (error) throw error;
        window._pinnedPatients = window._pinnedPatients.filter(id => id !== patientId);
        if (typeof toast === 'function') toast('ยกเลิกการปักหมุดแล้ว', 'info');
      } else {
        // pin
        // [Phase 3 · 20 พ.ค. 69] เช็ค limit ก่อน insert
        if (window._pinnedPatients.length >= PIN_LIMIT) {
          if (typeof toast === 'function') {
            toast('ปักหมุดได้สูงสุด ' + PIN_LIMIT + ' คน — กรุณายกเลิกการปักหมุดคนที่ไม่ต้องการก่อน', 'warning');
          }
          return false;
        }
        const { error } = await supa
          .from('user_pins')
          .insert({ user_auth_id: u.authId, patient_id: patientId });
        if (error) throw error;
        window._pinnedPatients.unshift(patientId);
        if (typeof toast === 'function') toast('ปักหมุดแล้ว ⭐', 'success');
      }
      renderRecentPinned();
      return !isPinned; // new state
    } catch (e) {
      console.error('[pins] toggle error:', e);
      if (typeof toast === 'function') toast('บันทึกหมุดไม่สำเร็จ', 'error');
      return isPinned;
    }
  }

  function isPinned(patientId) {
    return window._pinnedPatients.includes(patientId);
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER (sidebar widget)
  // ─────────────────────────────────────────────────────────────────

  function _patientLookup(id) {
    if (typeof db === 'undefined' || !db.patients) return null;
    return db.patients.find(p => String(p.id) === String(id));
  }

  function _renderItem(patient, opts) {
    if (!patient) return '';
    opts = opts || {};
    const initials = _initials(patient.name);
    const subtitle = opts.timestamp
      ? _timeAgo(opts.timestamp)
      : (patient.currentBedCode || patient.bedCode || '');
    const star = opts.showStar ? '<span class="rp-star">★</span>' : '';
    return `
      <div class="rp-item" onclick="openPatientProfile('${patient.id}')" title="${patient.name}">
        <div class="rp-avatar">${initials}</div>
        <div class="rp-body">
          <div class="rp-name">${patient.name || '-'}</div>
          ${subtitle ? `<div class="rp-sub">${subtitle}</div>` : ''}
        </div>
        ${star}
      </div>
    `;
  }

  function renderRecentPinned() {
    const target = document.getElementById('sidebar-recent-pinned');
    if (!target) return;

    const recent = getRecent();
    const pinned = window._pinnedPatients || [];

    let html = '';

    // Pinned section
    if (pinned.length > 0) {
      html += '<div class="rp-section-title">📍 ปักหมุด</div>';
      pinned.slice(0, 6).forEach(id => {
        const p = _patientLookup(id);
        if (p) html += _renderItem(p, { showStar: true });
      });
    }

    // Recent section
    const recentFiltered = recent.filter(r => !pinned.includes(r.id));  // exclude already pinned
    if (recentFiltered.length > 0) {
      html += '<div class="rp-section-title">🕐 ดูล่าสุด</div>';
      recentFiltered.slice(0, RECENT_LIMIT).forEach(r => {
        const p = _patientLookup(r.id);
        if (p) html += _renderItem(p, { timestamp: r.ts });
      });
    }

    if (!html) {
      html = '<div class="rp-empty">ยังไม่มีผู้พักที่ดูล่าสุดหรือปักหมุด</div>';
    }

    target.innerHTML = html;
  }

  // ─────────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────────

  async function init() {
    // load pins from server (background)
    const u = _getCurrentUser();
    if (u?.authId) {
      await loadPins();
    }
    renderRecentPinned();
    // [#6-F] Sync pin buttons if patient profile is currently open
    _syncPinButtonsToCurrentProfile();
  }

  // [#6-F] After pins reload, re-sync visible pin buttons (handles race condition
  //        where profile opens before pins finish loading from Supabase)
  function _syncPinButtonsToCurrentProfile() {
    const btnDesktop = document.getElementById('patprofile-pin-btn');
    const btnMobile = document.getElementById('patprofile-mobile-pin-btn');
    if (!btnDesktop && !btnMobile) return;
    // หา patient id จาก onclick ของปุ่ม
    const onclick = (btnDesktop || btnMobile).getAttribute('onclick') || '';
    const m = onclick.match(/_togglePinForCurrentPatient\('([^']+)'\)/);
    if (!m) return;
    const patId = m[1];
    const nowPinned = isPinned(String(patId));
    if (btnDesktop) {
      btnDesktop.classList.toggle('pinned', nowPinned);
      btnDesktop.innerHTML = nowPinned ? '⭐ ปักหมุดแล้ว' : '☆ ปักหมุด';
      btnDesktop.title = nowPinned ? 'ยกเลิกการปักหมุด' : 'ปักหมุดผู้พักนี้';
    }
    if (btnMobile) {
      btnMobile.classList.toggle('pinned', nowPinned);
      btnMobile.innerHTML = nowPinned ? '⭐' : '☆';
    }
  }

  // ── Expose globals ────────────────────────────────────────────────
  window.pushRecentPatient = pushRecent;
  window.togglePinPatient = togglePin;
  window.isPatientPinned = isPinned;
  window.renderRecentPinned = renderRecentPinned;
  window.initRecentPinned = init;
  window.clearRecentPatients = clearRecent;

  // [#6-F] Toggle pin จากปุ่มในหน้า patient profile + sync UI ของปุ่มทั้ง desktop + mobile
  window._togglePinForCurrentPatient = async function(patId) {
    if (!patId) return;
    const btnDesktop = document.getElementById('patprofile-pin-btn');
    const btnMobile = document.getElementById('patprofile-mobile-pin-btn');
    // ป้องกัน double-click
    if (btnDesktop && btnDesktop.disabled) return;
    if (btnDesktop) btnDesktop.disabled = true;
    if (btnMobile) btnMobile.disabled = true;
    try {
      await togglePin(String(patId));
      const nowPinned = isPinned(String(patId));
      if (btnDesktop) {
        btnDesktop.classList.toggle('pinned', nowPinned);
        btnDesktop.innerHTML = nowPinned ? '⭐ ปักหมุดแล้ว' : '☆ ปักหมุด';
        btnDesktop.title = nowPinned ? 'ยกเลิกการปักหมุด' : 'ปักหมุดผู้พักนี้';
      }
      if (btnMobile) {
        btnMobile.classList.toggle('pinned', nowPinned);
        btnMobile.innerHTML = nowPinned ? '⭐' : '☆';
      }
    } catch (e) {
      console.error('[togglePinCurrent] error:', e);
    } finally {
      if (btnDesktop) btnDesktop.disabled = false;
      if (btnMobile) btnMobile.disabled = false;
    }
  };

  // ── Auto-init when db ready ───────────────────────────────────────
  // Note: currentUser เป็น module-scope ใน auth.js ไม่ visible จาก global
  // จึงเช็คแค่ db.patients ที่เป็น global พอ
  function _autoInit(attempt) {
    attempt = attempt || 0;
    if (attempt > 40) {
      // Timeout fallback — แสดงข้อความว่ายังไม่มีข้อมูล
      const target = document.getElementById('sidebar-recent-pinned');
      if (target) target.innerHTML = '<div class="rp-empty">ยังไม่มีผู้พักที่ดูล่าสุดหรือปักหมุด</div>';
      return;
    }
    if (typeof db === 'undefined' || !db.patients || db.patients.length === 0) {
      setTimeout(function() { _autoInit(attempt + 1); }, 500);
      return;
    }
    init();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { _autoInit(0); });
  } else {
    _autoInit(0);
  }
})();
