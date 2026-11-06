import { DOMAINS, FLAGS, LEVELS, arrows, badge, el, fail, fmt, getJSON, nav, params, transformationURL } from "./common.js";

const PAGE = 50;
const $ = (id) => document.getElementById(id);
const state = {
  level: params().get("level") || "L1",
  domains: new Set((params().get("domain") || Object.keys(DOMAINS).join(",")).split(",")),
  robust: params().get("robust") === "1",
  yield: params().get("yield") === "1",
  brenda: params().get("brenda") === "1",
  rbc: params().get("rbc") === "1",
  lit: params().get("lit") === "1",
  near: params().get("near") === "1",
  sort: params().get("sort") || "lab_records",
  q: params().get("q") || "",
  page: 0,
};
let table = null;
let filtered = [];
let levels = null;
let classes = {};
let edits = {};
// Short labels for the table cell; the full ones are in the tooltip and the search.
const SHORT_CLASS = { natural: "natural enzyme", engineered: "engineered enzyme", beyond: "parts nature lacks",
                      partial: "partial precedent", cascade: "cascade step", none: "none found" };
const SHORT_EDIT = { perspective: "other reactant", leaving_group: "leaving group", hydrogens: "±1 H",
                     aromaticity: "aromatic ↔ aliphatic" };

function syncURL() {
  const p = new URLSearchParams({ level: state.level, sort: state.sort });
  if (state.domains.size !== Object.keys(DOMAINS).length) p.set("domain", [...state.domains].join(","));
  if (state.robust) p.set("robust", "1");
  if (state.yield) p.set("yield", "1");
  for (const k of ["brenda", "rbc", "lit", "near"]) if (state[k]) p.set(k, "1");
  if (state.q) p.set("q", state.q);
  history.replaceState(null, "", `?${p}`);
}

async function loadLevel() {
  $("rows").replaceChildren(el("tr", {}, el("td", { colspan: 12, class: "muted" }, "loading…")));
  const data = await getJSON(`data/${state.level}/index.json`);
  const c = Object.fromEntries(data.columns.map((name, i) => [name, i]));
  table = {
    c,
    rows: data.rows,
    text: data.rows.map((r) => [r[c.sig], r[c.summary], r[c.pattern], r[c.lab_how], r[c.enzyme_mechanism],
      classes[r[c.precedent]] || "", SHORT_CLASS[r[c.precedent]] || "",
      r[c.near_miss] ? `near miss ${edits[r[c.near_miss]] || ""} ${SHORT_EDIT[r[c.near_miss]] || ""}` : ""]
      .join(" ").toLowerCase()),
  };
  const meta = levels.levels.find((l) => l.level === state.level);
  $("level-text").textContent = `${state.level}: ${meta.description} ` +
    `${fmt(meta.n_transformations)} transformations, ${fmt(meta.n_listed)} listed.`;
  apply();
}

function apply() {
  const { c, rows, text } = table;
  const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  const robustMask = FLAGS.lab_robust | FLAGS.enzyme_robust | FLAGS.rhea_robust;
  filtered = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!state.domains.has(r[c.domain])) continue;
    if (state.robust && !(r[c.flags] & robustMask)) continue;
    if (state.yield && !r[c.lab_with_yield]) continue;
    if (state.brenda && !r[c.brenda_reactions]) continue;
    if (state.rbc && !r[c.retrobiocat_reactions]) continue;
    if (state.lit && !r[c.precedent]) continue;
    if (state.near && !r[c.near_miss]) continue;
    if (words.length && !words.every((w) => text[i].includes(w))) continue;
    filtered.push(r);
  }
  const k = c[state.sort];
  const asc = state.sort === "lab_first_year";
  filtered.sort((a, b) => {
    const x = a[k] ?? (asc ? 1e9 : -1);
    const y = b[k] ?? (asc ? 1e9 : -1);
    return asc ? x - y : y - x;
  });
  state.page = Math.min(state.page, Math.max(0, Math.ceil(filtered.length / PAGE) - 1));
  syncURL();
  render();
}

function render() {
  const { c } = table;
  const start = state.page * PAGE;
  const page = filtered.slice(start, start + PAGE);
  $("count").textContent = `${fmt(filtered.length)} transformations`;
  $("page").textContent = filtered.length ? `${fmt(start + 1)}–${fmt(start + page.length)}` : "0";
  $("prev").disabled = state.page === 0;
  $("next").disabled = start + PAGE >= filtered.length;
  $("rows").replaceChildren(...page.map((r) => {
    const href = transformationURL(state.level, r[c.sig]);
    const tr = el("tr", { class: "click" },
      el("td", {}, el("a", { href }, arrows(r[c.summary])), el("div", { class: "mono muted small" }, r[c.sig])),
      el("td", {}, el("code", { class: "pattern", title: r[c.pattern] || "" }, r[c.pattern] || "")),
      el("td", { class: "domain" }, badge(r[c.domain]),
        r[c.precedent] ? el("div", { class: "small", title: classes[r[c.precedent]] },
          `literature: ${SHORT_CLASS[r[c.precedent]] || r[c.precedent]}`) : "",
        r[c.near_miss] ? el("div", { class: "small muted", title: edits[r[c.near_miss]] },
          `near miss: ${SHORT_EDIT[r[c.near_miss]] || r[c.near_miss]}`) : ""),
      el("td", { class: "num" }, fmt(r[c.lab_reactions])),
      el("td", { class: "num" }, fmt(r[c.lab_records])),
      el("td", { class: "num" }, fmt(r[c.lab_with_yield])),
      el("td", { class: "num" }, r[c.lab_first_year] ?? ""),
      el("td", { class: "num" }, fmt(r[c.enzyme_reactions])),
      el("td", { class: "num" }, fmt(r[c.rhea_reactions])),
      el("td", { class: "num" }, r[c.brenda_reactions] ? fmt(r[c.brenda_reactions]) : ""),
      el("td", { class: "small" }, r[c.lab_how]),
      el("td", { class: "small" }, r[c.enzyme_mechanism]));
    tr.addEventListener("click", (ev) => { if (ev.target.tagName !== "A") location.href = href; });
    return tr;
  }));
}

function downloadCSV() {
  const cols = Object.keys(table.c);
  const esc = (v) => (v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
  const lines = [["level", ...cols].join(",")].concat(filtered.map((r) => [state.level, ...r].map(esc).join(",")));
  const a = el("a", { href: URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })),
                      download: `transformations_${state.level}_filtered.csv` });
  a.click();
}

async function main() {
  nav("Explorer");
  levels = await getJSON("data/levels.json");
  classes = levels.precedent_classes || {};
  edits = levels.near_miss_edits || {};
  $("level").replaceChildren(...LEVELS.map((l) => el("option", { value: l, selected: l === state.level }, l)));
  $("domains").replaceChildren(...Object.entries(DOMAINS).map(([d, label]) => {
    const box = el("input", { type: "checkbox", checked: state.domains.has(d) });
    box.addEventListener("change", () => { box.checked ? state.domains.add(d) : state.domains.delete(d); state.page = 0; apply(); });
    return el("label", { style: "margin-right:.6rem" }, box, " ", badge(d));
  }));
  $("robust").checked = state.robust;
  $("yield").checked = state.yield;
  for (const k of ["brenda", "rbc", "lit", "near"]) {
    $(k).checked = state[k];
    $(k).addEventListener("change", (e) => { state[k] = e.target.checked; state.page = 0; apply(); });
  }
  $("sort").value = state.sort;
  $("q").value = state.q;
  $("level").addEventListener("change", (e) => { state.level = e.target.value; state.page = 0; loadLevel().catch(fail); });
  $("robust").addEventListener("change", (e) => { state.robust = e.target.checked; state.page = 0; apply(); });
  $("yield").addEventListener("change", (e) => { state.yield = e.target.checked; state.page = 0; apply(); });
  $("sort").addEventListener("change", (e) => { state.sort = e.target.value; state.page = 0; apply(); });
  let timer = null;
  $("q").addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = e.target.value.trim(); state.page = 0; apply(); }, 200);
  });
  $("prev").addEventListener("click", () => { state.page -= 1; render(); });
  $("next").addEventListener("click", () => { state.page += 1; render(); });
  $("csv").addEventListener("click", downloadCSV);
  await loadLevel();
}

main().catch(fail);
