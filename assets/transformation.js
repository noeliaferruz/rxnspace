import {
  DOMAINS, arrows, badge, bars, dataURL, depictionBlock, doiURL, drawReactionPattern, ecURL, el, fail, fmt, getJSON, kv,
  legend, nav, params, patentURL, reaction, reactionURL, rheaURL, transformation, transformationURL,
} from "./common.js";

const ROLE_ORDER = { substrate: 0, incoming: 1, "incoming or departing": 2, departing: 3, neighbour: 4 };
const ORDER = { 0: "none", 1: "single", 2: "double", 3: "triple", a: "aromatic", d: "dative", x: "other", i: "(in donor)" };

function state(s) {
  if (!s) return "";
  return `${s.aromatic ? "aromatic" : "aliphatic"}, H${s.H}${s.charge ? `, charge ${s.charge > 0 ? "+" : ""}${s.charge}` : ""}`;
}

function atomTable(t) {
  const atoms = [...t.atoms].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  const rows = atoms.map((a) => {
    let before = "";
    let after = "";
    if (a.before) { before = state(a.before); after = state(a.after); }
    else if (a.states) { before = state(a.states[0]); after = state(a.states[1]); }
    else if ("dH" in a) { after = `ΔH ${a.dH >= 0 ? "+" : ""}${a.dH}${a.dq ? `, Δcharge ${a.dq}` : ""}`; }
    else if (a.role === "incoming") { after = "H" in a ? state(a) : ""; }
    else if (a.role === "departing") { before = [a.aromatic === undefined ? "" : a.aromatic ? "aromatic" : "aliphatic",
      "H" in a ? `H${a.H}` : "", "degree" in a ? `degree ${a.degree}` : ""].filter(Boolean).join(", "); }
    else if (a.role === "neighbour") { before = after = [a.aromatic ? "aromatic" : "aliphatic",
      ...(a.pi_bonds || []).map(([o, e]) => `${ORDER[o]} bond to ${e}`)].join(", "); }
    return el("tr", {}, el("td", {}, a.id + 1), el("td", {}, a.role), el("td", {}, a.element || "any"),
      el("td", {}, before), el("td", {}, after), el("td", {}, a.stereo || ""));
  });
  const bonds = t.bonds.filter((b) => !b.neighbour).map((b) => el("tr", {},
    el("td", {}, b.atoms.map((i) => `${t.atoms[i].element || "X"}${i + 1}`).join("–")),
    el("td", {}, b.unordered ? `${ORDER[b.before]} / ${ORDER[b.after]} (unordered)` : `${ORDER[b.before]} → ${ORDER[b.after]}`),
    el("td", {}, b.ez ? "E/Z changed" : "")));
  return el("div", { class: "grid" },
    el("div", {}, el("h3", {}, "Atoms"), el("table", {},
      el("thead", {}, el("tr", {}, ["#", "role", "element", "before", "after", "stereo"].map((h) => el("th", {}, h)))),
      el("tbody", {}, rows))),
    el("div", {}, el("h3", {}, "Bonds in the centre"), el("table", {},
      el("thead", {}, el("tr", {}, ["atoms", "order", ""].map((h) => el("th", {}, h)))),
      el("tbody", {}, bonds))));
}

function links(t) {
  const out = [];
  for (const [lvl, sig] of Object.entries(t.parents || {})) {
    if (sig) out.push(el("li", {}, "Coarser (", lvl, "): ", el("a", { href: transformationURL(lvl, sig) }, sig)));
  }
  for (const [lvl, info] of Object.entries(t.children || {})) {
    if (!info.n) continue;
    const shown = info.top.map(([sig, n]) => el("li", {}, el("a", { href: transformationURL(lvl, sig) }, sig),
      el("span", { class: "muted" }, ` (${fmt(n)} reactions)`)));
    out.push(el("li", {}, `Finer (${lvl}): ${fmt(info.n)} variant${info.n > 1 ? "s" : ""}`,
      info.n > info.top.length ? el("span", { class: "muted small" }, `; ${info.top.length} listed shown`) : "",
      el("ul", { class: "small" }, shown)));
  }
  return out.length ? el("ul", {}, out) : el("p", { class: "muted" }, "No links at other levels.");
}

async function exampleCard(id) {
  const r = await reaction(id);
  if (!r) return el("div", { class: "example muted" }, `${id}: not found`);
  let head;
  let facts;
  if (r.kind === "lab") {
    head = [el("a", { href: reactionURL(id) }, id), " ",
      r.patent ? el("a", { href: patentURL(r.patent), target: "_blank" }, r.patent) : "",
      r.paragraph ? el("span", { class: "muted" }, ` ¶${r.paragraph}`) : ""];
    facts = kv([["year", r.year], ["yield", r.yield !== null ? `${r.yield}%` : "not reported"],
                ["records", `${fmt(r.n_records)} (${fmt(r.n_records_with_yield)} with yield)`],
                ["reagent classes", r.how || "none recognised"], ["agents", el("code", {}, r.agents || "none")]]);
  } else {
    head = [el("a", { href: reactionURL(id) }, `RHEA:${r.rhea_id}`), " ",
      el("a", { href: rheaURL(r.rhea_id), target: "_blank" }, "rhea-db.org"), " ",
      el("span", { class: "muted" }, r.name || "")];
    facts = kv([["EC", r.ec ? r.ec.split(";").map((e) => el("a", { href: ecURL(e), target: "_blank", style: "margin-right:.4rem" }, e)) : "none"],
                ["tier", r.tier], ["direction", `${r.direction} (${r.dir_class})`],
                ["cofactors", r.cofactors || "none recognised"], ["category", r.category],
                ["spontaneous", r.spontaneous ? "can occur spontaneously (Rhea)" : ""]]);
  }
  return el("div", { class: "example" }, el("div", {}, head), depictionBlock(r.depiction), facts);
}

async function examples(ids) {
  if (!ids || !ids.length) return [el("p", { class: "muted" }, "none")];
  return Promise.all(ids.map(exampleCard));
}

const ASSESSMENT = { genuine: "genuine", two_sites: "a known transformation at two sites",
  data_error: "data-entry error in the source", mapping_artefact: "mis-mapped reaction",
  questionable: "questionable", not_reproduced: "not reproduced" };

const doiLink = (d, text) => el("a", { href: doiURL(d), target: "_blank" }, text || d);
const ecLinks = (ecs) => ecs.filter(Boolean).map((e) => el("a", { href: ecURL(e), target: "_blank", style: "margin-right:.4rem" }, e));
const reviewed = (x) => (x.assessment ? [["checked by hand", `${ASSESSMENT[x.assessment] || x.assessment}${x.note ? ` — ${x.note}` : ""}`]] : []);

// The one-line answer at the top of an L1x page: has an enzyme done it, and is enzyme chemistry one edit away?
function verdictNote(t, classes, edits) {
  const parts = [];
  if (t.literature) {
    const L = t.literature;
    parts.push(el("strong", {}, "Literature check: "), classes[L.precedent] || L.precedent,
      L.enzyme ? `: ${L.enzyme}` : "", ". ");
  }
  if (t.near_miss) {
    const N = t.near_miss;
    parts.push(el("strong", {}, "Near miss: "), N.near_miss ? `${edits[N.edit].toLowerCase()} gives an enzymatic transformation` :
      "no enzymatic transformation one edit away", ". ");
  }
  if (t.brenda) parts.push(el("strong", {}, "BRENDA: "), `${fmt(t.brenda.n_reactions)} reaction${t.brenda.n_reactions > 1 ? "s" : ""}. `);
  if (t.retrobiocat) parts.push(el("strong", {}, "RetroBioCat: "), `${fmt(t.retrobiocat.n_reactions)} reaction${t.retrobiocat.n_reactions > 1 ? "s" : ""}. `);
  return parts.length ? el("p", { class: "note" }, parts) : null;
}

function literatureBlock(L, classes) {
  return [el("h2", {}, "Literature check"),
    el("p", { class: "small muted" }, "The 500 most used lab-only transformations were grouped into chemistry families and ",
      "checked against Europe PMC for any protein catalyst, natural, engineered, designed or artificial (",
      el("a", { href: "report.html#literature" }, "method"), "). Verdicts come from titles and abstracts: check the paper."),
    kv([["family", L.family], ["precedent", classes[L.precedent] || L.precedent], ["verdict", L.verdict],
      ["enzyme", L.enzyme], ["parts beyond nature", L.toolkit], ["needs light", L.light], ["confidence", L.confidence],
      ["paper", L.doi ? doiLink(L.doi, L.reference_title || L.doi) : ""],
      ["more papers", L.other_dois.length ? L.other_dois.map((d) => [doiLink(d), " "]) : ""],
      ["caveat", L.caveat], ["note", L.note],
      ["reverse", L.reverse_in_rhea ? "an enzyme in Rhea runs the reverse reaction" : ""]])];
}

function nearMissBlock(N, edits) {
  const head = [el("h2", {}, "Near miss"), el("p", { class: "small muted" }, "Each of the 5,000 most used lab-only ",
    "transformations was edited once (another leaving group, one hydrogen more or fewer, aliphatic instead of aromatic, ",
    "or another reactant's point of view) and looked up among the transformations enzymes do, in Rhea's physiological ",
    "direction or in BRENDA, seen in at least two reactions (", el("a", { href: "report.html#near-misses" }, "method"), ").")];
  if (!N.near_miss) {
    return [...head, el("p", {}, N.reverse
      ? "No enzymatic transformation is one edit away; an enzyme does the approximate reverse."
      : "No enzymatic transformation is one edit away.")];
  }
  const target = N.listed ? el("a", { href: transformationURL("L1x", N.sig) }, arrows(N.summary) || N.sig)
    : [arrows(N.summary), " ", el("code", {}, N.sig)];
  return [...head, kv([["edit", edits[N.edit] || N.edit],
    ["also reached by", N.edits.filter((e) => e !== N.edit).map((e) => edits[e]).join("; ")],
    ["enzymatic transformation", target], ["source", N.source],
    ["example with this signature", N.example], ["EC", N.ec ? ecLinks(N.ec.split(";")) : ""],
    ["review", N.review ? `${ASSESSMENT[N.review] || N.review}${N.note ? ` — ${N.note}` : ""}` : ""]])];
}

function brendaBlock(B) {
  const ex = B.example || {};
  return [el("h2", {}, "BRENDA (EnzymeMap)"),
    el("p", { class: "small muted" }, "Reactions measured in BRENDA, atom-mapped by EnzymeMap, mostly natural enzymes on ",
      "other substrates. A rare signature shared with the lab can come from mis-mapped reactions on either side."),
    el("div", { class: "grid" },
      el("div", { class: "card" }, el("div", { class: "big" }, fmt(B.n_reactions)), "BRENDA reactions"),
      el("div", { class: "card" }, el("div", { class: "big" }, fmt(B.n_natural)), "on natural substrates")),
    kv(reviewed(B)),
    el("h3", {}, "EC numbers"), bars(B.ec, (e) => el("a", { href: ecURL(e), target: "_blank" }, e)),
    el("h3", {}, "Example"),
    el("div", { class: "example" }, el("div", {}, ex.text || ex.id), depictionBlock(ex.depiction),
      kv([["EC", ecLinks(ex.ec || [])], ["natural substrate", ex.natural ? "yes" : "no"]]))];
}

function retrobiocatBlock(R) {
  const ex = R.example || {};
  return [el("h2", {}, "RetroBioCat"),
    el("p", { class: "small muted" }, "Synthetic biocatalysis curated from papers (wild-type and engineered enzymes). ",
      "Only the public sample of the database is included."),
    el("div", { class: "grid" },
      el("div", { class: "card" }, el("div", { class: "big" }, fmt(R.n_reactions)), "RetroBioCat reactions"),
      el("div", { class: "card" }, el("div", { class: "big" }, fmt(R.n_papers)), "papers")),
    kv(reviewed(R)),
    el("h3", {}, "Reaction types"), bars(R.types),
    el("h3", {}, "Example"),
    el("div", { class: "example" }, el("div", {}, ex.type || ""), depictionBlock(ex.depiction),
      kv([["enzymes", (ex.enzymes || []).join(", ")],
          ["papers", (ex.dois || []).map((d, i) => [doiLink(d, (ex.papers || [])[i] || d), " "])]]))];
}

async function main() {
  nav("Explorer");
  const level = params().get("level");
  const sig = params().get("sig");
  const main = document.getElementById("main");
  const [t, meta] = await Promise.all([transformation(level, sig), getJSON("data/levels.json")]);
  const classes = meta.precedent_classes || {};
  const edits = meta.near_miss_edits || {};
  if (!t) {
    main.replaceChildren(el("h1", {}, "Not listed"), el("p", {}, `Signature ${sig} at ${level} is not in the explorer. `,
      "Lab transformations seen once without mapping consensus are only in the downloads."));
    return;
  }
  document.title = `${arrows(t.summary)} - ${level}`;
  const pattern = el("div", { class: "depict" });
  const parts = [
    el("h1", {}, arrows(t.summary)),
    el("p", {}, el("span", { class: "badge level" }, level), " ", badge(t.domain), " ",
      el("code", {}, sig), " · ", el("a", { href: dataURL(`data/${level}/t/${sig.slice(0, 2)}.json`) }, "JSON"),
      " · ", el("a", { href: `explorer.html?level=${level}` }, "explorer")),
    el("p", { class: "muted small" }, DOMAINS[t.domain], `; reaction centre of ${t.size} atoms.`),
    verdictNote(t, classes, edits),
    el("h2", {}, "Pattern"),
    t.pattern ? el("p", {}, el("code", { class: "pattern" }, t.pattern)) : el("p", { class: "muted" }, "Undirected level: no directed pattern."),
    pattern,
    el("p", { class: "small muted" }, "Mapped atoms are substrate atoms (and their unchanged neighbours at L2); ",
      "atoms only on the right are incoming (their donor is not part of the transformation), ",
      "atoms only on the left are departing."),
    atomTable(t),
    el("h2", {}, "Same reactions at other levels"), links(t),
  ];
  if (t.lab) {
    const L = t.lab;
    parts.push(el("h2", {}, "Lab (USPTO patents)"),
      el("div", { class: "grid" },
        el("div", { class: "card" }, el("div", { class: "big" }, fmt(L.n_reactions)), "distinct reactions"),
        el("div", { class: "card" }, el("div", { class: "big" }, fmt(L.n_records)), "patent records"),
        el("div", { class: "card" }, el("div", { class: "big" }, fmt(L.n_with_yield)), "reactions with a reported yield"),
        el("div", { class: "card" }, el("div", { class: "big" }, L.first_year ?? ""), "first patent year")),
      el("p", { class: "small muted" }, L.consensus ? "Both atom mappers agree on this signature for at least one reaction. " : "",
        L.robust ? "" : "Seen once and not confirmed by the second mapper."),
      el("h3", {}, "Reagent classes (reactions)"), bars(L.how),
      el("h3", {}, "Examples"), legend(), ...(await examples(L.examples)));
  }
  if (t.enzyme) {
    const E = t.enzyme;
    parts.push(el("h2", {}, "Enzymes (Rhea, natural tier)"),
      el("div", { class: "grid" },
        el("div", { class: "card" }, el("div", { class: "big" }, fmt(E.n_reactions)), "Rhea reactions with an enzyme")),
      el("h3", {}, "EC numbers"), bars(E.ec, (ec) => (ec === "(none)" ? ec : el("a", { href: ecURL(ec), target: "_blank" }, ec))),
      el("h3", {}, "Mechanism proxy (EC sub-subclass | cofactors)"), bars(E.mechanism),
      el("h3", {}, "Cofactors"), bars(E.cofactors),
      el("h3", {}, "Examples"), legend(), ...(await examples(E.examples)));
  }
  if (t.rhea && t.rhea.examples_other.length) {
    const R = t.rhea;
    parts.push(el("h2", {}, "Rhea without enzyme or in the non-physiological direction"),
      kv([["Rhea reactions (all)", fmt(R.n_reactions)], ["can occur spontaneously", fmt(R.n_spontaneous)],
          ["tiers", R.tiers.map(([x, n]) => `${x} (${n})`).join(", ")],
          ["categories", R.categories.map(([x, n]) => `${x} (${n})`).join(", ")]]),
      ...(await examples(R.examples_other)));
  }
  if (t.literature) parts.push(...literatureBlock(t.literature, classes));
  if (t.near_miss) parts.push(...nearMissBlock(t.near_miss, edits));
  if (t.brenda) parts.push(...brendaBlock(t.brenda));
  if (t.retrobiocat) parts.push(...retrobiocatBlock(t.retrobiocat));
  parts.push(el("h2", {}, "Signature"), el("p", { class: "small" }, el("code", { class: "pattern" }, t.canonical)),
    el("p", { class: "small muted" }, "Canonical SMILES of the labelled centre graph (dummy atoms numbered by label) ",
      "followed by the sorted labels; the ID is its 64-bit BLAKE2b hash."));
  main.replaceChildren(...parts);
  if (t.pattern) drawReactionPattern(pattern, t.pattern);
}

main().catch(fail);
