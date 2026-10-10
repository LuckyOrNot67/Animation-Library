import { buildLibrary } from "./library.js";
import { PROJECT_DIR } from "./lib/paths.js";
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(
    'npm run build [-- --machine "Sugar Rush"] : trie reception/ vers bibliotheque/ sans modifier les sources.',
  );
} else {
  const i = args.indexOf("--machine");
  if (
    args.some((a) => a !== "--machine" && a !== args[i + 1]) ||
    (i >= 0 && !args[i + 1])
  )
    throw new Error('Option attendue : --machine "Nom du dossier"');
  const result = await buildLibrary(PROJECT_DIR, i >= 0 ? args[i + 1] : null);
  console.log(
    `${result.machines.length} machine(s), ${result.packages.length} package(s). Lance npm start pour ouvrir le viewer.`,
  );
}
