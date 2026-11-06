import { GZIP } from "./config.js";
import { dataURL, downloadURL, el, fail, fmt, getJSON, nav, pct } from "./common.js";

const $ = (id) => document.getElementById(id);
const FIGURES = [
  ["overlap_by_level_robust.png", "Lab, enzyme and shared transformations per level (robust), and the overlap fractions."],
  ["rarefaction.png", "Distinct transformations against the number of reactions sampled: neither collection is saturated."],
  ["lab_growth_by_year.png", "Cumulative lab transformations by first patent year."],
  ["ec_coverage.png", "Share of each EC class's transformations and reactions with a lab precedent."],
  ["enrichment_bond_changes.png", "Bond changes enriched in enzyme or lab transformations."],
  ["enrichment_elements.png", "Elements enriched in enzyme or lab transformations."],
];
const COLUMNS = [
  ["level", "Level", (r) => r.level],
  ["lab", "Lab", (r) => fmt(r.lab)],
  ["enzyme", "Enzyme", (r) => fmt(r.enzyme)],
  ["shared", "Shared", (r) => fmt(r.shared)],
  ["lab_only", "Lab, not in enzyme set", (r) => fmt(r.lab_only)],
  ["enzyme_only", "Enzyme, not in lab", (r) => fmt(r.enzyme_only)],
  ["a", "Enzyme transformations also in lab", (r) => pct(r.frac_enzyme_transformations_in_lab)],
  ["b", "Enzyme reactions with lab precedent", (r) => pct(r.frac_enzyme_reactions_with_lab_precedent)],
  ["c", "Lab records with enzyme precedent", (r) => pct(r.frac_lab_records_with_enzyme_precedent)],
  ["d", "Lab transformations also enzymatic", (r) => pct(r.frac_lab_transformations_in_enzyme)],
];

const API = [
  ["data/levels.json", "Level definitions, counts per domain, flag bits, precedent classes and near-miss edits."],
  ["data/overview.json", "Headline tables, sources with checksums, build commit."],
  ["data/<level>/index.json", "Listed transformations as columns and rows, with BRENDA and RetroBioCat counts and, at L1x, the literature precedent and near-miss edit."],
  ["data/<level>/t/<first two hex digits>.json", "Object keyed by signature: decoded centre (atoms, bonds), pattern, lab and enzyme statistics, label counts, example IDs, links to coarser and finer levels, what BRENDA and RetroBioCat add with a drawn example, and at L1x the literature verdict and near-miss result."],
  ["data/reactions/<id mod 4096, 3 hex digits>.json", "Example reactions (U… patent, R… Rhea): mapped SMILES, depiction data, source metadata, signatures at every level."],
  ["data/results/<analysis>.json", "Summaries of the analyses: summary, literature, enzymemap, near_miss, retrobiocat."],
];
const DOWNLOAD_FILES = [
  ["transformations_<level>.csv.gz", "Every transformation, listed or not, with counts, flags, summary, pattern, canonical signature and BRENDA and RetroBioCat counts."],
  ["lab_reactions.parquet", "Every mapped patent reaction with its signature at each level."],
  ["enzyme_reactions.parquet", "Every mapped Rhea reaction with its signature at each level."],
  ["lab_only_precedent.csv", "Literature verdict per checked lab-only transformation; lab_only_precedent_families.csv per family."],
  ["near_miss_L1x.csv", "Near-miss result for the 5,000 most used lab-only transformations."],
  ["enzymemap_vs_literature.csv", "The checked lab-only transformations against BRENDA (EnzymeMap)."],
  ["retrobiocat_transformations.csv", "Every RetroBioCat transformation with its Rhea, EnzymeMap and patent status."],
];

function apiSection() {
  const code = (path) => (path.includes("<") ? el("code", {}, dataURL(path)) : el("a", { href: dataURL(path) }, el("code", {}, dataURL(path))));
  const dl = (name) => {
    const url = downloadURL(name);
    if (!url) return el("span", {}, el("code", {}, name), el("span", { class: "muted" }, " (published separately; link not set yet)"));
    return name.includes("<") ? el("code", {}, url) : el("a", { href: url }, el("code", {}, url));
  };
  $("api").replaceChildren(
    el("thead", {}, el("tr", {}, el("th", {}, "Path"), el("th", {}, "Content"))),
    el("tbody", {}, API.map(([p, text]) => el("tr", {}, el("td", {}, code(p)), el("td", {}, text))),
      DOWNLOAD_FILES.map(([n, text]) => el("tr", {}, el("td", {}, dl(n)), el("td", {}, text)))));
  if (GZIP) {
    $("gzip-note").textContent = "This deployment stores the JSON gzipped (.json.gz); some servers decompress it on " +
      "the way, so check the first two bytes before inflating.";
  }
  const base = location.href.replace(/[?#].*$/, "").replace(/[^/]*$/, "");
  $("api-example").textContent = (GZIP
    ? `import gzip, json, urllib.request
base = "${base}"
raw = urllib.request.urlopen(base + "data/L1x/index.json.gz").read()
idx = json.loads(gzip.decompress(raw) if raw[:2] == b"\\x1f\\x8b" else raw)`
    : `import json, urllib.request
base = "${base}"
idx = json.load(urllib.request.urlopen(base + "data/L1x/index.json"))`) + `
rows = [dict(zip(idx["columns"], r)) for r in idx["rows"]]
shared = [r for r in rows if r["domain"] == "shared"]
checked = [r for r in rows if r["precedent"]]   # literature-checked lab-only transformations (L1x)`;
}

function overlapTable(ov) {
  const def = $("definition").value;
  const rows = ($("labset").value === "yield" ? ov.overlap_with_yield : ov.overlap)
    .filter((r) => r.definition === def && ["L0", "L1", "L1x", "L2", "L1x_stereo", "L1_undirected", "L1x_undirected"].includes(r.level));
  $("overlap").replaceChildren(
    el("thead", {}, el("tr", {}, COLUMNS.map(([k, h]) => el("th", { class: k === "level" ? null : "num" }, h)))),
    el("tbody", {}, rows.map((r) => el("tr", {}, COLUMNS.map(([k, , f]) => el("td", { class: k === "level" ? null : "num" }, f(r)))))));
}

async function main() {
  nav("Overview");
  const [ov, levels] = await Promise.all([getJSON("data/overview.json"), getJSON("data/levels.json")]);
  $("provenance").textContent = `Built ${ov.generated}${ov.commit ? ` from pipeline commit ${ov.commit}` : ""}.`;
  overlapTable(ov);
  $("definition").addEventListener("change", () => overlapTable(ov));
  $("labset").addEventListener("change", () => overlapTable(ov));

  $("levels").replaceChildren(
    el("thead", {}, el("tr", {}, ["Level", "Definition", "Transformations", "Listed"].map((h, i) => el("th", { class: i > 1 ? "num" : null }, h)))),
    el("tbody", {}, levels.levels.map((l) => el("tr", {},
      el("td", {}, el("a", { href: `explorer.html?level=${l.level}` }, l.level)), el("td", {}, l.description),
      el("td", { class: "num" }, fmt(l.n_transformations)), el("td", { class: "num" }, fmt(l.n_listed))))));

  apiSection();
  $("figures").replaceChildren(...FIGURES.map(([file, caption]) => el("figure", {},
    el("a", { href: `figures/${file}` }, el("img", { src: `figures/${file}`, alt: caption })),
    el("figcaption", {}, caption))));

  $("sources").replaceChildren(el("table", {},
    el("thead", {}, el("tr", {}, ["Source", "Version / files", "Licence", "Citation"].map((h) => el("th", {}, h)))),
    el("tbody", {}, Object.entries(ov.sources).map(([name, s]) => el("tr", {},
      el("td", {}, name),
      el("td", { class: "small" }, s.files.length ? `${s.files[0].version || ""} (${s.files.length} files, retrieved ${s.files[0].retrieved.slice(0, 10)})` : ""),
      el("td", {}, s.license || ""), el("td", { class: "small" }, s.citation || ""))))));
}

main().catch(fail);
