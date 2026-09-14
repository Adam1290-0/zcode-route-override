// ZCode route override — settings-page UI.
// Injects a "请求头 / 网络" row pair into the model-provider detail panel,
// next to the Base URL field. Anchors by structure (input[value^=http] ->
// field container), not by class names, so ZCode updates rarely break it.
// Talks to the wrapper's config server on 127.0.0.1:27891 (GET/POST /api/config).
// Re-asserted every 1.5s via interval (React re-renders may wipe the row).
(function () {
  'use strict';
  if (window.__zcodeRouteOverrideUI) return;
  window.__zcodeRouteOverrideUI = true;

  var API = 'http://127.0.0.1:27891';
  var TOKEN = (typeof ZRO_TOKEN === 'string') ? ZRO_TOKEN : ''; // injected at patch time
  var PROXY_DEFAULT = 'http://127.0.0.1:12334';
  var PRESETS = [
    { v: 'none', label: '默认（ZCode 原生）' },
    { v: 'claude-code', label: 'Claude Code' },
    { v: 'codex', label: 'Codex CLI' },
    { v: 'opensquilla', label: 'OpenSquilla' },
    { v: 'custom', label: '自定义…' },
  ];
  var NET_OPTS = [
    { v: 'direct', label: '直连' },
    { v: 'proxy', label: '走代理（VPN）' },
  ];
  var MY_ROW_ID = 'zro-row';
  var state = { routes: [], host: null };

  // ------------------------------------------------------------- config I/O
  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers, { 'x-zro-token': TOKEN });
    return fetch(API + path, opts).then(function (r) {
      if (!r.ok) throw new Error('config server ' + r.status);
      return r.json();
    });
  }
  function loadRoutes() {
    return api('/api/config').then(function (cfg) {
      state.routes = (cfg && cfg.routes) || [];
    }).catch(function () { state.routes = []; });
  }
  function saveRoutes(route, remove) {
    // Upsert: the server merges against ITS OWN disk state, so a stale UI
    // state can never wipe other providers' routes (vanishing-routes bug).
    return api('/api/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'upsert', route: route, remove: !!remove }),
    }).then(function (r) {
      // refresh local mirror from server truth
      return loadRoutes().then(function () { return r; });
    });
  }

  // ------------------------------------------------------------- helpers
  function hostOf(url) {
    try { return new URL(url).hostname; } catch (e) { return null; }
  }
  function findRoute(host) {
    for (var i = 0; i < state.routes.length; i++) {
      if (state.routes[i].match === host) return state.routes[i];
    }
    return null;
  }
  function isCustom(route) {
    return route && route.preset === 'custom';
  }

  // ------------------------------------------------------------- DOM
  // The provider EDIT panel is the one that also contains an API-key input
  // (type=password or placeholder mentioning key). The left provider LIST has
  // no such input, which is how we tell them apart. Scoping to the edit panel
  // is what keeps this per-provider instead of "first URL input on page".
  function findEditPanel() {
    // Primary: the API-key password input, then walk up until the panel also
    // contains a URL-ish (Base URL) input.
    var pw = document.querySelector('input[type="password"]');
    if (pw) {
      var el = pw.parentElement;
      for (var up = 0; up < 10 && el && el !== document.body; up++) {
        var inputs = el.querySelectorAll('input:not([type="password"])');
        for (var i = 0; i < inputs.length; i++) {
          var v = inputs[i].value || '';
          var ph = inputs[i].placeholder || '';
          if (/^https?:\/\//i.test(v) || /example\.com/i.test(ph)) return el;
        }
        el = el.parentElement;
      }
    }
    // Fallback: some providers render the API key as masked text (no password
    // input) — locate the panel by the "Base URL" label text instead.
    var labels = document.querySelectorAll('label, [class*="label"]');
    for (var l = 0; l < labels.length; l++) {
      if (!/base\s*url/i.test(labels[l].textContent || '')) continue;
      var host = labels[l].parentElement;
      for (var h = 0; h < 8 && host && host !== document.body; h++) {
        if (host.querySelectorAll('input').length >= 3) return host; // a form-ish panel
        host = host.parentElement;
      }
    }
    return null;
  }
  function findBaseUrlInput(panel) {
    if (!panel) return null;
    var inputs = panel.querySelectorAll('input:not([type="password"])');
    for (var i = 0; i < inputs.length; i++) {
      var v = inputs[i].value || '';
      var ph = inputs[i].placeholder || '';
      if (/^https?:\/\//i.test(v) || /example\.com/i.test(ph)) return inputs[i];
    }
    return null;
  }
  function findFieldHost(panel) { // labeled field block wrapping the Base URL input
    var inp = findBaseUrlInput(panel);
    if (!inp) return null;
    var el = inp.parentElement;
    for (var up = 0; up < 4 && el; up++) {
      var labels = el.querySelectorAll('label, [class*="label"]');
      for (var i = 0; i < labels.length; i++) {
        if (/base\s*url/i.test(labels[i].textContent || '')) return el;
      }
      el = el.parentElement;
    }
    return inp.parentElement;
  }

  function makeSelect(id, options, value, onChange) {
    var sel = document.createElement('select');
    sel.id = id;
    sel.style.cssText = 'width:100%;height:32px;padding:0 8px;font-size:13px;color:inherit;'
      + 'background:var(--background,#1b1d1f);border:1px solid var(--border,rgba(255,255,255,.12));'
      + 'border-radius:6px;outline:none;cursor:pointer;';
    options.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o.v; op.textContent = o.label;
      sel.appendChild(op);
    });
    sel.value = value;
    sel.addEventListener('change', function () { onChange(sel.value); });
    return sel;
  }
  function makeLabel(text) {
    var lb = document.createElement('label');
    lb.textContent = text;
    lb.style.cssText = 'display:block;margin-bottom:4px;font-size:13px;'
      + 'color:var(--foreground-subtle,#9a9ea3);';
    return lb;
  }
  function makeTextarea(text, onChange) {
    var ta = document.createElement('textarea');
    ta.rows = 3;
    ta.placeholder = 'Header-Name: Value  （每行一条，-Header-Name 表示删除）';
    ta.value = text;
    ta.style.cssText = 'width:100%;margin-top:6px;padding:6px 8px;font-size:12px;'
      + 'font-family:Consolas,monospace;color:inherit;'
      + 'background:var(--background,#1b1d1f);border:1px solid var(--border,rgba(255,255,255,.12));'
      + 'border-radius:6px;outline:none;resize:vertical;';
    var t;
    ta.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { onChange(ta.value); }, 600);
    });
    return ta;
  }
  function makeProxyInput(value, onChange) {
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.value = value;
    inp.placeholder = 'http://127.0.0.1:12334';
    inp.style.cssText = 'width:100%;margin-top:6px;padding:6px 8px;font-size:12px;'
      + 'font-family:Consolas,monospace;color:inherit;'
      + 'background:var(--background,#1b1d1f);border:1px solid var(--border,rgba(255,255,255,.12));'
      + 'border-radius:6px;outline:none;';
    var t;
    inp.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { onChange(inp.value.trim()); }, 600);
    });
    return inp;
  }
  function badge(text, ok) {
    var b = document.createElement('span');
    b.textContent = text;
    b.style.cssText = 'margin-left:8px;font-size:11px;color:' +
      (ok ? '#6ee7b7' : '#f87171') + ';';
    return b;
  }

  function applyPreset(route, preset) { // preset select changed
    if (preset === 'custom') {
      route.preset = 'custom';
      route.customHeaders = route.customHeaders || {};
    } else {
      route.preset = preset;
      delete route.customHeaders;
    }
  }

  function ensureRoute(host) {
    var r = findRoute(host);
    if (!r) {
      r = { match: host, preset: 'none', proxy: null };
      state.routes.push(r);
    }
    return r;
  }
  function dropRoute(host) {
    state.routes = state.routes.filter(function (r) { return r.match !== host; });
  }

  function buildRow(host) {
    var route = findRoute(host);
    var presetV = route ? (isCustom(route) ? 'custom' : (route.preset || 'none')) : 'none';
    var netV = (route && route.proxy) ? 'proxy' : 'direct';
    var saveTimer = null;

    var row = document.createElement('div');
    row.id = MY_ROW_ID;
    row.style.cssText = 'display:flex;gap:12px;margin-top:10px;flex-wrap:wrap;';

    var colA = document.createElement('div');
    colA.style.cssText = 'flex:1 1 220px;min-width:200px;';
    var colB = document.createElement('div');
    colB.style.cssText = 'flex:1 1 220px;min-width:200px;';

    var statusA = badge('', true);

    colA.appendChild(makeLabel('请求头'));
    colA.appendChild(makeSelect('zro-preset', PRESETS, presetV, function (v) {
      var r = ensureRoute(host);
      applyPreset(r, v);
      if (r.preset === 'none' && !r.proxy) dropRoute(host); // fully default -> remove route
      scheduleSave();
      rerender();
    }));

    var colBWrap = colB;
    colB.appendChild(makeLabel('网络'));
    colB.appendChild(makeSelect('zro-net', NET_OPTS, netV, function (v) {
      var r = ensureRoute(host);
      r.proxy = (v === 'proxy') ? (r.proxy || PROXY_DEFAULT) : null;
      if (r.preset === 'none' && !r.proxy) dropRoute(host);
      scheduleSave();
      rerender();
    }));

    // custom headers textarea + proxy url input live in an extra full-width row
    var extra = document.createElement('div');
    extra.style.cssText = 'width:100%;';

    function rerender() {
      var cur = findRoute(host);
      var showCustom = cur && isCustom(cur);
      var showProxy = cur && cur.proxy;
      extra.textContent = '';
      if (showCustom) {
        var lines = [];
        var ch = (cur && cur.customHeaders) || {};
        Object.keys(ch).forEach(function (k) { lines.push(k + ': ' + ch[k]); });
        (cur.removeHeaders || []).forEach(function (k) { lines.push('-' + k); });
        extra.appendChild(makeTextarea(lines.join('\n'), function (text) {
          var r = ensureRoute(host);
          var headers = {}, removes = [];
          text.split('\n').forEach(function (line) {
            line = line.trim();
            if (!line) return;
            if (line[0] === '-') { removes.push(line.slice(1).trim()); return; }
            var ix = line.indexOf(':');
            if (ix > 0) headers[line.slice(0, ix).trim()] = line.slice(ix + 1).trim();
          });
          r.customHeaders = headers;
          r.removeHeaders = removes;
          scheduleSave();
        }));
      }
      if (showProxy) {
        extra.appendChild(makeProxyInput(cur.proxy, function (val) {
          var r = ensureRoute(host);
          r.proxy = val || PROXY_DEFAULT;
          scheduleSave();
        }));
      }
    }

    function scheduleSave() {
      statusA.textContent = '保存中…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        // upsert THIS provider's route only; server merges against disk truth
        var r = findRoute(host);
        saveRoutes(r, !r).then(function () {
          statusA.textContent = '✓ 已生效';
          setTimeout(function () { statusA.textContent = ''; }, 1600);
        }).catch(function () {
          statusA.textContent = '✗ 保存失败';
        });
      }, 400);
    }

    rerender();
    row.appendChild(colA);
    row.appendChild(colB);
    row.appendChild(statusA);
    var holder = document.createElement('div');
    holder.style.cssText = 'width:100%;';
    holder.appendChild(row);
    holder.appendChild(extra);
    return holder;
  }

  // Resolves the provider currently shown in the EDIT panel, fresh every call.
  // Returns null when no provider panel is open (e.g. list-only view).
  function currentPanelHost() {
    var panel = findEditPanel();
    if (!panel) return null;
    var inp = findBaseUrlInput(panel);
    if (!inp) return null;
    return hostOf(inp.value || '');
  }

  function unmount() {
    var existing = document.getElementById(MY_ROW_ID);
    if (existing) {
      var holder = existing.closest('[data-zro-holder]') || existing;
      if (holder.parentElement) holder.parentElement.removeChild(holder);
    }
  }

  function mount() {
    var host = currentPanelHost();
    if (!host) { unmount(); currentHost = null; return; }

    var existing = document.getElementById(MY_ROW_ID);
    if (existing && currentHost === host &&
        existing.closest('[data-zro-holder]') &&
        document.contains(existing)) return; // correct provider, still alive

    // provider switched (or first mount): rebuild from scratch so the row,
    // textarea and proxy input all reflect THIS provider's route only
    unmount();
    currentHost = host;

    var panel = findEditPanel();
    var hostEl = findFieldHost(panel);
    if (!hostEl) return;

    var ui = buildRow(host);
    ui.setAttribute('data-zro-holder', '1');
    ui.dataset.zroHost = host;
    hostEl.parentElement.insertBefore(ui, hostEl.nextSibling);
  }
  var currentHost = null;

  // Immediate refresh on provider switch. MutationObserver fires only when the
  // DOM actually changes (React rebuilds the provider panel on switch), so it
  // costs nothing while idle — unlike the old 1.5s poll. Our own injected row
  // (and its holder) is filtered out so the observer never loops on itself;
  // mount() is already idempotent as a second guard.
  var moTimer = null;
  function scheduleMountSoon() {
    if (moTimer) return;
    moTimer = setTimeout(function () {
      moTimer = null;
      try { mount(); } catch (e) { /* never break the host page */ }
    }, 50);
  }
  function isOurNode(node) {
    if (!node || node.nodeType !== 1) return false; // element nodes only
    if (node.id === MY_ROW_ID) return true;
    if (node.hasAttribute && node.hasAttribute('data-zro-holder')) return true;
    return !!(node.closest && node.closest('#' + MY_ROW_ID + ', [data-zro-holder]'));
  }
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      var onlyOurs = true;
      for (var j = 0; j < m.addedNodes.length; j++) {
        if (!isOurNode(m.addedNodes[j])) { onlyOurs = false; break; }
      }
      if (onlyOurs) {
        for (var k = 0; k < m.removedNodes.length; k++) {
          if (!isOurNode(m.removedNodes[k])) { onlyOurs = false; break; }
        }
      }
      if (!onlyOurs) { scheduleMountSoon(); return; }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // Fallback poll (reduced): re-assert the row if React reconciliation removes
  // it without a provider switch (rare). Not the primary refresh path anymore.
  setInterval(function () {
    try { mount(); } catch (e) { /* never break the host page */ }
  }, 3000);
  loadRoutes().then(function () { try { mount(); } catch (e) {} });
})();
