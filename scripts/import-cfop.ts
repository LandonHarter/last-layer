/** Rebuild the checked-in CFOP data from a pinned, MIT-licensed source.
 * Run: bun scripts/import-cfop.ts
 * Source is parsed as literals, never executed. Invalid alternatives are reported.
 */
import { writeFileSync } from "node:fs";
import ts from "typescript";
import { ALGS } from "../src/data/algs";
import { AUFS, caseStickers, cubeCaseKey, engineFor, fitAlg } from "../src/lib/cases";
import { applyAlg, edgesOriented, f2lSolved, otherSlotsSolved, solvedCube } from "../src/lib/cube";
import { isLastSlotSet, type CfopSet } from "../src/lib/cfop-sets";
import { invertAlg, mirrorAlg, simplifyAlg } from "../src/lib/notation";

const REV = "cb95945c3e4839ee1e4b058d4a79bc022615b220";
const SOURCE_URL = `https://raw.githubusercontent.com/tao-yu/Alg-Trainer/${REV}/js/alg_list.js`;
const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Source: ${response.status}`);
const ast = ts.createSourceFile("alg_list.js", await response.text(), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

function literal(node: ts.Expression): unknown {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((n) => literal(n as ts.Expression));
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map((p) => {
    if (!ts.isPropertyAssignment(p)) throw new Error("Expected literal property");
    return [(p.name as ts.StringLiteral).text, literal(p.initializer)];
  }));
  throw new Error(`Not a literal: ${node.getText(ast).slice(0, 80)}`);
}

function source(name: string): Record<string, string[]> {
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (decl.name.getText(ast) === name && decl.initializer) return literal(decl.initializer) as Record<string, string[]>;
    }
  }
  throw new Error(`Missing source ${name}`);
}

// Summer variation: 000 to 222, SpeedCubeDB / Speedsolving wiki order.
// Move sequences are factual data, transcribed from https://www.speedcubedb.com/a/3x3/SV.
const summer = [
  "L R U' R' U L' U2 R U' R'", "R U R' U R' U2 R U R' U R", "R U R D R' U R D' R' U' R'",
  "U2 L R U' R' U L'", "R U' L' U L U2 R' L' U L", "R U' R' U' R U' R'",
  "R U R'", "R U2 R' U' L' U R U' R' L", "R U' R' L' U R U' R' L U' R U' R'",
  "R U R' U' R U R' U R U2 R'", "R U2 R' U R U2 R'", "R2 U R' U R' U' R2 U R' U' R U' R2",
  "U L' R U R' U R U' R' U2 L", "U2 L R U' R2 U L' U' R", "R U2 R' U R U' R' U R U2 R'",
  "R U' R D R' U2 R D' R2", "R U R2 U2 R U R' U R", "R U2 R D R' U' R D' R2",
  "R U L' U' L' U R' U' L U L", "R U' R' U' R U R' U' R U' R'", "R U' R2 U' R2 U' R2 U2 R",
  "R U R2 U' R U' R' U2 R", "R U' R' U' R U' R2 U' R U' R' U2 R", "R U R' U R' U' R U' R' U2 R",
  "R U R D' R U' R' D R U R", "U' R U R D R' U R D' R2", "R' U L U' R2 U R' L'",
];

type Row = { id: string; set: CfopSet; name: string; group: string; algs: string[] };
const rows: Row[] = [];
const seen = new Map<string, Row>();
const rotations = AUFS.flatMap((y) => ["", "x", "x2", "x'", "z", "z'"].map((x) => `${x} ${y.replace("U", "y")}`.trim()));
const frame = (raw: string) => {
  // Sources often omit spaces and the final regrip. Retain ergonomic wide/slice moves.
  const tokens = raw.replace(/[()\[\]]/g, " ").replace(/[’‘`]/g, "'").replace(/([RLUDFBrludfbMESxyz]w?(?:2'?|'2|')?)/g, "$1 ");
  const clean = simplifyAlg(tokens);
  const end = applyAlg(solvedCube(), clean);
  for (const rotation of rotations) {
    if (applyAlg(end, rotation).filter((s) => s.pos.filter(Boolean).length === 1).every((s) => {
      const home = solvedCube()[s.id];
      return home.normal.join() === s.normal.join();
    })) return simplifyAlg(`${clean} ${rotation}`);
  }
  throw new Error(`Cannot restore frame: ${raw}`);
};

const rejected: string[] = [];
function add(set: CfopSet, id: string, name: string, group: string, raw: string) {
  const candidates: string[] = [];
  for (const alt of raw.split("/")) {
    try {
      const clean = frame(alt.trim());
      const choices = isLastSlotSet(set) ? AUFS.map((u) => {
        const y = u.replace("U", "y");
        return simplifyAlg(`${y} ${clean} ${invertAlg(y)}`);
      }) : [clean];
      const valid = choices.find((alg) => {
        const state = caseStickers(alg);
        return isLastSlotSet(set) ? otherSlotsSolved(state) && !f2lSolved(state) : f2lSolved(state);
      });
      if (!valid) throw new Error("Does not preserve the required F2L slots");
      if (["COLL", "ZBLL"].includes(set) && !edgesOriented(caseStickers(valid))) throw new Error("Edges not oriented");
      candidates.push(valid);
    } catch (e) { rejected.push(`${id}: ${alt.trim()} — ${e}`); }
  }
  if (!candidates.length) throw new Error(`${id}: no valid reference\n${rejected.slice(-5).join("\n")}`);
  const row: Row = { id, set, name, group, algs: [candidates[0]] };
  for (const alg of candidates.slice(1)) {
    const fitted = fitAlg(row, alg);
    if (fitted) row.algs.push(fitted);
    else rejected.push(`${id}: alternative does not solve reference: ${alg}`);
  }
  row.algs = [...new Set(row.algs)];
  const engine = engineFor(row);
  if (engine.after.some((auf) => engine.done(engine.start(`${invertAlg(row.algs[0])} ${auf}`)))) return;
  // Symmetric OLL shapes repeat corner-permutation cases in the source. Merge them.
  const key = `${set}:${cubeCaseKey(row)}`;
  const duplicate = seen.get(key);
  if (duplicate) {
    for (const alg of row.algs) {
      const fitted = fitAlg(duplicate, alg);
      if (fitted && !duplicate.algs.includes(fitted)) duplicate.algs.push(fitted);
    }
  } else {
    rows.push(row);
    seen.set(key, row);
  }
}

for (const [group, cases] of Object.entries(source("COLL"))) {
  cases.forEach((raw, i) => add("COLL", `coll-${group.toLowerCase()}-${i + 1}`, `COLL ${group} ${i + 1}`, group, raw));
}
for (const [hand, cases] of Object.entries(source("WVLS"))) {
  // Conjugating FL onto FR retains the other insertion direction (no reflection).
  cases.forEach((raw, i) => add("WV", `wv-${hand.toLowerCase()}-${i + 1}`, `WV ${hand} ${i + 1}`, hand === "FR" ? "Right insertion" : "Left insertion", raw));
}
summer.forEach((raw, i) => {
  add("SV", `sv-right-${i + 1}`, `SV ${i + 1}`, "Right insertion", raw);
  add("SV", `sv-left-${i + 1}`, `SV ${i + 1} mirror`, "Left insertion", mirrorAlg(raw, "FR"));
});
for (const [group, cases] of Object.entries(source("zbll_juliette"))) {
  cases.forEach((raw, i) => add("ZBLL", `zbll-${group.toLowerCase()}-${i + 1}`, `ZBLL ${group} ${i + 1}`, group, raw));
}
for (const a of ALGS.filter((a) => a.set === "PLL")) add("ZBLL", `zbll-${a.id}`, `ZBLL ${a.name}`, "PLL", a.algs.join("/"));
for (const [set, variable] of [["ZBLS", "ZBLS"], ["VHLS", "VHLS"]] as const) {
  for (const [group, cases] of Object.entries(source(variable))) {
    cases.forEach((raw, i) => add(set, `${set.toLowerCase()}-${group}-${i + 1}`, `${set} ${group}.${i + 1}`, `Pair ${group}`, raw));
  }
}
for (const [group, cases] of Object.entries(source("vls_jayden_mcneill"))) {
  cases.forEach((raw, i) => add("VLS", `vls-${group.toLowerCase().replaceAll(" ", "-")}-${i + 1}`, `VLS ${group} ${i + 1}`, group === "WV" ? "Edges oriented" : group, raw));
}
for (const [group, cases] of Object.entries(source("algdbOLLCP"))) {
  cases.forEach((raw, i) => add("OLLCP", `ollcp-${group}-${i + 1}`, `OLLCP ${group}.${i + 1}`, `OLL ${group}`, raw));
}
for (const a of ALGS.filter((a) => a.set === "PLL" && ["pll-aa", "pll-ab", "pll-e"].includes(a.id))) add("OLLCP", `ollcp-${a.id}`, `OLLCP ${a.name}`, "Corners oriented", a.algs.join("/"));

writeFileSync(new URL("../src/data/cfop-algs.json", import.meta.url), `${JSON.stringify(rows, null, 2)}\n`);
writeFileSync(new URL("../src/data/cfop-algs.ts", import.meta.url), `// Generated by scripts/import-cfop.ts. Source, license and counts: cfop-sources.md.\nimport type { Alg } from "./algs";\nimport data from "./cfop-algs.json";\n\nexport const CFOP_ALGS = data as Omit<Alg, "puzzle">[];\n`);
for (const set of new Set(rows.map((r) => r.set))) console.log(`${set}: ${rows.filter((r) => r.set === set).length} cases`);
console.log(`${rejected.length} rejected alternatives`);
if (process.argv.includes("--verbose")) console.log(rejected.join("\n"));
