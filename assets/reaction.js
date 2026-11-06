import {
  LEVELS, dataURL, depictionBlock, ecURL, el, fail, fmt, kv, legend, nav, params, patentURL, reaction, reactionChunk,
  rheaURL, transformationURL,
} from "./common.js";

async function main() {
  nav("Explorer");
  const id = params().get("id");
  const main = document.getElementById("main");
  const r = await reaction(id);
  if (!r) {
    main.replaceChildren(el("h1", {}, "Not found"), el("p", {}, `${id} is not one of the example reactions.`));
    return;
  }
  const title = r.kind === "lab" ? `Patent reaction ${id}` : `Rhea reaction RHEA:${r.rhea_id}`;
  document.title = title;
  const facts = r.kind === "lab"
    ? kv([["patent", r.patent ? el("a", { href: patentURL(r.patent), target: "_blank" }, r.patent) : ""],
          ["paragraph", r.paragraph], ["year", r.year], ["yield", r.yield !== null ? `${r.yield}%` : "not reported"],
          ["records", `${fmt(r.n_records)} (${fmt(r.n_records_with_yield)} with a yield), first in ${r.first_year}`],
          ["reagent classes", r.how || "none recognised"], ["agents", el("code", {}, r.agents || "none")],
          ["mapping confidence", r.confidence]])
    : kv([["Rhea", el("a", { href: rheaURL(r.rhea_id), target: "_blank" }, `RHEA:${r.rhea_id}`)],
          ["master reaction", r.master_id], ["product", r.name],
          ["EC", r.ec ? r.ec.split(";").map((e) => el("a", { href: ecURL(e), target: "_blank", style: "margin-right:.4rem" }, e)) : "none"],
          ["tier", r.tier], ["direction", `${r.direction} (${r.dir_class})`], ["cofactors", r.cofactors || "none recognised"],
          ["category", r.category], ["spontaneous", r.spontaneous ? "yes (Rhea comment)" : "no"],
          ["mapping confidence", r.confidence]]);
  const sigRows = LEVELS.map((lvl) => el("tr", {}, el("td", {}, lvl),
    el("td", {}, el("a", { href: transformationURL(lvl, r.sigs[lvl]) }, r.sigs[lvl])),
    el("td", {}, r.consensus.includes(lvl) ? "both mappers agree" : "")));
  main.replaceChildren(
    el("h1", {}, title),
    el("p", { class: "small" }, el("a", { href: dataURL(`data/reactions/${reactionChunk(id)}.json`) }, "JSON")),
    depictionBlock(r.depiction), legend(), facts,
    el("h2", {}, "Transformations of this reaction"),
    el("table", {}, el("thead", {}, el("tr", {}, ["level", "signature", "Indigo mapping"].map((h) => el("th", {}, h)))),
      el("tbody", {}, sigRows)),
    el("p", { class: "small muted" }, "Signatures of lab reactions seen once without mapping consensus are not listed in the explorer."),
    el("h2", {}, "Atom-mapped reaction (RXNMapper)"),
    el("p", { class: "small" }, el("code", { class: "pattern" }, r.mapped || "")),
    el("h3", {}, "Mapping input"), el("p", { class: "small" }, el("code", { class: "pattern" }, r.mapping_input)));
}

main().catch(fail);
