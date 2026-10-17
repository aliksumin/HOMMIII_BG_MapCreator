// Tutorial overlay, injected into the app page by capture.mjs (addInitScript).
// Draws on top of the real UI: a numbered step caption, a lower-third
// description, highlight boxes with a callout and an arrow, a visible mouse
// cursor, and full-screen title / closing cards. It never takes pointer
// events, so the script clicks through it.

(() => {
  if (window.__tut) return;

  const CSS = `
  #tut-root { position: fixed; inset: 0; z-index: 2147483646; pointer-events: none;
    font-family: "Segoe UI", system-ui, sans-serif; }
  #tut-root * { box-sizing: border-box; }
  .tut-chip { position: absolute; top: 8px; left: 10px; min-width: 268px; display: flex; align-items: center; gap: 12px;
    padding: 5px 18px 5px 5px; border-radius: 999px; background: #140c06;
    border: 2px solid #d9a441; box-shadow: 0 6px 22px rgba(0,0,0,.5); color: #f4e6c4;
    transition: opacity .35s, transform .35s; }
  .tut-chip.hidden { opacity: 0; transform: translateY(-12px); }
  .tut-chip.dim { opacity: .12; }
  .tut-chip .n { min-width: 40px; height: 40px; padding: 0 8px; border-radius: 20px; display: grid; place-items: center;
    background: radial-gradient(circle at 35% 30%, #ffe9a8, #d9a441 55%, #8a5a12); color: #2a1606;
    font-weight: 800; font-size: 18px; }
  .tut-chip .t { display: flex; flex-direction: column; line-height: 1.15; }
  .tut-chip .t b { font-size: 17px; letter-spacing: .02em; color: #ffd77a; }
  .tut-chip .t span { font-size: 13px; opacity: .88; }

  .tut-lower { position: absolute; left: 50%; bottom: 20px; width: min(1040px, 86vw);
    transform: translateX(-50%); padding: 13px 22px 15px; border-radius: 12px;
    background: linear-gradient(180deg, rgba(28, 16, 8, .96), rgba(14, 8, 4, .96));
    border: 2px solid #d9a441; box-shadow: 0 10px 34px rgba(0,0,0,.6); color: #f7ecd2;
    transition: opacity .35s, transform .35s; }
  .tut-lower.top { bottom: auto; top: 62px; }
  .tut-lower.hidden { opacity: 0; transform: translate(-50%, 16px); }
  .tut-lower h3 { margin: 0 0 4px; font-size: 20px; color: #ffd77a; letter-spacing: .01em; }
  .tut-lower p { margin: 0; font-size: 17px; line-height: 1.42; }
  .tut-lower code { background: rgba(255,255,255,.12); padding: 0 5px; border-radius: 4px;
    font-family: Consolas, monospace; font-size: 15px; color: #ffe3a0; }

  .tut-box { position: absolute; border: 3px solid #ffcc33; border-radius: 10px;
    box-shadow: 0 0 0 4000px rgba(0,0,0,.25), 0 0 18px 4px rgba(255, 204, 51, .75);
    animation: tut-pulse 1.4s ease-in-out infinite; }
  .tut-box.multi { box-shadow: 0 0 18px 4px rgba(255, 204, 51, .75); }
  @keyframes tut-pulse { 50% { border-color: #fff2b3; } }
  .tut-label { position: absolute; max-width: 330px; padding: 7px 12px; border-radius: 8px;
    background: #ffcc33; color: #2a1606; font-weight: 700; font-size: 15px; line-height: 1.25;
    box-shadow: 0 4px 14px rgba(0,0,0,.45); }
  .tut-arrow { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; }
  .tut-arrow line { stroke: #ffcc33; stroke-width: 4; stroke-linecap: round; }
  .tut-arrow path { fill: #ffcc33; }

  .tut-cursor { position: absolute; left: 0; top: 0; width: 28px; height: 28px; margin: -2px 0 0 -3px;
    transition: transform .55s cubic-bezier(.3,.7,.2,1); filter: drop-shadow(0 2px 3px rgba(0,0,0,.6)); }
  .tut-cursor.gone { opacity: 0; }
  .tut-ripple { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
    border: 3px solid #ffcc33; animation: tut-ripple .6s ease-out forwards; }
  @keyframes tut-ripple { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
  .tut-key { position: absolute; padding: 6px 14px; border-radius: 8px; background: rgba(20,12,6,.94);
    border: 2px solid #d9a441; color: #ffd77a; font: 700 20px Consolas, monospace; white-space: nowrap;
    transform: translate(-50%, -150%); animation: tut-fade 1.6s ease forwards; }
  @keyframes tut-fade { 0% { opacity: 0; } 12% { opacity: 1; } 78% { opacity: 1; } 100% { opacity: 0; } }

  .tut-card { position: absolute; inset: 0; display: grid; place-items: center;
    background: radial-gradient(ellipse at center, #3a2410 0%, #1a0e06 60%, #0c0603 100%);
    color: #f7ecd2; transition: opacity .6s; }
  .tut-card.hidden { opacity: 0; }
  .tut-card .inner { width: min(1180px, 90vw); text-align: center; }
  .tut-card .kicker { font-size: 17px; letter-spacing: .35em; text-transform: uppercase; color: #d9a441; }
  .tut-card h1 { margin: 10px 0 8px; font-size: 60px; color: #ffd77a; font-family: Georgia, serif;
    text-shadow: 0 3px 12px rgba(0,0,0,.8); }
  .tut-card h2 { margin: 6px 0 14px; font-size: 34px; color: #ffd77a; font-family: Georgia, serif; }
  .tut-card .sub { font-size: 21px; opacity: .9; }
  .tut-card .rule { width: 260px; height: 3px; margin: 22px auto; background: linear-gradient(90deg, transparent, #d9a441, transparent); }
  .tut-card ol { display: inline-grid; grid-template-columns: repeat(2, auto); gap: 4px 56px; text-align: left;
    margin: 0; padding: 0; list-style: none; font-size: 19px; counter-reset: s; }
  .tut-card ol li { counter-increment: s; }
  .tut-card ol li::before { content: counter(s, upper-roman) ". "; color: #d9a441; font-weight: 700; }
  .tut-card table { margin: 0 auto; border-collapse: collapse; font-size: 16px; text-align: left; }
  .tut-card th { padding: 4px 14px; color: #d9a441; font-weight: 600; border-bottom: 2px solid rgba(217,164,65,.5); }
  .tut-card td { padding: 5px 14px; border-bottom: 1px solid rgba(217,164,65,.22); }
  .tut-card td:first-child, .tut-card td.mono { font-family: Consolas, monospace; color: #ffe3a0; }
  .tut-card .note { margin-top: 20px; font-size: 16px; opacity: .78; }
  `;

  const CURSOR =
    '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M3 2 L3 19 L7.6 15 L10.6 22 L13.6 20.7 L10.7 14 L17 14 Z" ' +
    'fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  let root;
  const ensure = () => {
    if (root && document.body.contains(root)) return root;
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    root = document.createElement("div");
    root.id = "tut-root";
    root.innerHTML =
      '<div class="tut-layer-hl"></div>' +
      '<div class="tut-chip hidden"><span class="n"></span><span class="t"><b></b><span></span></span></div>' +
      '<div class="tut-lower hidden"><h3></h3><p></p></div>' +
      '<div class="tut-card hidden"></div>' +
      `<div class="tut-cursor" style="transform: translate(720px, 420px)">${CURSOR}</div>`;
    document.body.appendChild(root);
    return root;
  };
  const $ = (sel) => ensure().querySelector(sel);

  const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  let boxes = [];
  let lowerMode = "auto";

  /** Keeps the caption and the lower third off whatever is highlighted. */
  const layout = () => {
    const chip = $(".tut-chip");
    const lower = $(".tut-lower");
    chip.classList.toggle("dim", boxes.some((b) => intersects(b, chip.getBoundingClientRect())));
    lower.classList.remove("top");
    if (lowerMode === "top") return lower.classList.add("top");
    const bottom = lower.getBoundingClientRect();
    if (lowerMode === "auto" && boxes.some((b) => intersects(b, bottom))) lower.classList.add("top");
  };

  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  /** `code` spans in captions. */
  const rich = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

  const arrow = (layer, before, from, to) => {
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    if (len < 16) return;
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    const ex = to.x - Math.cos(ang) * 12;
    const ey = to.y - Math.sin(ang) * 12;
    const head = (a) => `${to.x - Math.cos(ang + a) * 18},${to.y - Math.sin(ang + a) * 18}`;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "tut-arrow");
    svg.innerHTML = `<line x1="${from.x}" y1="${from.y}" x2="${ex}" y2="${ey}"/><path d="M${to.x},${to.y} L${head(0.45)} L${head(-0.45)} Z"/>`;
    layer.insertBefore(svg, before);
  };

  window.__tut = {
    ensure,
    caption(num, title, sub) {
      const chip = $(".tut-chip");
      if (!title) return chip.classList.add("hidden");
      chip.querySelector(".n").textContent = num;
      chip.querySelector("b").textContent = title;
      chip.querySelector(".t span").textContent = sub || "";
      chip.classList.remove("hidden");
      layout();
    },
    lower(title, text) {
      const el = $(".tut-lower");
      if (!title && !text) return el.classList.add("hidden");
      el.querySelector("h3").innerHTML = rich(title || "");
      el.querySelector("p").innerHTML = rich(text || "");
      el.classList.remove("hidden");
      layout();
    },
    /** "auto" (bottom unless a highlight is there), "top" or "bottom". */
    lowerAt(mode) {
      lowerMode = mode;
      layout();
    },
    /** rects: [{x, y, width, height}] in CSS px; label: callout text, or "" for none. */
    highlight(rects, label) {
      const layer = $(".tut-layer-hl");
      layer.innerHTML = "";
      boxes = [];
      if (!rects || !rects.length) return layout();
      const pad = 6;
      for (const r of rects) {
        const box = document.createElement("div");
        box.className = `tut-box ${rects.length > 1 ? "multi" : ""}`;
        Object.assign(box.style, { left: `${r.x - pad}px`, top: `${r.y - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
        layer.appendChild(box);
        boxes.push({ left: r.x - pad, top: r.y - pad, right: r.x + r.width + pad, bottom: r.y + r.height + pad });
      }
      if (label) {
        const r = rects[0];
        const vw = innerWidth;
        const vh = innerHeight;
        const el = document.createElement("div");
        el.className = "tut-label";
        el.textContent = label;
        layer.appendChild(el);
        const lw = el.offsetWidth;
        const lh = el.offsetHeight;
        const gap = 64;
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        // The side with room for the callout: right, left, below, above.
        const options = [
          { x: r.x + r.width + gap, y: cy - lh / 2 - 34, ok: vw - (r.x + r.width) > lw + gap + 16 },
          { x: r.x - gap - lw, y: cy - lh / 2 - 34, ok: r.x > lw + gap + 16 },
          { x: cx - lw / 2 + 50, y: r.y + r.height + gap, ok: vh - (r.y + r.height) > lh + gap + 140 },
          { x: cx - lw / 2 + 50, y: r.y - gap - lh, ok: r.y > lh + gap + 60 },
        ];
        const pick = options.find((o) => o.ok) ?? { x: cx - lw / 2, y: cy - lh / 2 };
        const lx = Math.max(12, Math.min(vw - lw - 12, pick.x));
        const ly = Math.max(58, Math.min(vh - lh - 12, pick.y));
        Object.assign(el.style, { left: `${lx}px`, top: `${ly}px` });
        boxes.push({ left: lx, top: ly, right: lx + lw, bottom: ly + lh });
        // Arrow from the callout's edge to the nearest point of the box.
        const c = { x: lx + lw / 2, y: ly + lh / 2 };
        const to = {
          x: Math.max(r.x - pad, Math.min(r.x + r.width + pad, c.x)),
          y: Math.max(r.y - pad, Math.min(r.y + r.height + pad, c.y)),
        };
        const dx = to.x - c.x;
        const dy = to.y - c.y;
        if (dx || dy) {
          const s = Math.min(dx ? (lw / 2 + 4) / Math.abs(dx) : Infinity, dy ? (lh / 2 + 4) / Math.abs(dy) : Infinity, 1);
          arrow(layer, el, { x: c.x + dx * s, y: c.y + dy * s }, to);
        }
      }
      layout();
    },
    clear() {
      window.__tut.highlight([]);
    },
    cursor(x, y, ms = 550, visible = true) {
      const c = $(".tut-cursor");
      c.classList.toggle("gone", !visible);
      c.style.transitionDuration = `${ms}ms`;
      c.style.transform = `translate(${x}px, ${y}px)`;
    },
    ripple(x, y) {
      const r = document.createElement("div");
      r.className = "tut-ripple";
      Object.assign(r.style, { left: `${x}px`, top: `${y}px` });
      ensure().appendChild(r);
      setTimeout(() => r.remove(), 700);
    },
    key(text, x, y) {
      const k = document.createElement("div");
      k.className = "tut-key";
      k.textContent = text;
      Object.assign(k.style, { left: `${x}px`, top: `${y}px` });
      ensure().appendChild(k);
      setTimeout(() => k.remove(), 1700);
    },
    card(html) {
      const el = $(".tut-card");
      $(".tut-cursor").classList.toggle("gone", !!html);
      if (!html) return el.classList.add("hidden");
      el.innerHTML = `<div class="inner">${html}</div>`;
      el.classList.remove("hidden");
    },
  };
  if (document.body) ensure();
  else document.addEventListener("DOMContentLoaded", ensure);
})();
