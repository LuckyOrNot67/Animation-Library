import { walk } from "./library.js";
import { PROJECT_DIR } from "./lib/paths.js";
import { spawnSync } from "node:child_process";
for (const file of [
  ...(await walk(PROJECT_DIR + "/src")),
  ...(await walk(PROJECT_DIR + "/viewer")),
].filter((f) => f.endsWith(".js"))) {
  const r = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (r.status) process.exit(r.status);
}
console.log("Syntaxe vérifiée.");
