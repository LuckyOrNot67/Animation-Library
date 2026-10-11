import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { PROJECT_DIR } from "./lib/paths.js";
const terms = process.argv.slice(2).map((t) => t.toLowerCase());
const lines = createInterface({
  input: createReadStream(PROJECT_DIR + "/learning/actions.jsonl"),
  crlfDelay: Infinity,
});
const best = [];
let count = 0;
const rank = (a, b) =>
  Number(b.complete) - Number(a.complete) ||
  Number(a.format !== "spine-json") - Number(b.format !== "spine-json");
for await (const line of lines) {
  if (!line.trim()) continue;
  const r = JSON.parse(line);
  if (
    !terms.every((t) =>
      JSON.stringify([r.name, r.machine, r.action, r.tags])
        .toLowerCase()
        .includes(t),
    )
  )
    continue;
  count++;
  best.push(r);
  best.sort(rank);
  if (best.length > 20) best.pop();
}
console.log(`${count} résultats. 20 premiers :`);
for (const r of best)
  console.log(
    `${r.machine} / ${r.name} / ${r.action} | ${r.duration ?? "?"}s | ${r.rights}\n  ${r.analysisPath}\n  ${r.packagePath}`,
  );
