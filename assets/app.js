/* SEAT Altea 2011 parts viewer — application logic */
(function () {
  "use strict";

  var M = typeof window.PARTS_MANIFEST !== "undefined" ? window.PARTS_MANIFEST : null;
  var G = window.GLOSSARY || { full: {}, words: {} };

  var els = {
    search: document.getElementById("search"),
    yearFilter: document.getElementById("year-filter"),
    brandYears: document.getElementById("brand-years"),
    sidebar: document.getElementById("sidebar"),
    sidebarResizer: document.getElementById("sidebar-resizer"),
    partsPanel: document.getElementById("parts-panel"),
    partsResizer: document.getElementById("parts-resizer"),
    sidebarList: document.getElementById("sidebar-list"),
    stats: document.getElementById("stats"),
    title: document.getElementById("diagram-title"),
    meta: document.getElementById("diagram-meta"),
    viewport: document.getElementById("viewport"),
    stage: document.getElementById("stage"),
    noImage: document.getElementById("no-image"),
    partsBody: document.getElementById("parts-body"),
    partsCount: document.getElementById("parts-count"),
    tooltip: document.getElementById("tooltip"),
    copyToast: document.getElementById("copy-toast"),
    empty: document.getElementById("empty"),
    zoomIn: document.getElementById("zoom-in"),
    zoomOut: document.getElementById("zoom-out"),
    zoomFit: document.getElementById("zoom-fit"),
    zoom100: document.getElementById("zoom-100")
  };

  var current = null;   // active diagram object
  var currentIndex = 0;
  var visible = [];     // indices of diagrams matching the search filter
  var hitsByIndex = {};
  var scale = 1, tx = 0, ty = 0;
  var selectedPos = null;
  var activeQuery = [];

  /* ---------- translation ---------- */

  function norm(s) {
    return String(s || "").replace(/\s+/g, " ").trim().replace(/\.$/, "").toLowerCase();
  }

  function queryTokens(q) {
    var n = norm(q);
    return n ? n.split(/\s+/).filter(Boolean) : [];
  }

  function textHasTokens(hay, tokens) {
    for (var i = 0; i < tokens.length; i++) {
      if (hay.indexOf(tokens[i]) === -1) return false;
    }
    return true;
  }

  function partHaystack(p) {
    return [
      p.part, p.name, p.note, p.model,
      translate(p.part), translate(p.name), translate(p.note), translate(p.model)
    ].join(" ").toLowerCase();
  }

  function partMatchesTokens(p, tokens) {
    return textHasTokens(partHaystack(p), tokens);
  }

  var WORD_FIXES = {
    "л": "l", "лв": "left", "п": "", "ти": "pin", "эл": "electrical",
    "черн": "black", "пров": "wire", "теклоподъемник": "window regulator",
    "тарт": "start", "топ": "stop", "поз": "pos", "зак": "lock", "код": "code",
    "иллюстр": "illustration", "оединение": "connection", "с": "with"
  };

  function mapToken(token) {
    var m = token.match(/^(.*?)([,;:]*)$/);
    var key = m[1].toLowerCase();
    if (WORD_FIXES.hasOwnProperty(key)) return WORD_FIXES[key] + m[2];
    if (G.words[key]) return G.words[key] + m[2];
    if (/[\u0400-\u04FF]/.test(key)) return "";
    return token;
  }

  function translate(ru) {
    if (!ru) return "";
    var key = norm(ru);
    if (G.full[key]) return G.full[key];
    var hasCyrl = /[\u0400-\u04FF]/.test(key);
    if (!hasCyrl) return ru;
    var out = key.split(/(\s+)/).map(function (t) {
      return /^\s+$/.test(t) ? t : mapToken(t);
    }).join("");
    return out.replace(/[\u0400-\u04FF][\u0400-\u04FF-]*/g, "")
      .replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
  }

  function capFirst(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  /* ---------- helpers ---------- */

  function byId(id) {
    for (var i = 0; i < M.diagrams.length; i++) {
      if (M.diagrams[i].id === id) return i;
    }
    return -1;
  }

  function partsAt(pos) {
    return current ? current.parts.filter(function (p) { return p.pos === pos; }) : [];
  }

  /* ---------- sidebar ---------- */

  function matches(diagram, q) {
    var tokens = queryTokens(q);
    if (!tokens.length) return { ok: true, hits: 0 };
    var diagramHay = [diagram.bildtafel, diagram.title, translate(diagram.title)]
      .join(" ").toLowerCase();
    var hits = 0;
    for (var i = 0; i < diagram.parts.length; i++) {
      if (partMatchesTokens(diagram.parts[i], tokens)) hits++;
    }
    return { ok: hits > 0 || textHasTokens(diagramHay, tokens), hits: hits };
  }

  function diagramYears() {
    var years = [];
    M.diagrams.forEach(function (d) {
      var y = d.year || "n/a";
      if (years.indexOf(y) === -1) years.push(y);
    });
    return years.sort();
  }

  function buildItem(d, i, res, q) {
    var item = document.createElement("div");
    item.className = "diagram-item" + (i === currentIndex ? " active" : "");
    item.dataset.index = i;

    var num = document.createElement("div");
    num.className = "num";
    num.textContent = d.bildtafel;

    var txt = document.createElement("div");
    txt.className = "txt";
    var en = document.createElement("div");
    en.className = "en";
    en.textContent = capFirst(translate(d.title));
    txt.appendChild(en);

    item.appendChild(num);
    item.appendChild(txt);

    if (!d.image) {
      var tag = document.createElement("div");
      tag.className = "noimg";
      tag.textContent = "list";
      tag.title = "Catalog list page (no illustration)";
      item.appendChild(tag);
    }
    if (q && res.hits) {
      var badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = res.hits;
      badge.title = res.hits + " matching parts";
      item.appendChild(badge);
    }

    item.addEventListener("click", function () { select(i); });
    return item;
  }

  function rebuildSidebar() {
    var q = els.search.value.trim().toLowerCase();
    var yf = els.yearFilter.value;
    visible = [];
    hitsByIndex = {};
    activeQuery = queryTokens(q);
    els.sidebarList.innerHTML = "";
    var matchedParts = 0;

    diagramYears().forEach(function (year) {
      if (yf && year !== yf) return;
      var idxs = [];
      M.diagrams.forEach(function (d, i) {
        if ((d.year || "n/a") !== year) return;
        var res = matches(d, q);
        if (res.ok) idxs.push([d, i, res]);
      });
      if (!idxs.length) return;

      var head = document.createElement("div");
      head.className = "year-header";
      head.textContent = year === "n/a" ? "Catalog" : year;
      els.sidebarList.appendChild(head);

      idxs.forEach(function (t) {
        visible.push(t[1]);
        hitsByIndex[t[1]] = t[2].hits;
        matchedParts += t[2].hits;
        els.sidebarList.appendChild(buildItem(t[0], t[1], t[2], q));
      });
    });

    if (q) {
      var summary = document.createElement("div");
      summary.className = "search-summary";
      summary.textContent = visible.length + (visible.length === 1 ? " diagram" : " diagrams") +
        " · " + matchedParts + (matchedParts === 1 ? " matching part" : " matching parts");
      if (!visible.length) summary.textContent = "No matches for “" + q + "”";
      els.sidebarList.insertBefore(summary, els.sidebarList.firstChild);
    }

    var totalParts = 0;
    M.diagrams.forEach(function (d) { totalParts += d.parts.length; });
    var years = diagramYears();
    var yearLabel = years.length > 1
      ? years[0] + "–" + years[years.length - 1]
      : (years[0] || "");
    els.stats.textContent =
      M.diagrams.length + " diagrams · " + totalParts + " parts · " +
      M.vehicle.brand + " " + M.vehicle.model + " " + yearLabel;
  }

  /* ---------- selection ---------- */

  function select(i) {
    currentIndex = i;
    current = M.diagrams[i];
    selectedPos = null;

    els.title.innerHTML = "";
    var numSpan = document.createElement("span");
    numSpan.className = "num";
    numSpan.textContent = (current.year ? current.year + " · " : "") + current.bildtafel + " — ";
    els.title.appendChild(numSpan);
    els.title.appendChild(document.createTextNode(capFirst(translate(current.title))));

    var metaBits = [];
    if (current.note) metaBits.push(translate(current.note));
    if (current.model) metaBits.push(translate(current.model));
    metaBits.push(current.parts.length + " entries");
    if (current.hotspots.length) metaBits.push(current.hotspots.length + " hotspots");
    els.meta.textContent = metaBits.join(" · ");

    renderStage();
    renderTable();
    applyTransform();

    document.querySelectorAll(".diagram-item").forEach(function (el) {
      el.classList.toggle("active", Number(el.dataset.index) === i);
    });

    if (current.image) requestAnimationFrame(fit);
    if (history.replaceState) history.replaceState(null, "", "#" + current.id);
  }

  /* ---------- diagram stage ---------- */

  function renderStage() {
    els.stage.innerHTML = "";
    els.noImage.hidden = !!current.image;

    if (!current.image) {
      els.stage.style.width = "0";
      els.stage.style.height = "0";
      return;
    }

    els.stage.style.width = current.width + "px";
    els.stage.style.height = current.height + "px";

    var img = document.createElement("img");
    img.src = "data/" + current.image;
    img.alt = current.title;
    img.draggable = false;
    els.stage.appendChild(img);

    current.hotspots.forEach(function (h) {
      var el = document.createElement("div");
      el.className = "hotspot";
      el.dataset.pos = h.num;
      el.style.left = h.x + "px";
      el.style.top = h.y + "px";
      el.style.width = h.w + "px";
      el.style.height = h.h + "px";
      var label = document.createElement("span");
      label.textContent = h.num;
      el.appendChild(label);

      el.addEventListener("click", function (e) {
        e.stopPropagation();
        selectHotspot(h.num);
      });
      el.addEventListener("mouseenter", function () { showTooltip(h.num); });
      el.addEventListener("mousemove", positionTooltip);
      el.addEventListener("mouseleave", hideTooltip);

      els.stage.appendChild(el);
    });
  }

  function applyTransform() {
    els.stage.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
    els.stage.style.setProperty("--is", String(1 / scale));
  }

  function fit() {
    if (!current || !current.image) return;
    var r = els.viewport.getBoundingClientRect();
    if (!current.width || !current.height) return;
    scale = Math.min(r.width / current.width, r.height / current.height) * 0.96;
    scale = Math.max(scale, 0.01);
    tx = (r.width - current.width * scale) / 2;
    ty = (r.height - current.height * scale) / 2;
    applyTransform();
  }

  function zoomAt(clientX, clientY, factor) {
    var r = els.viewport.getBoundingClientRect();
    var x = clientX - r.left;
    var y = clientY - r.top;
    var ns = Math.min(10, Math.max(0.03, scale * factor));
    var k = ns / scale;
    tx = x - (x - tx) * k;
    ty = y - (y - ty) * k;
    scale = ns;
    applyTransform();
  }

  function centerOn(hotspot) {
    var r = els.viewport.getBoundingClientRect();
    var cx = hotspot.x + hotspot.w / 2;
    var cy = hotspot.y + hotspot.h / 2;
    tx = r.width / 2 - cx * scale;
    ty = r.height / 2 - cy * scale;
    applyTransform();
  }

  /* ---------- parts table ---------- */

  function renderTable() {
    els.partsBody.innerHTML = "";
    var lastSection = null;

    current.parts.forEach(function (p) {
      if (p.section !== null && p.section !== undefined && p.section !== lastSection) {
        lastSection = p.section;
        var sec = current.sections[p.section] || {};
        var tr = document.createElement("tr");
        tr.className = "section";
        var td = document.createElement("td");
        td.colSpan = 6;
        td.textContent = capFirst(translate(sec.title || "")) +
          (sec.note ? "  ·  " + translate(sec.note) : "");
        tr.appendChild(td);
        els.partsBody.appendChild(tr);
      }

      var tr = document.createElement("tr");
      tr.className = "part-row";
      tr.dataset.pos = p.pos;
      if (activeQuery.length && partMatchesTokens(p, activeQuery)) tr.classList.add("search-hit");

      var tdPos = document.createElement("td");
      tdPos.className = "pos";
      tdPos.textContent = p.label || p.pos;

      var tdPart = document.createElement("td");
      var isPartNumber = !/[\u0400-\u04FF]/.test(p.part || "");
      var partEl = document.createElement("span");
      partEl.className = "part-no";
      partEl.textContent = isPartNumber ? p.part : capFirst(translate(p.part));
      tdPart.className = "part-cell";
      if (isPartNumber) {
        partEl.title = "Click to copy";
        tdPart.title = "Click to copy";
        tdPart.appendChild(partEl);
        tdPart.addEventListener("click", function (e) {
          e.stopPropagation();
          copyText(p.part, partEl);
        });
      } else {
        tdPart.classList.add("part-cell-link");
        tdPart.appendChild(partEl);
        tdPart.addEventListener("click", function () { selectPos(p.pos, false); });
      }

      var tdName = document.createElement("td");
      tdName.textContent = capFirst(translate(p.name));

      var tdNote = document.createElement("td");
      tdNote.textContent = translate(p.note);

      var tdQty = document.createElement("td");
      tdQty.className = "qty";
      tdQty.textContent = p.qty;

      var tdModel = document.createElement("td");
      tdModel.textContent = capFirst(translate(p.model));

      tr.appendChild(tdPos);
      tr.appendChild(tdPart);
      tr.appendChild(tdName);
      tr.appendChild(tdNote);
      tr.appendChild(tdQty);
      tr.appendChild(tdModel);

      tr.addEventListener("click", function () { selectPos(p.pos, false); });
      els.partsBody.appendChild(tr);
    });

    els.partsCount.textContent = "(" + current.parts.length + ")";
  }

  function selectHotspot(pos) {
    selectedPos = pos;
    hideTooltip();

    document.querySelectorAll(".hotspot").forEach(function (el) {
      el.classList.toggle("selected", el.dataset.pos === pos);
    });
    document.querySelectorAll(".part-row").forEach(function (el) {
      el.classList.remove("row-sel");
    });
  }

  function selectPos(pos, fromHotspot) {
    selectedPos = pos;
    hideTooltip();

    document.querySelectorAll(".hotspot").forEach(function (el) {
      el.classList.toggle("selected", el.dataset.pos === pos);
    });
    document.querySelectorAll(".part-row").forEach(function (el) {
      el.classList.toggle("row-sel", el.dataset.pos === pos);
    });

    var row = els.partsBody.querySelector('.part-row[data-pos="' + cssEscape(pos) + '"]');
    if (row && !fromHotspot) row.scrollIntoView({ block: "nearest", behavior: "smooth" });

    if (!fromHotspot && current) {
      var hs = current.hotspots.filter(function (h) { return h.num === pos; })[0];
      if (hs) {
        if (scale < 0.5) {
          var r = els.viewport.getBoundingClientRect();
          var cx = hs.x + hs.w / 2, cy = hs.y + hs.h / 2;
          scale = 0.8;
          tx = r.width / 2 - cx * scale;
          ty = r.height / 2 - cy * scale;
          applyTransform();
        } else {
          centerOn(hs);
        }
      }
    }
  }

  /* ---------- tooltip ---------- */

  function showTooltip(pos) {
    var parts = partsAt(pos);
    if (!parts.length) return;
    var html = parts.slice(0, 8).map(function (p) {
      var bits = ["<b class='t-part'>" +
        (/[\u0400-\u04FF]/.test(p.part || "") ? capFirst(translate(p.part)) : p.part) +
        "</b>"];
      var name = capFirst(translate(p.name));
      if (name) bits.push(name);
      if (p.note) bits.push(translate(p.note));
      if (p.qty) bits.push("×" + p.qty);
      if (p.model) bits.push("<span class='muted'>[" + translate(p.model) + "]</span>");
      return "<div class='t-line'>" + bits.join(" — ") + "</div>";
    }).join("");
    if (parts.length > 8) html += "<div class='t-more'>+" + (parts.length - 8) + " more</div>";
    els.tooltip.innerHTML = html;
    els.tooltip.hidden = false;
  }

  function positionTooltip(e) {
    var pad = 14;
    var w = els.tooltip.offsetWidth;
    var h = els.tooltip.offsetHeight;
    var x = e.clientX + pad;
    var y = e.clientY + pad;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - pad;
    els.tooltip.style.left = x + "px";
    els.tooltip.style.top = y + "px";
  }

  function hideTooltip() { els.tooltip.hidden = true; }

  /* ---------- misc ---------- */

  var toastTimer = null;
  var toastHideTimer = null;

  function showCopyToast(text, el, ok) {
    var t = els.copyToast;
    if (!t) return;
    t.textContent = ok === false ? "Copy failed" : "Copied " + text;
    t.classList.toggle("failed", ok === false);
    t.hidden = false;
    t.classList.remove("show");
    var r = el.getBoundingClientRect();
    var tw = t.offsetWidth;
    var th = t.offsetHeight;
    var x = clamp(r.left + r.width / 2 - tw / 2, 8, window.innerWidth - tw - 8);
    var y = r.bottom + 8;
    if (y + th > window.innerHeight - 8) y = r.top - th - 8;
    t.style.left = x + "px";
    t.style.top = Math.max(8, y) + "px";
    requestAnimationFrame(function () { t.classList.add("show"); });
    clearTimeout(toastTimer);
    clearTimeout(toastHideTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove("show");
      toastHideTimer = setTimeout(function () { t.hidden = true; }, 180);
    }, 1500);
  }

  function copyText(text, el) {
    var timer = null;
    function flash(ok) {
      el.classList.add("copied");
      el.title = ok === false ? "Copy failed" : "Copied!";
      showCopyToast(text, el, ok);
      clearTimeout(timer);
      timer = setTimeout(function () {
        el.classList.remove("copied");
        el.title = "Click to copy";
      }, 900);
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
      document.body.removeChild(ta);
      flash(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flash(true); }, fallback);
    } else {
      fallback();
    }
  }

  function cssEscape(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  /* ---------- resizable panels ---------- */

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function saveWidth(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (err) { /* ignore */ }
  }

  function restoreWidths() {
    if (window.innerWidth <= 1000) return;
    try {
      var sw = Number(localStorage.getItem("sidebar-width"));
      var pw = Number(localStorage.getItem("parts-width"));
      if (sw) els.sidebar.style.width = clamp(sw, 180, window.innerWidth * 0.45) + "px";
      if (pw) els.partsPanel.style.width = clamp(pw, 280, window.innerWidth * 0.7) + "px";
    } catch (err) { /* ignore */ }
  }

  function bindResizer(handle, target, storageKey, minWidth, maxWidth, fromLeft) {
    var dragging = false;
    var startX = 0;
    var startWidth = 0;

    handle.addEventListener("pointerdown", function (e) {
      dragging = true;
      startX = e.clientX;
      startWidth = target.getBoundingClientRect().width;
      handle.classList.add("dragging");
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    handle.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var delta = fromLeft ? e.clientX - startX : startX - e.clientX;
      var width = clamp(startWidth + delta, minWidth, Math.min(maxWidth, window.innerWidth * 0.75));
      target.style.width = width + "px";
      applyTransform();
    });

    function stop(e) {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove("dragging");
      if (e && e.pointerId !== undefined && handle.hasPointerCapture(e.pointerId)) {
        handle.releasePointerCapture(e.pointerId);
      }
      saveWidth(storageKey, Math.round(target.getBoundingClientRect().width));
      if (current && current.image) fit();
    }

    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  /* ---------- events ---------- */

  function bindEvents() {
    // zoom
    els.viewport.addEventListener("wheel", function (e) {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });

    els.zoomIn.addEventListener("click", function () {
      var r = els.viewport.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.3);
    });
    els.zoomOut.addEventListener("click", function () {
      var r = els.viewport.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.3);
    });
    els.zoomFit.addEventListener("click", fit);
    els.zoom100.addEventListener("click", function () {
      var r = els.viewport.getBoundingClientRect();
      scale = 1;
      tx = (r.width - (current ? current.width : 0)) / 2;
      ty = 40;
      applyTransform();
    });

    // pan
    var panning = false, px = 0, py = 0;
    els.viewport.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".hotspot") || e.target.closest("button")) return;
      panning = true;
      px = e.clientX; py = e.clientY;
      els.viewport.classList.add("panning");
      els.viewport.setPointerCapture(e.pointerId);
    });
    els.viewport.addEventListener("pointermove", function (e) {
      if (!panning) return;
      tx += e.clientX - px;
      ty += e.clientY - py;
      px = e.clientX; py = e.clientY;
      applyTransform();
    });
    function endPan() { panning = false; els.viewport.classList.remove("panning"); }
    els.viewport.addEventListener("pointerup", endPan);
    els.viewport.addEventListener("pointercancel", endPan);

    // search
    var debounce = null;
    els.search.addEventListener("input", function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        rebuildSidebar();
        var q = els.search.value.trim();
        if (q && visible.length) {
          var needsPartHit = visible.indexOf(currentIndex) === -1 || !hitsByIndex[currentIndex];
          if (needsPartHit) {
            var target = visible[0];
            for (var i = 0; i < visible.length; i++) {
              if (hitsByIndex[visible[i]] > 0) { target = visible[i]; break; }
            }
            if (target !== currentIndex) {
              select(target);
              return;
            }
          }
        }
        if (current) {
          renderTable();
          if (selectedPos) selectPos(selectedPos, true);
        }
      }, 120);
    });

    // year filter
    els.yearFilter.addEventListener("change", function () {
      rebuildSidebar();
      if (visible.indexOf(currentIndex) === -1 && visible.length) select(visible[0]);
    });

    // keyboard navigation
    document.addEventListener("keydown", function (e) {
      if (e.target === els.search || e.target.tagName === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        var posInVisible = visible.indexOf(currentIndex);
        if (posInVisible === -1) posInVisible = 0;
        var next = e.key === "ArrowRight" ? posInVisible + 1 : posInVisible - 1;
        next = (next + visible.length) % visible.length;
        select(visible[next]);
        var active = els.sidebarList.querySelector(".diagram-item.active");
        if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
      }
      if (e.key === "+" || e.key === "=") els.zoomIn.click();
      if (e.key === "-") els.zoomOut.click();
      if (e.key === "0") fit();
      if (e.key === "Escape") hideTooltip();
    });

    // resize
    bindResizer(els.sidebarResizer, els.sidebar, "sidebar-width", 180, 600, true);
    bindResizer(els.partsResizer, els.partsPanel, "parts-width", 280, 900, false);

    window.addEventListener("resize", function () {
      if (current && current.image && scale < 0.3) fit();
    });
  }

  /* ---------- init ---------- */

  function init() {
    if (!M || !M.diagrams || !M.diagrams.length) {
      els.empty.hidden = false;
      return;
    }
    bindEvents();
    restoreWidths();

    var years = diagramYears();
    var allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "All years";
    els.yearFilter.appendChild(allOption);
    years.forEach(function (y) {
      var o = document.createElement("option");
      o.value = y;
      o.textContent = y === "n/a" ? "Catalog" : y;
      els.yearFilter.appendChild(o);
    });
    if (M.vehicle && M.vehicle.year) els.brandYears.textContent = M.vehicle.year;

    rebuildSidebar();

    var start = 0;
    if (location.hash) {
      var idx = byId(decodeURIComponent(location.hash.slice(1)));
      if (idx !== -1) start = idx;
    }
    select(start);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
