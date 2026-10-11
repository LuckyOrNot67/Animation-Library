import fs from "node:fs/promises";
import path from "node:path";
import { filenameFromUrl, urlKey } from "./lib/util.js";

// Read response bodies only. Headers, cookies and request bodies never enter the library.
export async function readHar(file) {
  let har;
  try {
    har = JSON.parse((await fs.readFile(file, "utf8")).replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(
      `HAR illisible : ${path.basename(file)}. Réexporte le Network avec le contenu des réponses.`,
    );
  }
  if (!Array.isArray(har?.log?.entries))
    throw new Error(
      `HAR invalide : ${path.basename(file)} (log.entries absent).`,
    );
  const assets = [],
    issues = [];
  let missing = 0,
    skipped = 0;
  for (const [i, entry] of har.log.entries.entries()) {
    const content = entry.response?.content;
    const source = `${path.basename(file)}#response-${i + 1}`;
    let key;
    try {
      const u = new URL(entry.request?.url);
      if (!["http:", "https:"].includes(u.protocol)) {
        skipped++;
        continue;
      }
      key = urlKey(u.href);
    } catch {
      skipped++;
      continue;
    }
    const status = entry.response?.status;
    if (
      !Number.isFinite(status) ||
      status < 200 ||
      (status >= 300 && status !== 304)
    ) {
      skipped++;
      continue;
    }
    if (!content || typeof content.text !== "string" || !content.text.length) {
      missing++;
      if (
        /\.(json|atlas|skel|png|jpe?g|webp|ktx2?)(?:$|\?)/i.test(key) ||
        /image|json/.test(content?.mimeType || "")
      )
        issues.push({
          file: source,
          error:
            "Réponse sans contenu dans le HAR : réexporter avec les réponses intégrées.",
        });
      continue;
    }
    if (content.encoding && content.encoding !== "base64") {
      issues.push({
        file: source,
        error: `Encodage HAR non pris en charge : ${content.encoding}`,
      });
      continue;
    }
    if (
      !content.encoding &&
      /^(image\/|application\/octet-stream)/i.test(content.mimeType || "")
    ) {
      issues.push({
        file: source,
        error: "Réponse binaire sans encodage base64 : contenu inexploitable.",
      });
      continue;
    }
    const buf = Buffer.from(
      content.text,
      content.encoding === "base64" ? "base64" : "utf8",
    );
    assets.push({ buf, source, key, filename: filenameFromUrl(key) });
  }
  return {
    assets,
    issues,
    report: {
      file: path.basename(file),
      entries: har.log.entries.length,
      extracted: assets.length,
      missingBodies: missing,
      skipped,
    },
  };
}
