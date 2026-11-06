// Shared helpers: data access, links, formatting and RDKit.js depictions.
import { DOWNLOADS, DOWNLOADS_IN_SITE, GZIP } from "./config.js";

export const LEVELS = ["L0", "L1", "L1x", "L2", "L1x_stereo", "L1_undirected", "L1x_undirected"];
export const DOMAINS = {
  shared: "lab and enzyme",
  lab: "lab only",
  lab_rhea: "lab; Rhea without enzyme",
  enzyme: "enzyme only",
  rhea: "Rhea without enzyme",
};
export const FLAGS = { lab_robust: 1, enzyme_robust: 2, rhea_robust: 4, lab_consensus: 8, rhea_consensus: 16,
                       spontaneous: 32, lab_yield: 64 };
const RDKIT = "https://unpkg.com/@rdkit/rdkit@2026.9.1/dist/";
const CENTRE = [1.0, 0.72, 0.35];
const DEPARTING = [0.55, 0.75, 1.0];

// On a gzipped deployment the data files are <path>.gz. Whether we have to
// inflate them depends on the server: some send them as-is, some unzip for us.
export const dataURL = (path) => (GZIP ? `${path}.gz` : path);

const cache = new Map();
export function getJSON(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(dataURL(path)).then(async (r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf[0] !== 0x1f || buf[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(buf));
      const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
      return new Response(stream).json();
    }));
  }
  return cache.get(path);
}

// Bulk files: next to the pages, or under the URL prefix set at build time (null: not published yet).
export function downloadURL(name) {
  if (DOWNLOADS) return `${DOWNLOADS.replace(/\/?$/, "/")}${name}`;
  return DOWNLOADS_IN_SITE ? `downloads/${name}` : null;
}

export const doiURL = (doi) => `https://doi.org/${doi}`;
export const transformationURL = (level, sig) => `transformation.html?level=${level}&sig=${sig}`;
export const reactionURL = (id) => `reaction.html?id=${id}`;
export const rheaURL = (id) => `https://www.rhea-db.org/rhea/${id}`;
export const ecURL = (ec) => `https://enzyme.expasy.org/EC/${ec}`;
export const patentURL = (p) => `https://patents.google.com/patent/${p.replace(/^US0+(?=\d)/, "US")}/en`;

export function reactionChunk(id) {
  return (parseInt(id.slice(1), 10) % 4096).toString(16).padStart(3, "0");
}

export async function transformation(level, sig) {
  const chunk = await getJSON(`data/${level}/t/${sig.slice(0, 2)}.json`);
  return chunk[sig] || null;
}

export async function reaction(id) {
  const chunk = await getJSON(`data/reactions/${reactionChunk(id)}.json`);
  return chunk[id] || null;
}

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

export const arrows = (s) => (s || "").replaceAll("->", "→").replace(/ x(\d+)\b/g, " ×$1");
export const fmt = (n) => (n === null || n === undefined ? "" : Number(n).toLocaleString("en-US"));
export const pct = (x) => (x === null || x === undefined ? "" : `${(100 * x).toFixed(0)}%`);
export const badge = (domain) => el("span", { class: `badge ${domain}`, title: DOMAINS[domain] }, DOMAINS[domain]);
export const params = () => new URLSearchParams(location.search);

export function nav(active) {
  const links = [["index.html", "Overview"], ["explorer.html", "Explorer"], ["report.html", "Report"],
                 ["index.html#data", "Data & API"], ["index.html#definitions", "Definitions"]];
  const header = el("header", { class: "top" },
    el("a", { class: "brand", href: "index.html" }, "Transformation atlas: lab vs enzyme chemistry"),
    el("nav", {}, links.map(([href, text]) => el("a", { href, class: text === active ? "active" : null }, text))));
  document.body.prepend(header);
}

let rdkitPromise = null;
export function rdkit() {
  if (!rdkitPromise) {
    rdkitPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `${RDKIT}RDKit_minimal.js`;
      s.onload = () => window.initRDKitModule({ locateFile: () => `${RDKIT}RDKit_minimal.wasm` }).then(resolve, reject);
      s.onerror = () => reject(new Error("RDKit.js could not be loaded (offline?)"));
      document.head.append(s);
    });
  }
  return rdkitPromise;
}

function highlightDetails(mol, groups, width, height) {
  const colors = {};
  for (const [atoms, color] of groups) for (const i of atoms) colors[i] = color;
  const bonds = [];
  const bondColors = {};
  const json = JSON.parse(mol.get_json());
  (json.molecules[0].bonds || []).forEach((b, i) => {
    const [a, c] = b.atoms;
    if (a in colors && c in colors) {
      bonds.push(i);
      bondColors[i] = colors[a];
    }
  });
  return { atoms: Object.keys(colors).map(Number), bonds, highlightAtomColors: colors, highlightBondColors: bondColors,
           width, height, bondLineWidth: 1, clearBackground: false };
}

export async function drawMolecule(target, smiles, groups = [], width = 360, height = 220) {
  try {
    const RDKit = await rdkit();
    const mol = RDKit.get_mol(smiles);
    if (!mol) throw new Error("unparsable");
    target.innerHTML = mol.get_svg_with_highlights(JSON.stringify(highlightDetails(mol, groups, width, height)));
    mol.delete();
  } catch (err) {
    target.replaceChildren(el("code", { class: "pattern" }, smiles));
  }
}

export async function drawReactionPattern(target, smarts, width = 520, height = 160) {
  try {
    const RDKit = await rdkit();
    const rxn = RDKit.get_rxn(smarts);
    if (!rxn) throw new Error("unparsable");
    target.innerHTML = rxn.get_svg(width, height);
    rxn.delete();
  } catch (err) {
    target.replaceChildren();
  }
}

// Reactants -> product with the reaction centre highlighted.
export function depictionBlock(dep) {
  if (!dep) return el("p", { class: "muted small" }, "No depiction available.");
  const left = el("div", { class: "depict" });
  const right = el("div", { class: "depict" });
  drawMolecule(left, dep.r, [[dep.hr, CENTRE], [dep.hd, DEPARTING]], 420, 220);
  drawMolecule(right, dep.p, [[dep.hp, CENTRE]], 320, 220);
  return el("div", { class: "rxn" }, left, el("span", { class: "arrow" }, "→"), right);
}

export function legend() {
  return el("p", { class: "small muted" },
    "Highlighted:", el("span", { class: "legend-dot", style: "background:rgb(255,184,89)" }),
    "atoms whose bonding changes", el("span", { class: "legend-dot", style: "background:rgb(140,191,255)" }),
    "departing atoms (first atom of the leaving group).");
}

export function bars(items, labelFn = (x) => x) {
  if (!items || !items.length) return el("p", { class: "muted small" }, "none");
  const max = Math.max(...items.map((x) => x[1]));
  return el("div", { class: "bars" }, items.map(([label, n]) => el("div", { class: "row" },
    el("span", {}, labelFn(label)), el("span", { class: "bar", style: `width:${(100 * n) / max}%` }),
    el("span", { class: "n" }, fmt(n)))));
}

export function kv(pairs) {
  return el("dl", { class: "kv" }, pairs.filter(([, v]) => v !== null && v !== undefined && v !== "")
    .flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, v)]));
}

export function fail(err) {
  document.querySelector("main").append(el("p", { class: "error" }, String(err)));
  console.error(err);
}
