import path from "node:path";
import { fileURLToPath } from "node:url";
export const PROJECT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const LOGS_DIR = path.join(PROJECT_DIR, ".local/logs");
