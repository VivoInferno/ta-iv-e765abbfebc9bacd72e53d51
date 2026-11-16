/* Tres Aguas internal plan: load shapes + lots, then take over render, details and stats. */
(function () {
  const STATUS_FILL = {
    available: null,
    pending: '#D4A017',
    making_payment: '#3D8A9C',
    sold: '#8B1A1A',
    split: '#6B4C9A',
    firm30: '#E07A3D',
    firm100: '#2A9D8F'
  };
  const STATUS_CSS = {
    available: 'is-available',
    pending: 'is-pending',
    making_payment: 'is-making_payment',
    sold: 'is-sold',
    split: 'is-split',
    firm30: 'is-firm30',
    firm100: 'is-firm100'
  };
  const canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const INTERNAL_I18N = {
    en: {
      pending: 'Pending',
      making_payment: 'Making Payment',
      split: 'Split ownership',
      firm30: 'FIRM30',
      firm100: 'Firm 100',
      buyer: 'Buyer',
      salePrice: 'Sale price',
      paid: 'Amount paid',
      balance: 'Balance',
      saleDate: 'Sale date',
      notes: 'Notes',
      share: 'Share',
      listPrice: 'List price',
      statPe: 'Pending',
      statMp: 'Paying',
      title: 'Tres Aguas Internal Plan',
      noDetail: 'Tap a lot to see details',
      rotate: 'Rotate your phone',
      viewBuyer: 'View Buyer Info'
    },
    es: {
      pending: 'Pendiente',
      making_payment: 'En pago',
      split: 'Propiedad compartida',
      firm30: 'FIRM30',
      firm100: 'Firm 100',
      buyer: 'Comprador',
      salePrice: 'Precio de venta',
      paid: 'Monto pagado',
      balance: 'Saldo',
      saleDate: 'Fecha de venta',
      notes: 'Notas',
      share: 'Participacion',
      listPrice: 'Precio de lista',
      statPe: 'Pendiente',
      statMp: 'En pago',
      title: 'Plan interno Tres Aguas',
      noDetail: 'Toca un lote para ver detalles',
      rotate: 'Gira el telefono',
      viewBuyer: 'Ver info del comprador'
    }
  };

  function ti(key) {
    const pack = INTERNAL_I18N[typeof curLang === 'string' ? curLang : 'en'] || INTERNAL_I18N.en;
    if (pack[key]) return pack[key];
    if (typeof t === 'function') return t(key);
    return key;
  }

  function money(mxn, already, perM2) {
    if (already && curCur !== 'MXN') {
      const val = perM2 ? Math.round(already) : (typeof roundTo900 === 'function' ? roundTo900(already) : Math.round(already));
      return '$' + Number(val).toLocaleString() + ' ' + curCur + (perM2 ? '/m\u00b2' : '');
    }
    if (!mxn && mxn !== 0) return '-';
    if (!mxn) return '-';
    if (perM2 && curCur === 'MXN') return '$' + Math.round(mxn).toLocaleString() + ' ' + curCur + '/m\u00b2';
    return fmtPrice(mxn, !!perM2);
  }

  function buyerLine(entry) {
    if (!entry) return '';
    if (Array.isArray(entry.buyers) && entry.buyers.length) {
      return entry.buyers.map(function (b) { return b.display || [b.first, b.last].filter(Boolean).join(' '); }).filter(Boolean).join(', ');
    }
    return '';
  }

  function statusLabel(code) {
    if (!code) return '-';
    if (code === 'available') return typeof t === 'function' ? t('avail') : 'Available';
    if (code === 'sold') return typeof t === 'function' ? t('sold') : 'Sold';
    return ti(code);
  }

  function pctLabel(n) {
    if (n == null || n === '') return '';
    const v = Number(n);
    if (!isFinite(v)) return '';
    return Math.round(v * 100) + '%';
  }

  function mergeI18n() {
    Object.keys(INTERNAL_I18N).forEach(function (lang) {
      if (typeof I18N !== 'undefined' && I18N[lang]) {
        I18N[lang].pending = INTERNAL_I18N[lang].pending;
        I18N[lang].making_payment = INTERNAL_I18N[lang].making_payment;
        I18N[lang].split = INTERNAL_I18N[lang].split;
        I18N[lang].noDetail = INTERNAL_I18N[lang].noDetail;
        I18N[lang].statPe = INTERNAL_I18N[lang].statPe;
        I18N[lang].statMp = INTERNAL_I18N[lang].statMp;
      }
    });
    if (typeof SMAP !== 'undefined') {
      SMAP.available = ti('avail') === 'avail' ? (curLang === 'es' ? 'Disponible' : 'Available') : (typeof t === 'function' ? t('avail') : 'Available');
      SMAP.sold = typeof t === 'function' ? t('sold') : 'Sold';
      SMAP.pending = ti('pending');
      SMAP.making_payment = ti('making_payment');
      SMAP.split = ti('split');
      SMAP.firm30 = ti('firm30');
      SMAP.firm100 = ti('firm100');
    }
    if (typeof TNAMES !== 'undefined') {
      TNAMES.LW = 'Laguna West';
    }
    if (typeof TIER_LABEL !== 'undefined') {
      TIER_LABEL.LW = 'Laguna West';
    }
    if (typeof TCOLORS !== 'undefined') {
      TCOLORS.LW = '#5B7C99';
    }
    if (typeof TIER_TYPE !== 'undefined') {
      TIER_TYPE.LW = 'LW';
    }
  }

  function applyLotsPayload(payload) {
    const records = (payload && payload.lots) ? payload.lots : [];
    const byRecord = {};
    const byLot = {};
    records.forEach(function (rec) {
      if (rec.record_id) byRecord[rec.record_id] = rec;
      if (rec.lot_id) {
        if (!byLot[rec.lot_id]) byLot[rec.lot_id] = [];
        byLot[rec.lot_id].push(rec);
      }
    });
    if (payload && payload.fx_backup && typeof fxRates !== 'undefined') {
      if (!(Number(fxRates.USD) > 0) && payload.fx_backup.USD) fxRates.USD = payload.fx_backup.USD;
      if (!(Number(fxRates.CAD) > 0) && payload.fx_backup.CAD) fxRates.CAD = payload.fx_backup.CAD;
    }
    SHAPES.forEach(function (shape) {
      if (!shape.lot_id) return;
      var recs = [];
      if (shape.record_ids && shape.record_ids.length) {
        recs = shape.record_ids.map(function (id) { return byRecord[id]; }).filter(Boolean);
      }
      if (!recs.length && byLot[shape.lot_id]) recs = byLot[shape.lot_id].slice();
      var primary = recs[0] || null;
      var statuses = recs.map(function (r) { return r.status; });
      var unique = statuses.filter(function (s, i) { return statuses.indexOf(s) === i; });
      var status = primary ? primary.status : (shape.status || 'available');
      if (recs.length > 1 && unique.length > 1) status = 'split';
      var typeCode = (primary && primary.tier) || (typeof TIER_TYPE !== 'undefined' && TIER_TYPE[shape.tier]) || shape.tier || 'B';
      lotData[shape.id] = {
        type: typeCode,
        size: (primary && primary.m2) || shape.size,
        status: status,
        lot_id: shape.lot_id,
        list_price: (primary && primary.list_price_mxn) || shape.list_price || 0,
        perm2: (primary && primary.perm2_mxn) || shape.perm2 || 0,
        amenity: !!(shape.amenity || (primary && primary.amenity)),
        special: !!(shape.special || (primary && primary.special)),
        records: recs,
        primary: primary
      };
    });
  }

  function fillMoney(el, mxn, alt) {
    if (!el) return;
    if (curCur === 'USD' && alt && alt.usd) { el.textContent = money(null, alt.usd, false); return; }
    if (curCur === 'CAD' && alt && alt.cad) { el.textContent = money(null, alt.cad, false); return; }
    el.textContent = (mxn || mxn === 0) ? money(mxn, null, false) : '-';
  }

  function writeShare(container, rec) {
    const wrap = document.createElement('div');
    wrap.className = 'share-block';
    const lab = document.createElement('div');
    lab.className = 'share-label';
    lab.textContent = (rec.share_label || rec.old_lot || ti('share')) + ' - ' + statusLabel(rec.status);
    wrap.appendChild(lab);
    const rows = [
      [ti('buyer'), buyerLine(rec) || '-'],
      [ti('salePrice'), null],
      [ti('paid'), null],
      [ti('balance'), null]
    ];
    rows.forEach(function (pair) {
      const row = document.createElement('div');
      row.className = 'lcrow';
      const k = document.createElement('span'); k.className = 'lck'; k.textContent = pair[0];
      const v = document.createElement('span'); v.className = 'lcv';
      if (pair[0] === ti('salePrice')) {
        if (curCur === 'USD' && rec.sold_price_usd) v.textContent = money(null, rec.sold_price_usd);
        else if (curCur === 'CAD' && rec.sold_price_cad) v.textContent = money(null, rec.sold_price_cad);
        else v.textContent = rec.sold_price_mxn ? money(rec.sold_price_mxn) : '-';
      } else if (pair[0] === ti('paid')) {
        if (curCur === 'USD' && rec.paid_usd) v.textContent = money(null, rec.paid_usd);
        else if (curCur === 'CAD' && rec.paid_cad) v.textContent = money(null, rec.paid_cad);
        else v.textContent = rec.paid_mxn ? money(rec.paid_mxn) : '-';
        const p = pctLabel(rec.pct_paid);
        if (p && v.textContent !== '-') v.textContent += ' (' + p + ')';
      } else if (pair[0] === ti('balance')) {
        if (curCur === 'USD' && rec.balance_usd) v.textContent = money(null, rec.balance_usd);
        else if (curCur === 'CAD' && rec.balance_cad) v.textContent = money(null, rec.balance_cad);
        else v.textContent = (rec.balance_mxn || rec.balance_mxn === 0) ? money(rec.balance_mxn) : '-';
      } else {
        v.textContent = pair[1];
      }
      row.appendChild(k); row.appendChild(v); wrap.appendChild(row);
    });
    if (rec.purchase_date) {
      const row = document.createElement('div');
      row.className = 'lcrow';
      const k = document.createElement('span'); k.className = 'lck'; k.textContent = ti('saleDate');
      const v = document.createElement('span'); v.className = 'lcv'; v.textContent = rec.purchase_date;
      row.appendChild(k); row.appendChild(v); wrap.appendChild(row);
    }
    if (rec.notes) {
      const row = document.createElement('div');
      row.className = 'lcrow';
      const k = document.createElement('span'); k.className = 'lck'; k.textContent = ti('notes');
      const v = document.createElement('span'); v.className = 'lcv internal-notes'; v.textContent = rec.notes;
      row.appendChild(k); row.appendChild(v); wrap.appendChild(row);
    }
    container.appendChild(wrap);
  }

  function fillInternal(prefix, data) {
    const box = document.getElementById(prefix + 'internal');
    if (!box) return;
    box.innerHTML = '';
    if (!data) return;
    const recs = data.records && data.records.length ? data.records : (data.primary ? [data.primary] : []);
    if (!recs.length) return;
    if (recs.length > 1) {
      recs.forEach(function (rec) { writeShare(box, rec); });
      return;
    }
    const rec = recs[0];
    const showSale = rec.status && rec.status !== 'available';
    const rows = [];
    rows.push([ti('buyer'), buyerLine(rec) || (showSale ? '-' : '')]);
    if (showSale) {
      rows.push(['sale', rec]);
      rows.push(['paid', rec]);
      rows.push(['balance', rec]);
      rows.push([ti('saleDate'), rec.purchase_date || '-']);
      if (rec.notes) rows.push([ti('notes'), rec.notes, 'notes']);
    } else if (rec.notes) {
      rows.push([ti('notes'), rec.notes, 'notes']);
    }
    rows.forEach(function (pair) {
      if (pair[1] === '' && pair[0] === ti('buyer')) return;
      const row = document.createElement('div');
      row.className = 'lcrow';
      const k = document.createElement('span'); k.className = 'lck';
      const v = document.createElement('span'); v.className = 'lcv';
      if (pair[0] === 'sale') {
        k.textContent = ti('salePrice');
        if (curCur === 'USD' && rec.sold_price_usd) v.textContent = money(null, rec.sold_price_usd);
        else if (curCur === 'CAD' && rec.sold_price_cad) v.textContent = money(null, rec.sold_price_cad);
        else v.textContent = rec.sold_price_mxn ? money(rec.sold_price_mxn) : '-';
      } else if (pair[0] === 'paid') {
        k.textContent = ti('paid');
        if (curCur === 'USD' && rec.paid_usd) v.textContent = money(null, rec.paid_usd);
        else if (curCur === 'CAD' && rec.paid_cad) v.textContent = money(null, rec.paid_cad);
        else v.textContent = rec.paid_mxn ? money(rec.paid_mxn) : '-';
        const p = pctLabel(rec.pct_paid);
        if (p && v.textContent !== '-') v.textContent += ' (' + p + ')';
      } else if (pair[0] === 'balance') {
        k.textContent = ti('balance');
        if (curCur === 'USD' && rec.balance_usd) v.textContent = money(null, rec.balance_usd);
        else if (curCur === 'CAD' && rec.balance_cad) v.textContent = money(null, rec.balance_cad);
        else v.textContent = (rec.balance_mxn || rec.balance_mxn === 0) ? money(rec.balance_mxn) : '-';
      } else {
        k.textContent = pair[0];
        v.textContent = pair[1] || '-';
        if (pair[2] === 'notes') v.classList.add('internal-notes');
      }
      row.appendChild(k); row.appendChild(v); box.appendChild(row);
    });
  }

  function styleBadge(el, status) {
    if (!el) return;
    el.textContent = statusLabel(status);
    el.className = 'lcbadge ' + (STATUS_CSS[status] || '');
    el.style.cssText = '';
  }

  function priceFor(data) {
    if (!data) return { pm: null, tot: null, hide: true };
    const rec = data.primary;
    const isClosed = data.status && data.status !== 'available' && data.status !== 'pending';
    const showList = data.status === 'available' || data.status === 'pending';
    const pm = showList ? (data.perm2 || (prices && prices[data.type]) || 0) : (rec && rec.sold_price_mxn && data.size ? rec.sold_price_mxn / data.size : 0);
    const tot = showList ? (data.list_price || (pm && data.size ? pm * data.size : 0)) : (rec && rec.sold_price_mxn) || 0;
    return { pm: pm, tot: tot, hide: !showList && !tot, showList: showList, isClosed: isClosed };
  }

  window.render = function render() {
    const g = document.getElementById('lotsG');
    if (!g) return;
    g.innerHTML = '';
    const sorted = [...SHAPES].sort(function (a, b) { return a.id === selId ? 1 : b.id === selId ? -1 : 0; });
    sorted.forEach(function (shape) {
      const isNamed = !!(shape.lot_id);
      const data = isNamed ? lotData[shape.id] : null;
      const type = data ? data.type : (typeof TIER_TYPE !== 'undefined' ? TIER_TYPE[shape.tier] : shape.tier);
      if (activeFilt && type !== activeFilt) return;
      const c = (isNamed && data ? (TCOLORS[data.type] || TCOLORS[shape.tier]) : tierColor(shape.tier));
      const status = data ? data.status : 'available';
      const isAmenity = !!(data && data.amenity);
      const isDashedAmenity = !!(data && data.amenity && (shape.tier === 'SC' || shape.tier === 'DS'));
      const isSoldStyle = !isAmenity && status !== 'available';
      const baseA = isAmenity ? 0.28 : 0.62;
      const fa = isSoldStyle ? 0.0 : baseA;
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', ptsStr(shape.pts));
      if (shape.lot_id) poly.setAttribute('data-lot', shape.lot_id);
      if (shape.id) poly.setAttribute('data-id', shape.id);
      poly.setAttribute('fill', fa > 0 ? hexA(c, fa) : 'none');
      if (shape.id === selId) {
        poly.setAttribute('stroke', c);
        poly.setAttribute('stroke-width', '3');
        poly.setAttribute('fill', c);
        poly.setAttribute('fill-opacity', '0.88');
        const animFill = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        animFill.setAttribute('attributeName', 'fill-opacity');
        animFill.setAttribute('values', '0.88;1;0.88');
        animFill.setAttribute('dur', '1.4s');
        animFill.setAttribute('repeatCount', 'indefinite');
        poly.appendChild(animFill);
        const animStroke = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        animStroke.setAttribute('attributeName', 'stroke-opacity');
        animStroke.setAttribute('values', '0.8;1;0.8');
        animStroke.setAttribute('dur', '1.4s');
        animStroke.setAttribute('repeatCount', 'indefinite');
        poly.appendChild(animStroke);
        const animWidth = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        animWidth.setAttribute('attributeName', 'stroke-width');
        animWidth.setAttribute('values', '3;5;3');
        animWidth.setAttribute('dur', '1.4s');
        animWidth.setAttribute('repeatCount', 'indefinite');
        poly.appendChild(animWidth);
      } else if (isDashedAmenity) {
        poly.setAttribute('stroke', hexA(c, 0.9));
        poly.setAttribute('stroke-width', '2');
        poly.setAttribute('stroke-dasharray', '3 3');
      } else if (isSoldStyle) {
        poly.setAttribute('stroke', hexA(c, 0.35));
        poly.setAttribute('stroke-width', '1.5');
      } else {
        poly.setAttribute('stroke', hexA(c, 0.85));
        poly.setAttribute('stroke-width', '1.8');
      }
      poly.style.cursor = 'pointer';
      poly.style.transition = 'fill 0.15s';
      poly.style.touchAction = 'manipulation';
      const isSel = shape.id === selId;
      const restStroke = poly.getAttribute('stroke');
      poly.addEventListener('mouseenter', function (e) {
        if (!isSel) {
          poly.setAttribute('fill', hexA(c, isSoldStyle ? 0.15 : isAmenity ? 0.45 : 0.82));
          if (!isSoldStyle && !isAmenity) poly.setAttribute('stroke', c);
        }
        if (canHover) showTT(e, shape);
      });
      poly.addEventListener('mousemove', function (e) { if (canHover) moveTT(e); });
      poly.addEventListener('mouseleave', function () {
        if (!isSel) { poly.setAttribute('fill', fa > 0 ? hexA(c, fa) : 'none'); poly.setAttribute('stroke', restStroke); }
        hideTT();
      });
      (function (targetShape, targetPoly) {
        var pt = null;
        var lastPick = 0;
        function pickLot() {
          var now = Date.now();
          if (now - lastPick < 350) return;
          lastPick = now;
          hideTT();
          selectShape(targetShape);
        }
        targetPoly.addEventListener('click', function (e) {
          if (e && e.pointerType === 'touch') return;
          pickLot();
        });
        targetPoly.addEventListener('pointerdown', function (e) {
          if (e.pointerType !== 'mouse') pt = { x: e.clientX, y: e.clientY };
        });
        targetPoly.addEventListener('pointerup', function (e) {
          if (!pt) return;
          var dx = e.clientX - pt.x, dy = e.clientY - pt.y;
          pt = null;
          if (dx * dx + dy * dy < 144) pickLot();
        });
        targetPoly.addEventListener('touchend', function (e) {
          if (!e.changedTouches || !e.changedTouches[0]) return;
          if (e.touches && e.touches.length) return;
          // If this looks like the end of a one-finger tap, select.
          // Pan/pinch handlers on the wrap still run; the movement gate is on pointerup.
        }, { passive: true });
      })(shape, poly);
      g.appendChild(poly);
    });
  };

  window.updateStats = function updateStats() {
    const counted = SHAPES.filter(function (s) { return s.lot_id && !(lotData[s.id] && lotData[s.id].amenity); });
    const st = function (s) { return lotData[s.id] && lotData[s.id].status; };
    function set(id, n) { const el = document.getElementById(id); if (el) el.textContent = n; }
    const av = counted.filter(function (s) { return st(s) === 'available'; }).length;
    const pe = counted.filter(function (s) { return st(s) === 'pending'; }).length;
    const mp = counted.filter(function (s) { return st(s) === 'making_payment' || st(s) === 'firm30' || st(s) === 'firm100'; }).length;
    const so = counted.filter(function (s) { return st(s) === 'sold' || st(s) === 'split'; }).length;
    set('h-av', av); set('h-pe', pe); set('h-mp', mp); set('h-so', so); set('h-tt', counted.length);
    set('mh-av', av); set('mh-pe', pe); set('mh-mp', mp); set('mh-so', so); set('mh-tt', counted.length);
  };

  const origShowTT = window.showTT;
  window.showTT = function showTT(e, shape) {
    if (!canHover) return;
    const data = lotData[shape.id];
    const isNamed = !!(shape.lot_id);
    document.getElementById('t-id').style.display = '';
    document.getElementById('t-tier').style.display = '';
    document.getElementById('tt').classList.remove('amenity');
    document.querySelectorAll('#tt .tt-r').forEach(function (r) { r.style.display = ''; });
    document.getElementById('t-id').textContent = isNamed ? shape.lot_id : t('unassigned');
    const tl = document.getElementById('t-tier');
    tl.textContent = (TIER_LABEL[shape.tier] || shape.tier);
    tl.style.color = tierColor(shape.tier);
    document.getElementById('t-st').textContent = data ? statusLabel(data.status) : '-';
    const sz = data ? data.size : (shape.size || null);
    document.getElementById('t-m2').textContent = sz ? Number(sz).toLocaleString() + ' m\u00b2' : '-';
    const pr = priceFor(data);
    const rec = data && data.primary;
    if (pr.showList) {
      document.getElementById('t-p2').textContent = pr.pm ? fmtPrice(pr.pm, true) : '-';
      document.getElementById('t-tot').textContent = pr.tot ? fmtPrice(pr.tot, false) : '-';
    } else {
      document.getElementById('t-p2').textContent = '-';
      document.getElementById('t-tot').textContent = rec && rec.sold_price_mxn ? money(rec.sold_price_mxn) : '-';
    }
    const buyerEl = document.getElementById('t-buyer');
    const buyRow = document.getElementById('tt-buyer-row');
    if (buyerEl && buyRow) {
      const names = data && data.records && data.records.length > 1
        ? data.records.map(buyerLine).filter(Boolean).join(' / ')
        : buyerLine(rec);
      buyerEl.textContent = names || '-';
      buyRow.style.display = names ? '' : 'none';
    }
    moveTT(e);
    TTel.classList.add('on');
  };


  let lastPrivacyLot = null;
  let buyerUnlocked = false;

  function isPrivateStatus(status) {
    return !!(status && status !== 'available');
  }

  function applyBuyerPrivacy(data) {
    const lotKey = (typeof selId !== 'undefined') ? selId : null;
    if (lotKey !== lastPrivacyLot) {
      buyerUnlocked = false;
      lastPrivacyLot = lotKey;
    }
    const privateLot = isPrivateStatus(data && data.status);
    const box = document.getElementById('c-internal');
    const btn = document.getElementById('btn-view-buyer');
    const blur = privateLot && !buyerUnlocked;
    if (box) {
      box.classList.toggle('is-blurred', blur);
      box.setAttribute('aria-hidden', blur ? 'true' : 'false');
    }
    if (btn) {
      btn.hidden = !(privateLot && !buyerUnlocked);
      btn.setAttribute('aria-expanded', (!blur && privateLot) ? 'true' : 'false');
      btn.textContent = ti('viewBuyer');
    }
    // Sold-style list/sale prices in the top card are private; hide them so they are not shown unblurred.
    const hideTopPrice = privateLot && data.status !== 'pending';
    ['c-pm', 'c-tot'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el && el.parentElement) el.parentElement.style.display = hideTopPrice ? 'none' : '';
    });
  }

  function revealBuyerInfo() {
    buyerUnlocked = true;
    const box = document.getElementById('c-internal');
    const btn = document.getElementById('btn-view-buyer');
    if (box) {
      box.classList.remove('is-blurred');
      box.setAttribute('aria-hidden', 'false');
    }
    if (btn) {
      btn.hidden = true;
      btn.setAttribute('aria-expanded', 'true');
    }
    if (typeof fitLotPanel === 'function') fitLotPanel();
  }

  function fitLotPanel() {
    const sb = document.querySelector('.sb');
    const root = document.documentElement;
    if (!sb) return;
    const vw = window.innerWidth;
    const minMap = Math.max(340, Math.round(vw * 0.50));
    const maxSb = Math.max(280, vw - minMap);
    let size = 0.86;
    const rowsOf = function () {
      return sb.querySelectorAll('.lch, .lcrow');
    };
    const apply = function () {
      root.style.setProperty('--sb-font', size + 'rem');
      root.style.setProperty('--sb-width', maxSb + 'px');
    };
    apply();
    const longest = function () {
      let m = 0;
      rowsOf().forEach(function (row) {
        if (row.querySelector('.internal-notes')) return;
        m = Math.max(m, row.scrollWidth);
      });
      return m;
    };
    const pad = 32;
    let need = longest() + pad;
    let guard = 0;
    while (need > maxSb && size > 0.60 && guard < 20) {
      size -= 0.025;
      apply();
      need = longest() + pad;
      guard += 1;
    }
    const finalW = Math.min(maxSb, Math.max(Math.round(need), Math.round(vw * 0.34)));
    root.style.setProperty('--sb-width', finalW + 'px');
  }

  window.revealBuyerInfo = revealBuyerInfo;
  window.fitLotPanel = fitLotPanel;

  window.selectShape = function selectShape(shape) {
    selId = shape.id;
    const data = lotData[shape.id];
    const isNamed = !!(shape.lot_id);
    const c = isNamed && data ? (TCOLORS[data.type] || tierColor(shape.tier)) : tierColor(shape.tier);
    document.getElementById('c-id').textContent = isNamed ? shape.lot_id : t('unassigned');
    const ct = document.getElementById('c-type');
    ct.textContent = (data && TNAMES[data.type]) || TIER_LABEL[shape.tier] || shape.tier;
    ct.style.cssText = 'background:' + hexA(c, 0.12) + ';color:' + c + ';border:1px solid ' + hexA(c, 0.4);
    ['c-cat', 'c-pm', 'c-tot', 'c-badge', 'c-sz'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el && el.parentElement) el.parentElement.style.display = '';
    });
    const lcard = document.getElementById('lcard');
    if (lcard) { lcard.classList.add('on'); lcard.classList.remove('amenity'); }
    const ph = document.getElementById('ph');
    if (ph) ph.style.display = 'none';
    if (isNamed && data) {
      document.getElementById('c-cat').textContent = TNAMES[data.type] || TIER_LABEL[shape.tier] || '';
      document.getElementById('c-sz').textContent = data.size ? Number(data.size).toLocaleString() + ' m\u00b2' : '-';
      const pr = priceFor(data);
      const rec = data.primary;
      if (pr.showList) {
        document.getElementById('c-pm').textContent = pr.pm ? fmtPrice(pr.pm, true) : '-';
        document.getElementById('c-tot').textContent = pr.tot ? fmtPrice(Math.round(pr.tot), false) : '-';
        document.getElementById('ttk-pm') && (document.querySelector('#c-pm') || {}).parentElement;
        const pmLbl = document.getElementById('c-pm').previousElementSibling;
        const totLbl = document.getElementById('c-tot').previousElementSibling;
        if (pmLbl) pmLbl.textContent = t('pricepm');
        if (totLbl) totLbl.textContent = t('total');
      } else {
        document.getElementById('c-pm').textContent = rec && rec.sold_price_mxn && data.size ? money(rec.sold_price_mxn / data.size, rec.sold_price_usd && data.size ? rec.sold_price_usd / data.size : null, true) : '-';
        fillMoney(document.getElementById('c-tot'), rec && rec.sold_price_mxn, rec && { usd: rec.sold_price_usd, cad: rec.sold_price_cad });
        const totLbl = document.getElementById('c-tot').previousElementSibling;
        if (totLbl) totLbl.textContent = ti('salePrice');
      }
      styleBadge(document.getElementById('c-badge'), data.status);
    }
    fillInternal('c-', data);
    applyBuyerPrivacy(data);
    const acts = document.getElementById('c-acts');
    if (acts) acts.style.display = 'none';
    if (typeof mobSelectShape === 'function') mobSelectShape(shape);
    render();
    fitLotPanel();
  };

  const origMob = window.mobSelectShape;
  window.mobSelectShape = function mobSelectShape(shape) {
    if (typeof isMobile === 'function' && !isMobile()) return;
    const data = lotData[shape.id];
    const isNamed = !!(shape.lot_id);
    const c = isNamed && data ? (TCOLORS[data.type] || tierColor(shape.tier)) : tierColor(shape.tier);
    const none = document.getElementById('mob-lot-none');
    if (none) none.style.display = 'none';
    const card = document.getElementById('mob-lcard');
    if (card) { card.classList.add('on'); card.classList.remove('amenity'); }
    ['mob-c-cat', 'mob-c-pm', 'mob-c-tot', 'mob-c-badge', 'mob-c-sz'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el && el.parentElement) el.parentElement.style.display = '';
    });
    document.getElementById('mob-c-id').textContent = isNamed ? shape.lot_id : t('unassigned');
    const ct = document.getElementById('mob-c-type');
    if (ct) {
      ct.textContent = (data && TNAMES[data.type]) || TIER_LABEL[shape.tier] || shape.tier;
      ct.style.cssText = 'background:' + hexA(c, 0.12) + ';color:' + c + ';border:1px solid ' + hexA(c, 0.4);
    }
    if (isNamed && data) {
      document.getElementById('mob-c-cat').textContent = TNAMES[data.type] || TIER_LABEL[shape.tier] || '';
      document.getElementById('mob-c-sz').textContent = data.size ? Number(data.size).toLocaleString() + ' m\u00b2' : '-';
      const pr = priceFor(data);
      const rec = data.primary;
      if (pr.showList) {
        document.getElementById('mob-c-pm').textContent = pr.pm ? fmtPrice(pr.pm, true) : '-';
        document.getElementById('mob-c-tot').textContent = pr.tot ? fmtPrice(Math.round(pr.tot), false) : '-';
      } else {
        document.getElementById('mob-c-pm').textContent = rec && rec.sold_price_mxn && data.size ? money(rec.sold_price_mxn / data.size, null, true) : '-';
        fillMoney(document.getElementById('mob-c-tot'), rec && rec.sold_price_mxn, rec && { usd: rec.sold_price_usd, cad: rec.sold_price_cad });
      }
      styleBadge(document.getElementById('mob-c-badge'), data.status);
    }
    fillInternal('mob-c-', data);
    const acts = document.getElementById('mob-acts');
    if (acts) acts.style.display = 'none';
    const peek = document.getElementById('mob-peek');
    if (peek) peek.textContent = isNamed ? shape.lot_id : t('unassigned');
    if (typeof openSheet === 'function') openSheet();
  };

  const origApply = window.applyI18n;
  window.applyI18n = function applyI18n() {
    mergeI18n();
    if (typeof origApply === 'function') origApply();
    const L = I18N[curLang] || {};
    [['lbl-pe', 'statPe'], ['lbl-mp', 'statMp'], ['mlbl-pe', 'statPe'], ['mlbl-mp', 'statMp']].forEach(function (pair) {
      const el = document.getElementById(pair[0]);
      if (el) el.textContent = L[pair[1]] || ti(pair[1]);
    });
    const ttk = document.getElementById('ttk-buyer');
    if (ttk) ttk.textContent = ti('buyer');
    document.documentElement.lang = curLang === 'es' ? 'es' : 'en';
    const rotateMsg = document.getElementById('rotate-msg');
    if (rotateMsg) rotateMsg.textContent = ti('rotate');
    const vbtn = document.getElementById('btn-view-buyer');
    if (vbtn) vbtn.textContent = ti('viewBuyer');
    const title = document.querySelector('title');
    if (title) title.textContent = ti('title');
    if (selId) {
      const shape = SHAPES.find(function (s) { return s.id === selId; });
      if (shape) selectShape(shape);
    }
  };

  function syncOrientation() {
    const portrait = (window.matchMedia && window.matchMedia('(orientation: portrait)').matches)
      || (window.innerHeight > window.innerWidth);
    const gate = document.getElementById('rotate-gate');
    if (gate) gate.hidden = !portrait;
    document.documentElement.classList.toggle('is-portrait', !!portrait);
    document.body.classList.toggle('is-portrait', !!portrait);
  }


  window.fitMap = function fitMap() {
    const wrap = document.getElementById('mapwrap');
    const cont = document.getElementById('mapContainer');
    if (!wrap || !cont) return;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    if (!W || !H) return;
    const s = Math.max(W / 2592, H / 1728);
    const ntx = (W - 2592 * s) / 2;
    const nty = (H - 1728 * s) / 2;
    scale = s;
    tx = ntx;
    ty = nty;
    tx_val = ntx;
    ty_val = nty;
    cont.style.transform = 'translate(' + ntx + 'px,' + nty + 'px) scale(' + s + ')';
  };

  function installOrientationLock() {
    syncOrientation();
    window.addEventListener('resize', syncOrientation);
    window.addEventListener('orientationchange', syncOrientation);
    if (window.matchMedia) {
      const mq = window.matchMedia('(orientation: portrait)');
      if (mq.addEventListener) mq.addEventListener('change', syncOrientation);
      else if (mq.addListener) mq.addListener(syncOrientation);
    }
  }

  document.documentElement.style.setProperty('--sheet-peek', '72px');
  installOrientationLock();
  document.addEventListener('click', function (e) {
    const btn = e.target && e.target.closest && e.target.closest('#btn-view-buyer');
    if (btn) { e.preventDefault(); revealBuyerInfo(); }
  });
  window.addEventListener('resize', function () { fitLotPanel(); });


  function registerSW() {
    var cfg = window.TA_INTERNAL || {};
    if (cfg.mode === 'wp') return;
    if (!('serviceWorker' in navigator)) return;
    var hadController = !!navigator.serviceWorker.controller;
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; }
      if (reloading) return;
      reloading = true;
      location.reload();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
        const check = function () { reg.update().catch(function () {}); };
        check();
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') check();
        });
        window.addEventListener('pageshow', function () { check(); });
      }).catch(function (err) { console.warn('SW failed', err); });
    });
  }

  const BUILD = (window.TA_INTERNAL && window.TA_INTERNAL.build) || 'v6';
  var liveDataOk = false;

  function showDataNotice(msg) {
    const el = document.getElementById('data-notice');
    if (!el) return;
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = msg;
  }

  function formatDataDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
  }

  async function fetchJson(url, opts) {
    const res = await fetch(url, opts || {});
    if (!res.ok) throw new Error('http ' + res.status);
    return res.json();
  }

  async function loadLiveLots(cfg) {
    if (!cfg.liveUrl) throw new Error('no live url');
    const sep = cfg.liveUrl.indexOf('?') >= 0 ? '&' : '?';
    const url = cfg.liveUrl + sep + 't=' + Date.now();
    const data = await fetchJson(url, { cache: 'no-cache', mode: 'cors', credentials: 'omit' });
    if (!data || !Array.isArray(data.lots) || !data.lots.length) {
      const err = new Error((data && data.error) || 'live empty');
      err.payload = data;
      throw err;
    }
    return data;
  }

  async function loadBundledLots(cfg) {
    const base = cfg.dataUrl || './lots.json';
    const sep = base.indexOf('?') >= 0 ? '&' : '?';
    return fetchJson(base + sep + 'v=' + encodeURIComponent(BUILD) + '&t=' + Date.now(), { cache: 'no-cache', credentials: cfg.credentials || 'same-origin' });
  }

  function applyLoadedLots(lotsPayload, fromLive) {
    lotData = {};
    applyLotsPayload(lotsPayload);
    if (typeof updateStats === 'function') updateStats();
    if (typeof render === 'function') render();
    liveDataOk = !!fromLive;
    if (fromLive) showDataNotice('');
    else showDataNotice('Offline data from ' + (formatDataDate(lotsPayload && lotsPayload.generated_at) || 'the last build'));
    if (selId) {
      const shape = SHAPES.find(function (s) { return s.id === selId; });
      if (shape) selectShape(shape);
    }
  }

  async function refreshLiveLots(cfg, silent) {
    try {
      const data = await loadLiveLots(cfg);
      applyLoadedLots(data, true);
      return true;
    } catch (err) {
      if (!silent) console.warn('Live lot data unavailable', err && err.message);
      return false;
    }
  }

  async function boot() {
    mergeI18n();
    const cfg = window.TA_INTERNAL || { dataUrl: './lots.json', shapesUrl: './shapes.json', credentials: 'same-origin' };
    const bootEl = document.getElementById('ta-boot');
    const tag = document.getElementById('build-tag');
    if (tag) tag.textContent = BUILD;
    try {
      const opts = { credentials: cfg.credentials || 'same-origin', cache: 'no-cache' };
      const shapesUrl = (cfg.shapesUrl || './shapes.json');
      const shapesSep = shapesUrl.indexOf('?') >= 0 ? '&' : '?';
      const shapesRes = await fetch(shapesUrl + shapesSep + 'v=' + encodeURIComponent(BUILD) + '&t=' + Date.now(), opts);
      if (!shapesRes.ok) throw new Error('shapes ' + shapesRes.status);
      const shapesPayload = await shapesRes.json();
      SHAPES = shapesPayload.shapes || shapesPayload;

      var lotsPayload = null;
      var fromLive = false;
      try {
        lotsPayload = await loadLiveLots(cfg);
        fromLive = true;
      } catch (liveErr) {
        lotsPayload = await loadBundledLots(cfg);
        fromLive = false;
      }
      if (!lotsPayload || !lotsPayload.lots) throw new Error('lots missing');
      applyLoadedLots(lotsPayload, fromLive);
      if (bootEl) bootEl.hidden = true;
      if (typeof init === 'function') init();
      syncOrientation();
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') refreshLiveLots(cfg, true);
      });
      window.addEventListener('pageshow', function () { refreshLiveLots(cfg, true); });
    } catch (err) {
      if (bootEl) {
        bootEl.hidden = false;
        bootEl.textContent = 'Could not load the plan.';
      }
      showDataNotice('Could not load lot data');
      console.warn('Internal plan failed to load', err);
    }
  }

  registerSW();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
