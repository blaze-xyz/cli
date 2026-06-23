/**
 * Self-contained interactive HTML report generator for the Agent NLP eval.
 *
 * `buildHtmlReport(data)` returns a COMPLETE single-file HTML document with
 * embedded CSS, vanilla JS, and the eval data inlined as a JSON blob. No CDN /
 * network dependencies — it opens offline by double-clicking. The page renders a
 * left sidebar (scenario navigation, search, verdict filters) and a main panel
 * (prompt → turns → tool calls/results → final answer → verdict → judge).
 *
 * Security: all eval data is injected as a single JSON blob inside a
 * <script type="application/json"> tag (with `</` escaped so it can't break out
 * of the tag), then parsed by the page JS. Every value from the data is rendered
 * via textContent / DOM building — never innerHTML with raw data. The only
 * innerHTML used is our own static template strings.
 */

export interface HtmlReportScenario {
  id: string
  tier: "Deterministic" | "Live" | "Agentic" | "Safety"
  context: string // consumer | business | agnostic
  /** Feature category for sidebar grouping (per #3476): Insights | Payments | Business | Safety | Error Handling | Other. */
  category?: string
  prompt: string
  verdict: "PASS" | "FAIL" | "WARN" | "SKIP"
  toolSequence: string[]
  finalAnswer: string
  reasons: string[] // deterministic + judge reasons
  judgeVerdict?: "PASS" | "FAIL"
  judgeReasoning?: string
  turns: Array<{
    index: number
    reasoning?: string // agent text that turn (may be empty)
    toolCalls: Array<{
      name: string
      input: unknown
      result: unknown
      isError: boolean
    }>
  }>
}

export interface HtmlReportData {
  generatedAt: string
  model: string
  baseUrl: string
  counts: {
    total: number
    pass: number
    fail: number
    warn: number
    skip: number
  }
  scenarios: HtmlReportScenario[]
}

/** Inline JSON so it can't break out of the <script> tag. */
function escapeForScriptTag(json: string): string {
  return json.replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
}

const STYLE = `
:root {
  --pass: #16a34a;
  --warn: #d97706;
  --fail: #dc2626;
  --skip: #6b7280;
  --bg: #f8fafc;
  --panel: #ffffff;
  --border: #e2e8f0;
  --text: #0f172a;
  --muted: #64748b;
  --accent: #2563eb;
  --accent-soft: #eff6ff;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: var(--text);
  background: var(--bg);
  font-size: 14px;
  line-height: 1.5;
}
header.topbar {
  position: sticky; top: 0; z-index: 10;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  padding: 12px 20px;
  display: flex; flex-wrap: wrap; align-items: center; gap: 16px;
}
header.topbar h1 { font-size: 16px; margin: 0; font-weight: 700; }
.meta { color: var(--muted); font-size: 12px; display: flex; gap: 14px; flex-wrap: wrap; }
.meta b { color: var(--text); font-weight: 600; }
.pills { display: flex; gap: 8px; margin-left: auto; flex-wrap: wrap; }
.pill {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 600; color: #fff;
  padding: 3px 10px; border-radius: 999px;
}
.pill.pass { background: var(--pass); }
.pill.warn { background: var(--warn); }
.pill.fail { background: var(--fail); }
.pill.skip { background: var(--skip); }
.pill.total { background: #334155; }

.layout { display: flex; height: calc(100vh - 58px); }
aside.sidebar {
  width: 300px; min-width: 300px;
  border-right: 1px solid var(--border);
  background: var(--panel);
  display: flex; flex-direction: column;
}
.sidebar-controls { padding: 10px; border-bottom: 1px solid var(--border); }
.search {
  width: 100%; padding: 7px 10px; font-size: 13px;
  border: 1px solid var(--border); border-radius: 6px; outline: none;
}
.search:focus { border-color: var(--accent); }
.filters { display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
.filter-btn {
  font-size: 11px; font-weight: 600; padding: 4px 9px;
  border: 1px solid var(--border); border-radius: 999px;
  background: #fff; color: var(--muted); cursor: pointer;
}
.filter-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.scenario-list { overflow-y: auto; flex: 1; padding-bottom: 24px; }
.cat-group { border-bottom: 1px solid var(--border); }
.cat-head {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px; cursor: pointer; user-select: none;
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--muted); background: #f1f5f9;
}
.cat-head .caret { transition: transform 0.15s; font-size: 10px; }
.cat-group.collapsed .caret { transform: rotate(-90deg); }
.cat-group.collapsed .cat-rows { display: none; }
.cat-count { margin-left: auto; font-weight: 600; }
.row {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 9px 12px; cursor: pointer;
  border-left: 3px solid transparent;
  font-size: 13px;
}
.row:hover { background: var(--accent-soft); }
.row.active { background: var(--accent-soft); border-left-color: var(--accent); }
.row .badge { font-size: 13px; width: 16px; text-align: center; flex-shrink: 0; line-height: 1.4; }
.row .rmeta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.row .rprompt {
  font-weight: 600; color: var(--text); line-height: 1.35;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; word-break: break-word;
}
.row .rid {
  font-size: 11px; color: var(--muted); font-family: var(--mono);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.row .tag {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  padding: 1px 5px; border-radius: 4px; background: #e2e8f0; color: #475569;
  flex-shrink: 0; margin-top: 1px;
}
.row.hidden { display: none; }
.cat-group.empty { display: none; }

main.panel { flex: 1; overflow-y: auto; padding: 20px 28px 60px; }
.panel-head {
  display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap;
  margin-bottom: 16px;
}
.panel-title { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.panel-head h2 { margin: 0; font-size: 20px; font-weight: 700; line-height: 1.3; word-break: break-word; }
.panel-head .panel-subtitle {
  font-family: var(--mono); font-size: 12px; color: var(--muted);
}
.panel-badges { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.nav-btns { margin-left: auto; display: flex; gap: 6px; }
.nav-btn {
  font-size: 13px; padding: 5px 12px; border: 1px solid var(--border);
  border-radius: 6px; background: #fff; cursor: pointer; color: var(--text);
}
.nav-btn:hover { background: var(--accent-soft); border-color: var(--accent); }
.nav-btn:disabled { opacity: 0.4; cursor: default; }

.verdict-badge {
  font-size: 12px; font-weight: 700; color: #fff;
  padding: 3px 10px; border-radius: 6px; text-transform: uppercase;
}
.verdict-badge.pass { background: var(--pass); }
.verdict-badge.warn { background: var(--warn); }
.verdict-badge.fail { background: var(--fail); }
.verdict-badge.skip { background: var(--skip); }
.ctx-tag {
  font-size: 11px; font-weight: 600; color: #475569;
  padding: 3px 9px; border-radius: 6px; background: #e2e8f0;
}

.section { margin-bottom: 22px; }
.section > .label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px;
}
.turn {
  border: 1px solid var(--border); border-radius: 8px;
  background: var(--panel); margin-bottom: 14px; overflow: hidden;
}
.turn-head {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--muted);
  padding: 8px 14px; background: #f1f5f9; border-bottom: 1px solid var(--border);
}
.turn-head .turn-step {
  font-weight: 600; text-transform: none; letter-spacing: 0;
  color: var(--muted);
}
.turn-body { padding: 12px 14px; }
/* Timeline entry marker label (💭 Thought / 🛠 Tool). */
.step-label {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--muted); margin-bottom: 5px;
}
.reasoning {
  background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b;
  padding: 10px 13px; margin-bottom: 12px; border-radius: 0 8px 8px 0;
  white-space: pre-wrap; word-break: break-word;
  font-size: 13px; color: #422006;
}
.reasoning .step-label { color: #b45309; }
.reasoning b { color: var(--text); }
.tool-card {
  border: 1px solid var(--border); border-radius: 6px;
  margin-top: 10px; overflow: hidden;
}
.tool-card.error { border-color: var(--fail); }
.tool-name {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--mono); font-size: 13px; font-weight: 600;
  padding: 7px 12px; background: #f8fafc; border-bottom: 1px solid var(--border);
}
.tool-card.error .tool-name { background: #fef2f2; color: var(--fail); }
.tool-err-tag {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  color: #fff; background: var(--fail); padding: 1px 6px; border-radius: 4px;
}
.io { padding: 8px 12px; }
.io .io-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  color: var(--muted); margin-bottom: 4px;
}
pre {
  font-family: var(--mono); font-size: 12px;
  background: #0f172a; color: #e2e8f0;
  padding: 10px 12px; border-radius: 6px; margin: 0;
  white-space: pre-wrap; word-break: break-word;
  max-height: 360px; overflow: auto;
}
.final-block {
  background: #f0fdf4; border: 1px solid #bbf7d0;
  border-radius: 8px; padding: 12px 14px;
  white-space: pre-wrap; word-break: break-word; font-size: 14px;
}
.seq-block { font-family: var(--mono); font-size: 13px; }
.seq-tool {
  display: inline-block; background: #e2e8f0; color: #334155;
  padding: 2px 8px; border-radius: 5px; margin: 2px;
}
.seq-arrow { color: var(--muted); margin: 0 2px; }
.seq-summary {
  background: #f1f5f9; border: 1px solid var(--border);
  border-radius: 8px; padding: 10px 14px; margin-bottom: 18px;
}
.seq-summary .label { margin-bottom: 6px; }
.reasons-list { margin: 0; padding-left: 18px; }
.reasons-list li { margin-bottom: 4px; }
.judge-block {
  border: 1px solid var(--border); border-radius: 8px;
  padding: 12px 14px; background: var(--panel);
}
.judge-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.empty-note { color: var(--muted); font-style: italic; }
`

const SCRIPT = `
(function () {
  "use strict";
  var DATA = JSON.parse(document.getElementById("eval-data").textContent);
  var scenarios = DATA.scenarios || [];
  var byId = {};
  scenarios.forEach(function (s) { byId[s.id] = s; });

  // Sidebar grouping order (per #3476). Any scenario whose category isn't one of
  // these (e.g. "Other") is appended under a trailing group in encounter order.
  var CATEGORIES = ["Insights", "Payments", "Business", "Safety", "Error Handling"];
  var BADGE = { PASS: "✅", WARN: "⚠️", FAIL: "❌", SKIP: "⏭️" };

  // Resolve the ordered list of category buckets actually present in the data,
  // honoring CATEGORIES first, then any extras in first-seen order.
  function orderedCategories() {
    var present = {};
    var extras = [];
    scenarios.forEach(function (s) {
      var c = s.category || "Other";
      if (CATEGORIES.indexOf(c) === -1 && !present[c]) extras.push(c);
      present[c] = true;
    });
    return CATEGORIES.filter(function (c) { return present[c]; }).concat(extras);
  }
  function catOf(s) { return s.category || "Other"; }

  var state = { filter: "ALL", search: "", activeId: null };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function pretty(v) {
    if (v === undefined) return "undefined";
    try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); }
  }
  function vClass(v) { return (v || "").toLowerCase(); }

  function matchesFilter(s) {
    if (state.filter !== "ALL" && s.verdict !== state.filter) return false;
    if (state.search) {
      var q = state.search.toLowerCase();
      if (s.id.toLowerCase().indexOf(q) === -1 &&
          (s.prompt || "").toLowerCase().indexOf(q) === -1) return false;
    }
    return true;
  }

  function visibleScenarios() {
    return scenarios.filter(matchesFilter);
  }

  // ---- sidebar ----
  var listEl = document.getElementById("scenario-list");
  var rowEls = {};
  var groupEls = {};

  function buildSidebar() {
    listEl.innerHTML = "";
    rowEls = {};
    groupEls = {};
    orderedCategories().forEach(function (cat) {
      var inCat = scenarios.filter(function (s) { return catOf(s) === cat; });
      if (!inCat.length) return;
      var group = el("div", "cat-group");
      var head = el("div", "cat-head");
      head.appendChild(el("span", "caret", "▼"));
      head.appendChild(el("span", null, cat));
      var cnt = el("span", "cat-count", String(inCat.length));
      head.appendChild(cnt);
      head.addEventListener("click", function () { group.classList.toggle("collapsed"); });
      group.appendChild(head);
      var rows = el("div", "cat-rows");
      inCat.forEach(function (s) {
        var row = el("div", "row");
        row.setAttribute("data-id", s.id);
        row.appendChild(el("span", "badge", BADGE[s.verdict] || ""));
        var meta = el("div", "rmeta");
        meta.appendChild(el("div", "rprompt", s.prompt || s.id));
        meta.appendChild(el("div", "rid", s.id));
        row.appendChild(meta);
        // tier shown as a small tag on the row (grouping is now by category)
        if (s.tier) row.appendChild(el("span", "tag", s.tier.slice(0, 4)));
        row.addEventListener("click", function () { selectScenario(s.id, true); });
        rows.appendChild(row);
        rowEls[s.id] = row;
      });
      group.appendChild(rows);
      listEl.appendChild(group);
      groupEls[cat] = group;
    });
    applyFilter();
  }

  function applyFilter() {
    orderedCategories().forEach(function (cat) {
      var g = groupEls[cat];
      if (!g) return;
      var anyVisible = false;
      scenarios.filter(function (s) { return catOf(s) === cat; }).forEach(function (s) {
        var row = rowEls[s.id];
        if (!row) return;
        if (matchesFilter(s)) { row.classList.remove("hidden"); anyVisible = true; }
        else { row.classList.add("hidden"); }
      });
      g.classList.toggle("empty", !anyVisible);
    });
  }

  // ---- main panel ----
  var panel = document.getElementById("panel");

  function selectScenario(id, updateHash) {
    var s = byId[id];
    if (!s) return;
    state.activeId = id;
    Object.keys(rowEls).forEach(function (k) {
      rowEls[k].classList.toggle("active", k === id);
    });
    var activeRow = rowEls[id];
    if (activeRow) {
      var grp = activeRow.closest(".cat-group");
      if (grp) grp.classList.remove("collapsed");
      activeRow.scrollIntoView({ block: "nearest" });
    }
    renderPanel(s);
    if (updateHash) {
      if (history.replaceState) history.replaceState(null, "", "#" + encodeURIComponent(id));
      else location.hash = encodeURIComponent(id);
    }
  }

  function renderPanel(s) {
    panel.innerHTML = "";

    var head = el("div", "panel-head");
    var title = el("div", "panel-title");
    var badges = el("div", "panel-badges");
    badges.appendChild(el("span", "verdict-badge " + vClass(s.verdict), s.verdict));
    if (s.category) badges.appendChild(el("span", "ctx-tag", s.category));
    if (s.tier) badges.appendChild(el("span", "ctx-tag", s.tier));
    if (s.context) badges.appendChild(el("span", "ctx-tag", s.context));
    title.appendChild(badges);
    title.appendChild(el("h2", null, s.prompt || s.id));
    title.appendChild(el("div", "panel-subtitle", s.id));
    head.appendChild(title);
    var nav = el("div", "nav-btns");
    var prevBtn = el("button", "nav-btn", "↑ Prev");
    var nextBtn = el("button", "nav-btn", "Next ↓");
    prevBtn.addEventListener("click", function () { move(-1); });
    nextBtn.addEventListener("click", function () { move(1); });
    var vis = visibleScenarios();
    var idx = vis.findIndex(function (x) { return x.id === s.id; });
    prevBtn.disabled = idx <= 0;
    nextBtn.disabled = idx < 0 || idx >= vis.length - 1;
    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    head.appendChild(nav);
    panel.appendChild(head);

    // tool-sequence summary (compact, top of panel)
    var seq = s.toolSequence || [];
    var summary = el("div", "seq-summary");
    summary.appendChild(el("div", "label", "Tool sequence"));
    if (seq.length) {
      var summaryWrap = el("div", "seq-block");
      seq.forEach(function (t, i) {
        if (i > 0) summaryWrap.appendChild(el("span", "seq-arrow", " → "));
        summaryWrap.appendChild(el("span", "seq-tool", t));
      });
      summary.appendChild(summaryWrap);
    } else {
      summary.appendChild(el("div", "empty-note", "no tools called"));
    }
    panel.appendChild(summary);

    // turn-by-turn timeline: thought → tool call → result, in order
    var turns = s.turns || [];
    if (turns.length) {
      var tSec = el("div", "section");
      tSec.appendChild(el("div", "label", "Timeline"));
      turns.forEach(function (turn) {
        var card = el("div", "turn");
        var th = el("div", "turn-head");
        th.appendChild(el("span", null, "Turn " + turn.index));
        var nTools = (turn.toolCalls || []).length;
        th.appendChild(el("span", "turn-step",
          nTools ? (nTools === 1 ? "1 tool call" : nTools + " tool calls") : "thought only"));
        card.appendChild(th);
        var body = el("div", "turn-body");
        // 1) the agent's thought/reasoning for this turn
        if (turn.reasoning && turn.reasoning.trim()) {
          var r = el("div", "reasoning");
          r.appendChild(el("div", "step-label", "💭 Thought"));
          var rbody = el("div", null);
          renderReasoning(rbody, turn.reasoning);
          r.appendChild(rbody);
          body.appendChild(r);
        }
        // 2) then each tool call + result, in call order
        (turn.toolCalls || []).forEach(function (tc) {
          body.appendChild(renderToolCall(tc));
        });
        if (!(turn.reasoning && turn.reasoning.trim()) && !nTools) {
          body.appendChild(el("div", "empty-note", "(no reasoning or tool calls)"));
        }
        card.appendChild(body);
        tSec.appendChild(card);
      });
      panel.appendChild(tSec);
    }

    // final answer
    var fSec = el("div", "section");
    fSec.appendChild(el("div", "label", "Final answer"));
    if (s.finalAnswer && s.finalAnswer.trim()) {
      fSec.appendChild(el("div", "final-block", s.finalAnswer));
    } else {
      fSec.appendChild(el("div", "empty-note", "(no final answer)"));
    }
    panel.appendChild(fSec);

    // verdict / reasons
    var vSec = el("div", "section");
    vSec.appendChild(el("div", "label", "Verdict"));
    var reasons = s.reasons || [];
    if (reasons.length) {
      var ul = el("ul", "reasons-list");
      reasons.forEach(function (rsn) { ul.appendChild(el("li", null, rsn)); });
      vSec.appendChild(ul);
    } else {
      vSec.appendChild(el("div", "empty-note", "No additional reasons recorded."));
    }
    panel.appendChild(vSec);

    // judge
    if (s.judgeVerdict || s.judgeReasoning) {
      var jSec = el("div", "section");
      jSec.appendChild(el("div", "label", "Judge"));
      var jBlock = el("div", "judge-block");
      var jHead = el("div", "judge-head");
      if (s.judgeVerdict) {
        jHead.appendChild(el("span", "verdict-badge " + vClass(s.judgeVerdict), s.judgeVerdict));
      }
      jBlock.appendChild(jHead);
      if (s.judgeReasoning) {
        jBlock.appendChild(el("div", null, s.judgeReasoning));
      }
      jSec.appendChild(jBlock);
      panel.appendChild(jSec);
    }
  }

  // Minimal markdown-ish rendering for reasoning: handle "> " quote lines and
  // **bold**. Done via DOM building (textContent), never raw innerHTML.
  function renderReasoning(container, text) {
    var lines = String(text).split("\\n");
    lines.forEach(function (line, i) {
      if (i > 0) container.appendChild(document.createElement("br"));
      var clean = line.replace(/^>\\s?/, "");
      renderBold(container, clean);
    });
  }
  function renderBold(container, text) {
    var parts = String(text).split(/(\\*\\*[^*]+\\*\\*)/g);
    parts.forEach(function (part) {
      if (/^\\*\\*[^*]+\\*\\*$/.test(part)) {
        container.appendChild(el("b", null, part.slice(2, -2)));
      } else if (part) {
        container.appendChild(document.createTextNode(part));
      }
    });
  }

  function renderToolCall(tc) {
    var card = el("div", "tool-card" + (tc.isError ? " error" : ""));
    var name = el("div", "tool-name");
    name.appendChild(el("span", null, "🛠 " + tc.name));
    if (tc.isError) name.appendChild(el("span", "tool-err-tag", "error"));
    card.appendChild(name);
    var inIo = el("div", "io");
    inIo.appendChild(el("div", "io-label", "→ input"));
    inIo.appendChild(el("pre", null, pretty(tc.input)));
    card.appendChild(inIo);
    var outIo = el("div", "io");
    outIo.appendChild(el("div", "io-label", tc.isError ? "← result (error)" : "← result"));
    outIo.appendChild(el("pre", null, pretty(tc.result)));
    card.appendChild(outIo);
    return card;
  }

  function move(delta) {
    var vis = visibleScenarios();
    if (!vis.length) return;
    var idx = vis.findIndex(function (x) { return x.id === state.activeId; });
    if (idx === -1) { selectScenario(vis[0].id, true); return; }
    var next = idx + delta;
    if (next < 0 || next >= vis.length) return;
    selectScenario(vis[next].id, true);
  }

  // ---- controls ----
  var searchEl = document.getElementById("search");
  searchEl.addEventListener("input", function () {
    state.search = searchEl.value;
    applyFilter();
  });
  Array.prototype.forEach.call(document.querySelectorAll(".filter-btn"), function (btn) {
    btn.addEventListener("click", function () {
      state.filter = btn.getAttribute("data-filter");
      Array.prototype.forEach.call(document.querySelectorAll(".filter-btn"), function (b) {
        b.classList.toggle("active", b === btn);
      });
      applyFilter();
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
  });

  window.addEventListener("hashchange", function () {
    var id = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (id && byId[id] && id !== state.activeId) selectScenario(id, false);
  });

  // ---- init ----
  buildSidebar();
  var initial = decodeURIComponent((location.hash || "").replace(/^#/, ""));
  if (initial && byId[initial]) selectScenario(initial, false);
  else if (scenarios.length) selectScenario(scenarios[0].id, false);
})();
`

export function buildHtmlReport(data: HtmlReportData): string {
  const json = escapeForScriptTag(JSON.stringify(data))
  const c = data.counts
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Agent NLP Eval Report</title>
<style>${STYLE}</style>
</head>
<body>
<header class="topbar">
  <h1>Agent NLP Eval</h1>
  <div class="meta">
    <span><b>Model:</b> <span id="m-model"></span></span>
    <span><b>Base URL:</b> <span id="m-base"></span></span>
    <span><b>Generated:</b> <span id="m-gen"></span></span>
  </div>
  <div class="pills">
    <span class="pill total">Total ${c.total}</span>
    <span class="pill pass">Pass ${c.pass}</span>
    <span class="pill warn">Warn ${c.warn}</span>
    <span class="pill fail">Fail ${c.fail}</span>
    <span class="pill skip">Skip ${c.skip}</span>
  </div>
</header>
<div class="layout">
  <aside class="sidebar">
    <div class="sidebar-controls">
      <input id="search" class="search" type="text" placeholder="Search id or prompt…" autocomplete="off" />
      <div class="filters">
        <button class="filter-btn active" data-filter="ALL">All</button>
        <button class="filter-btn" data-filter="PASS">Pass</button>
        <button class="filter-btn" data-filter="WARN">Warn</button>
        <button class="filter-btn" data-filter="FAIL">Fail</button>
        <button class="filter-btn" data-filter="SKIP">Skip</button>
      </div>
    </div>
    <div id="scenario-list" class="scenario-list"></div>
  </aside>
  <main id="panel" class="panel"></main>
</div>
<script type="application/json" id="eval-data">${json}</script>
<script>
  (function () {
    var d = JSON.parse(document.getElementById("eval-data").textContent);
    document.getElementById("m-model").textContent = d.model || "";
    document.getElementById("m-base").textContent = d.baseUrl || "";
    document.getElementById("m-gen").textContent = d.generatedAt || "";
  })();
</script>
<script>${SCRIPT}</script>
</body>
</html>
`
}
