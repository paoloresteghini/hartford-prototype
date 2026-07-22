/* Hartford Technology Rentals — POC interaction layer (no dependencies) */
(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- mega menu ---------------- */
  const groups = document.querySelectorAll('[data-nav-group]');
  let closeTimer = null;

  const closeAll = (except) => {
    groups.forEach((g) => {
      if (g !== except) {
        g.classList.remove('open');
        g.querySelector('[data-nav-toggle]').setAttribute('aria-expanded', 'false');
      }
    });
  };

  groups.forEach((group) => {
    const toggle = group.querySelector('[data-nav-toggle]');
    const open = () => {
      clearTimeout(closeTimer);
      closeAll(group);
      document.dispatchEvent(new CustomEvent('htr:mega-open'));
      group.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
    };
    const close = () => {
      group.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    };

    group.addEventListener('mouseenter', open);
    group.addEventListener('mouseleave', () => {
      closeTimer = setTimeout(close, 160);
    });
    toggle.addEventListener('click', () => {
      group.classList.contains('open') ? close() : open();
    });
    group.addEventListener('focusout', (e) => {
      if (!group.contains(e.relatedTarget)) close();
    });

    // category rail → pane switching
    group.querySelectorAll('[data-mega-cat]').forEach((cat) => {
      const id = cat.getAttribute('data-mega-cat');
      const activate = () => {
        group.querySelectorAll('[data-mega-cat]').forEach((c) => c.setAttribute('aria-expanded', 'false'));
        cat.setAttribute('aria-expanded', 'true');
        group.querySelectorAll('[data-mega-pane]').forEach((p) => {
          p.classList.toggle('active', p.getAttribute('data-mega-pane') === id);
        });
        group.querySelectorAll('[data-mega-pane-img]').forEach((p) => {
          p.classList.toggle('active', p.getAttribute('data-mega-pane-img') === id);
        });
      };
      cat.addEventListener('mouseenter', activate);
      cat.addEventListener('focus', activate);
      cat.addEventListener('click', activate);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });
  document.addEventListener('click', (e) => {
    if (![...groups].some((g) => g.contains(e.target))) closeAll();
  });

  /* ---------------- mobile sheet ---------------- */
  const sheetRoot = document.querySelector('[data-sheet-root]');
  const sheetOpenBtn = document.querySelector('[data-sheet-open]');
  if (sheetRoot && sheetOpenBtn) {
    const setSheet = (openState) => {
      if (openState) sheetRoot.hidden = false;
      requestAnimationFrame(() => {
        document.body.classList.toggle('nav-open', openState);
        sheetOpenBtn.setAttribute('aria-expanded', String(openState));
      });
      if (!openState) setTimeout(() => (sheetRoot.hidden = true), reduced ? 0 : 380);
    };
    sheetOpenBtn.addEventListener('click', () => setSheet(true));
    sheetRoot.querySelectorAll('[data-sheet-close]').forEach((el) => el.addEventListener('click', () => setSheet(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) setSheet(false);
    });
  }

  /* ---------------- quote store ---------------- */
  const KEY = 'htr-quote-v1';
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  };
  const save = (items) => localStorage.setItem(KEY, JSON.stringify(items));
  let quote = load();

  const badge = document.querySelector('[data-quote-badge]');
  const drawerRoot = document.querySelector('[data-drawer-root]');
  const drawerItems = document.querySelector('[data-drawer-items]');
  const drawerEmpty = document.querySelector('[data-drawer-empty]');
  const drawerCount = document.querySelector('[data-drawer-count]');
  const drawerFooter = document.querySelector('[data-drawer-footer]');
  const startBtn = document.querySelector('[data-quote-start]');
  const form = document.querySelector('[data-quote-form]');
  const success = document.querySelector('[data-quote-success]');
  const template = document.querySelector('[data-drawer-item-template]');

  const totalQty = () => quote.reduce((n, item) => n + item.qty, 0);

  const renderBadge = (pop) => {
    if (!badge) return;
    const n = totalQty();
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
    badge.classList.toggle('flex', n > 0);
    if (pop && n > 0) {
      badge.classList.remove('badge-pop');
      void badge.offsetWidth;
      badge.classList.add('badge-pop');
    }
  };

  const renderDrawer = () => {
    if (!drawerItems) return;
    drawerItems.innerHTML = '';
    const has = quote.length > 0;
    drawerEmpty.classList.toggle('hidden', has);
    drawerFooter.classList.toggle('hidden', !has);
    if (startBtn) startBtn.disabled = !has;
    drawerCount.textContent = `${totalQty()} item${totalQty() === 1 ? '' : 's'}`;

    quote.forEach((item) => {
      const node = template.content.cloneNode(true);
      node.querySelector('[data-item-img]').src = item.img;
      node.querySelector('[data-item-sku]').textContent = item.sku;
      node.querySelector('[data-item-name]').textContent = item.name;
      node.querySelector('[data-item-qty]').textContent = item.qty;
      node.querySelector('[data-item-inc]').addEventListener('click', () => {
        item.qty += 1; save(quote); renderDrawer(); renderBadge(true);
      });
      node.querySelector('[data-item-dec]').addEventListener('click', () => {
        item.qty -= 1;
        if (item.qty <= 0) quote = quote.filter((x) => x.sku !== item.sku);
        save(quote); renderDrawer(); renderBadge();
      });
      node.querySelector('[data-item-remove]').addEventListener('click', () => {
        quote = quote.filter((x) => x.sku !== item.sku);
        save(quote); renderDrawer(); renderBadge();
      });
      drawerItems.appendChild(node);
    });
  };

  /* drawer open/close */
  let lastFocus = null;
  const setDrawer = (openState) => {
    if (!drawerRoot) return;
    if (openState) {
      lastFocus = document.activeElement;
      drawerRoot.hidden = false;
      // reset to list state
      form.classList.add('hidden');
      success.classList.add('hidden');
      document.querySelector('[data-drawer-body]')?.classList.remove('hidden');
      drawerFooter.classList.toggle('hidden', quote.length === 0);
      renderDrawer();
      requestAnimationFrame(() => {
        document.body.classList.add('drawer-open');
        drawerRoot.querySelector('[data-drawer-close]:not(.drawer-backdrop)')?.focus();
      });
    } else {
      document.body.classList.remove('drawer-open');
      setTimeout(() => { drawerRoot.hidden = true; }, reduced ? 0 : 380);
      lastFocus?.focus();
    }
  };

  document.querySelectorAll('[data-drawer-open]').forEach((btn) => btn.addEventListener('click', () => setDrawer(true)));
  drawerRoot?.querySelectorAll('[data-drawer-close]').forEach((el) => el.addEventListener('click', () => setDrawer(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) setDrawer(false);
  });

  startBtn?.addEventListener('click', () => {
    drawerFooter.classList.add('hidden');
    form.classList.remove('hidden');
    form.querySelector('input')?.focus();
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    form.classList.add('hidden');
    success.classList.remove('hidden');
    quote = [];
    save(quote);
    renderBadge();
    drawerItems.innerHTML = '';
    drawerCount.textContent = 'Sent';
    drawerEmpty.classList.add('hidden');
    document.querySelector('[data-drawer-body]')?.classList.add('hidden');
  });

  /* toast */
  const toast = document.querySelector('[data-toast]');
  const toastText = document.querySelector('[data-toast-text]');
  let toastTimer = null;
  const showToast = (msg) => {
    if (!toast) return;
    toastText.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  };

  /* add-to-quote buttons */
  document.querySelectorAll('[data-add-quote]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sku = btn.dataset.sku;
      const qtyInput = document.querySelector('[data-qty-input]');
      const qty = btn.hasAttribute('data-use-qty') && qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
      const existing = quote.find((x) => x.sku === sku);
      if (existing) existing.qty += qty;
      else quote.push({ sku, name: btn.dataset.name, img: btn.dataset.img, qty });
      save(quote);
      renderBadge(true);
      renderDrawer();
      showToast(`${btn.dataset.name} added to quote list`);
    });
  });

  renderBadge();
  renderDrawer();

  /* ---------------- reveals ---------------- */
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );
    document.querySelectorAll('.reveal, .reveal-img').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.reveal, .reveal-img').forEach((el) => el.classList.add('in'));
  }

  /* hero load choreography */
  const heroEls = document.querySelectorAll('.hero-media, .hero-line, .hero-fade');
  if (heroEls.length) {
    const run = () => {
      document.querySelectorAll('.hero-media').forEach((el) => el.classList.add('in'));
      document.querySelectorAll('.hero-line').forEach((el, i) => {
        setTimeout(() => el.classList.add('in'), reduced ? 0 : 220 + i * 120);
      });
      document.querySelectorAll('.hero-fade').forEach((el, i) => {
        setTimeout(() => el.classList.add('in'), reduced ? 0 : 620 + i * 100);
      });
    };
    document.readyState === 'complete' ? run() : window.addEventListener('load', run, { once: true });
    // safety: never leave hero hidden
    setTimeout(run, 1500);
  }

  /* ---------------- fleet search ---------------- */
  const searchPanel = document.querySelector('[data-search-panel]');
  const searchOpenBtn = document.querySelector('[data-search-open]');
  if (searchPanel && searchOpenBtn) {
    const input = searchPanel.querySelector('[data-search-input]');
    const results = searchPanel.querySelector('[data-search-results]');
    const emptyMsg = searchPanel.querySelector('[data-search-empty]');
    let index = [];
    try { index = JSON.parse(document.querySelector('[data-search-index]').textContent); } catch {}

    const setSearch = (openState) => {
      if (openState) {
        closeAll();
        searchPanel.hidden = false;
        renderPopular();
        requestAnimationFrame(() => {
          searchPanel.classList.add('open');
          input.focus();
        });
      } else {
        searchPanel.classList.remove('open');
        setTimeout(() => { searchPanel.hidden = true; }, reduced ? 0 : 240);
        input.value = '';
        results.innerHTML = '';
        emptyMsg.classList.add('hidden');
      }
      searchOpenBtn.setAttribute('aria-expanded', String(openState));
    };

    /* --- "intelligent" autocomplete: synonyms, typo tolerance, ranked scoring --- */
    const ALIASES = {
      cam: 'camera', cams: 'cameras', mic: 'microphone', mics: 'microphones',
      wall: 'led video wall', 'video wall': 'led video wall', screen: 'display projection',
      stream: 'streaming video', streaming: 'video recorders processing', laptop: 'computers laptops',
      laptops: 'computers', notebook: 'laptops', beamer: 'projector', tripod: 'support tripod',
      slowmo: '4k studio high speed', broadcast: 'studio 4k camera', hybrid: 'ptz conferencing',
      zoom: 'lens conferencing', drone: 'pov camera', gopro: 'pov gopro hero',
    };

    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

    const lev = (a, b) => {
      if (Math.abs(a.length - b.length) > 2) return 3;
      const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
      for (let j = 0; j <= b.length; j++) m[0][j] = j;
      for (let i = 1; i <= a.length; i++)
        for (let j = 1; j <= b.length; j++)
          m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      return m[a.length][b.length];
    };

    // vocabulary for typo correction, built from the index once
    const vocab = [...new Set(index.flatMap((it) => norm(it.label + ' ' + it.meta).split(' ')))].filter((w) => w.length > 3);

    const expandQuery = (q) => {
      let out = norm(q);
      Object.entries(ALIASES).forEach(([k, v]) => {
        if (new RegExp(`\\b${k}\\b`).test(out)) out += ' ' + v;
      });
      // typo correction: swap unknown tokens for nearest vocab word (edit distance ≤ 2)
      const corrected = [];
      out.split(' ').forEach((tok) => {
        if (tok.length > 3 && !vocab.some((w) => w.includes(tok))) {
          let best = null, bestD = 3;
          vocab.forEach((w) => { const d = lev(tok, w); if (d < bestD) { bestD = d; best = w; } });
          if (best) corrected.push(best);
        }
      });
      return { tokens: out.split(' ').filter(Boolean), corrected };
    };

    const scoreItem = (item, tokens) => {
      const label = norm(item.label);
      const meta = norm(item.meta);
      const words = label.split(' ');
      let score = 0;
      let matched = 0;
      tokens.forEach((tok) => {
        let s = 0;
        if (label === tok) s = 100;
        else if (label.startsWith(tok)) s = 60;
        else if (words.some((w) => w.startsWith(tok))) s = 40;
        else if (label.includes(tok)) s = 25;
        else if (meta.includes(tok)) s = 15;
        if (s > 0) matched += 1;
        score += s;
      });
      if (matched === 0) return 0;
      score += matched === tokens.length ? 20 : 0; // all-token bonus
      if (item.img) score += 5; // products slightly above categories
      return score;
    };

    const highlight = (label, tokens) => {
      const frag = document.createDocumentFragment();
      let re;
      try { re = new RegExp('(' + tokens.filter((t) => t.length > 1).join('|') + ')', 'ig'); } catch { re = null; }
      if (!re || !tokens.length) { frag.textContent = label; return frag; }
      label.split(re).forEach((part) => {
        if (re.test(part)) {
          const mark = document.createElement('mark');
          mark.textContent = part;
          frag.appendChild(mark);
        } else {
          frag.appendChild(document.createTextNode(part));
        }
        re.lastIndex = 0;
      });
      return frag;
    };

    const POPULAR = ['PTZ cameras', 'AK-UC4000', 'LED video wall', 'iPad', 'Projectors', 'Microphones'];
    let activeIdx = -1;

    const addRow = (hit, tokens, isTop) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = hit.href && hit.href !== '#' ? hit.href : (document.body.dataset.base || '/') + 'camera-rental/';
      a.className = 'search-row flex items-center justify-between gap-4 px-2 py-3 transition-colors hover:bg-surface';
      const left = document.createElement('span');
      left.className = 'flex items-center gap-4 min-w-0';
      if (hit.img) {
        const img = document.createElement('img');
        img.src = hit.img;
        img.alt = '';
        img.className = 'h-10 w-10 flex-none border border-line bg-white object-contain p-0.5';
        left.appendChild(img);
      }
      const text = document.createElement('span');
      text.className = 'truncate text-[0.9375rem] font-medium';
      text.appendChild(highlight(hit.label, tokens));
      left.appendChild(text);
      if (isTop) {
        const tag = document.createElement('span');
        tag.className = 'mono-label flex-none bg-ink px-1.5 py-0.5 !text-[0.625rem] text-bg';
        tag.textContent = 'Top hit';
        left.appendChild(tag);
      }
      const meta = document.createElement('span');
      meta.className = 'mono-label flex-none text-ink-3';
      meta.textContent = hit.meta;
      a.append(left, meta);
      li.appendChild(a);
      results.appendChild(li);
    };

    const renderPopular = () => {
      results.innerHTML = '';
      emptyMsg.classList.add('hidden');
      const li = document.createElement('li');
      li.className = 'px-2 pb-1 pt-2';
      li.innerHTML = '<span class="mono-label text-ink-3">Frequently searched</span>';
      results.appendChild(li);
      const wrap = document.createElement('li');
      wrap.className = 'flex flex-wrap gap-2 px-2 pb-3 pt-1 !border-t-0';
      POPULAR.forEach((term) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'border border-line px-3 py-1.5 text-sm transition-colors hover:border-ink';
        b.textContent = term;
        b.addEventListener('click', () => { input.value = term; render(term); input.focus(); });
        wrap.appendChild(b);
      });
      results.appendChild(wrap);
    };

    const render = (q) => {
      results.innerHTML = '';
      emptyMsg.classList.add('hidden');
      activeIdx = -1;
      const query = norm(q);
      if (query.length < 2) { renderPopular(); return; }
      const { tokens, corrected } = expandQuery(query);
      const scored = index
        .map((item) => ({ item, s: scoreItem(item, tokens) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 7);

      if (corrected.length && scored.length === 0) {
        // retry with corrected tokens ("did you mean")
        const tokens2 = [...tokens, ...corrected];
        const retry = index
          .map((item) => ({ item, s: scoreItem(item, corrected) }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s)
          .slice(0, 7);
        if (retry.length) {
          const li = document.createElement('li');
          li.className = 'px-2 py-2';
          li.innerHTML = `<span class="mono-label text-ink-3">Showing results for “${corrected.join(' ')}”</span>`;
          results.appendChild(li);
          retry.forEach((x, i) => addRow(x.item, tokens2, i === 0));
          return;
        }
      }
      if (!scored.length) { emptyMsg.classList.remove('hidden'); return; }
      scored.forEach((x, i) => addRow(x.item, tokens, i === 0));
    };

    searchOpenBtn.addEventListener('click', () => setSearch(searchPanel.hidden));
    searchPanel.querySelector('[data-search-close]').addEventListener('click', () => setSearch(false));

    let debounce = null;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => render(input.value), 90);
    });
    input.addEventListener('focus', () => { if (!input.value) renderPopular(); });

    const setActive = (rows, i) => {
      rows.forEach((r) => r.classList.remove('bg-surface'));
      if (rows[i]) { rows[i].classList.add('bg-surface'); rows[i].scrollIntoView({ block: 'nearest' }); }
    };
    input.addEventListener('keydown', (e) => {
      const rows = [...results.querySelectorAll('a.search-row')];
      if (!rows.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, rows.length - 1); setActive(rows, activeIdx); }
      if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, -1); setActive(rows, activeIdx); }
    });
    searchPanel.querySelector('[data-search-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const rows = [...results.querySelectorAll('a.search-row')];
      const target = rows[activeIdx] || rows[0];
      if (target) target.click();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !searchPanel.hidden) setSearch(false);
      if (e.key === '/' && searchPanel.hidden && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
        e.preventDefault();
        setSearch(true);
      }
    });
    document.addEventListener('click', (e) => {
      if (!searchPanel.hidden && !searchPanel.contains(e.target) && !searchOpenBtn.contains(e.target)) setSearch(false);
    });
    document.addEventListener('htr:mega-open', () => { if (!searchPanel.hidden) setSearch(false); });
  }

  /* running timecode (broadcast motif) */
  const tc = document.querySelector('[data-timecode]');
  if (tc && !reduced) {
    const t0 = performance.now();
    const pad = (n) => String(n).padStart(2, '0');
    setInterval(() => {
      const ms = performance.now() - t0;
      const f = Math.floor((ms % 1000) / (1000 / 30));
      const s = Math.floor(ms / 1000);
      tc.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f)}`;
    }, 1000 / 30);
  }

  /* ---------------- category filter ---------------- */
  const chips = document.querySelectorAll('[data-filter-chip]');
  const items = document.querySelectorAll('[data-filter-grid] .grid-item');
  const countEl = document.querySelector('[data-filter-count]');
  if (chips.length && items.length) {
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const val = chip.dataset.filterChip;
        chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        let shown = 0;
        items.forEach((item) => {
          const show = val === 'all' || item.dataset.type === val;
          item.classList.toggle('hide', !show);
          if (show) shown += 1;
        });
        if (countEl) countEl.textContent = `${shown} unit${shown === 1 ? '' : 's'}`;
      });
    });
  }
})();
