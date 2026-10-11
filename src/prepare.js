import { spawnSync } from "node:child_process";
import { PROJECT_DIR } from "./lib/paths.js";
const steps = [
  [
    "sources.js",
    "--source",
    "spine-official,rigc,spine-animation-ai",
    "--bundles",
    "100",
  ],
  [
    "sources.js",
    "--source",
    "puppiizsunniiz-arknights-spines",
    "--bundles",
    "30",
  ],
  [
    "sources.js",
    "--source",
    "oldbernhardt-langrisser-spiner-db",
    "--bundles",
    "10",
    "--max-mb",
    "256",
  ],
  ["sources.js", "--guides-only"],
  ["create-demo.js"],
  ["learn.js"],
];
for (const [script, ...args] of steps) {
  const r = spawnSync(
    process.execPath,
    [PROJECT_DIR + "/src/" + script, ...args],
    { stdio: "inherit" },
  );
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status || 1);
}
