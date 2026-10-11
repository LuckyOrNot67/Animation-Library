import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { PROJECT_DIR } from "./lib/paths.js";
import { buildLibrary } from "./library.js";
import { writeJson, writeFileAtomic } from "./lib/util.js";

export function safeRepoPath(name) {
  if (
    typeof name !== "string" ||
    !name ||
    name.startsWith("/") ||
    name.includes("\\") ||
    name
      .split("/")
      .some((s) => !s || s === "." || s === ".." || /[\x00-\x1f:]/.test(s))
  )
    throw new Error("Chemin GitHub invalide");
  return name;
}
export function gitBlobSha(buf) {
  return crypto
    .createHash("sha1")
    .update(`blob ${buf.length}\0`)
    .update(buf)
    .digest("hex");
}
export function selectAssets(tree, prefixes, bundleLimit = 100) {
  if (tree.truncated)
    throw new Error("Arbre GitHub tronqué : import incomplet refusé.");
  const blobs = tree.tree.filter(
    (e) => e.type === "blob" && e.mode !== "120000",
  );
  const eligible = blobs.filter((e) =>
    prefixes.some((p) => e.path.startsWith(p)),
  );
  const folders = [
    ...new Set(
      eligible
        .filter((e) => /\.atlas(?:\.txt)?$/i.test(e.path))
        .map((e) => path.posix.dirname(e.path)),
    ),
  ].sort();
  const selected = new Set(
    bundleLimit ? folders.slice(0, bundleLimit) : folders,
  );
  const files = eligible.filter(
    (e) =>
      selected.has(path.posix.dirname(e.path)) &&
      /\.(json|atlas|skel|png|jpe?g|webp|ktx2?|bytes|txt)$/i.test(e.path),
  );
  // Copy example-specific notices alongside the exports, not just the repository license.
  const notices = blobs.filter(
    (e) =>
      /\/(license|notice)\.(txt|md)$/i.test(e.path) &&
      [...selected].some((d) => d.startsWith(path.posix.dirname(e.path) + "/")),
  );
  return {
    files: [
      ...new Map([...files, ...notices].map((e) => [e.path, e])).values(),
    ],
    bundleFolders: selected.size,
    availableFolders: folders.length,
  };
}
async function request(url, binary = false) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const headers = {
      "User-Agent": "Animation-Library",
      Accept: "application/vnd.github+json",
    };
    if (url.startsWith("https://api.github.com/") && process.env.GITHUB_TOKEN)
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(60000),
    });
    if (response.ok)
      return binary
        ? Buffer.from(await response.arrayBuffer())
        : response.json();
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    throw new Error(
      `GitHub HTTP ${response.status} (${new URL(url).hostname}). Vérifie la source ou la limite API.`,
    );
  }
}
export async function fetchSource(
  source,
  {
    root = PROJECT_DIR,
    bundleLimit = 100,
    guidesOnly = false,
    maxBytes = 512 * 1024 * 1024,
    fetcher = request,
  } = {},
) {
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(source.repository) ||
    !/^[a-f0-9]{40}$/.test(source.commit) ||
    !/^[-a-z0-9]+$/.test(source.id)
  )
    throw new Error("Source/commit invalide");
  const treeFile = path.join(
    root,
    ".local/references/trees",
    source.id,
    source.commit + ".json",
  );
  let tree;
  try {
    tree = JSON.parse(await fs.readFile(treeFile, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    tree = await fetcher(
      `https://api.github.com/repos/${source.repository}/git/trees/${source.commit}?recursive=1`,
    );
    await writeJson(treeFile, tree);
  }
  if (!Array.isArray(tree.tree)) throw new Error("Inventaire GitHub invalide");
  const selection = guidesOnly
    ? { files: [], bundleFolders: 0, availableFolders: 0 }
    : selectAssets(tree, source.assetPrefixes, bundleLimit);
  const guides = source.guides
    .map((p) =>
      tree.tree.find(
        (e) => e.path === p && e.type === "blob" && e.mode !== "120000",
      ),
    )
    .filter(Boolean);
  const combined = [
    ...new Map(
      [...selection.files, ...guides].map((e) => [e.path, e]),
    ).values(),
  ];
  const expected = combined.reduce((n, e) => n + (e.size || 0), 0);
  if (expected > maxBytes)
    throw new Error(
      `Source ${source.id} : ${Math.ceil(expected / 1024 / 1024)} Mio > budget. Réduis --bundles ou augmente --max-mb.`,
    );
  const archive = path.join(
    root,
    ".local",
    "references",
    "downloads",
    source.id,
    source.commit,
  );
  const input = path.join(
    root,
    ".local",
    "references",
    "reception",
    "github-" + source.id,
  );
  const files = [];
  let next = 0;
  async function worker() {
    while (next < combined.length) {
      const e = combined[next++];
      safeRepoPath(e.path);
      const target = path.join(archive, e.path);
      let buf;
      try {
        buf = await fs.readFile(target);
        if (gitBlobSha(buf) !== e.sha) buf = null;
      } catch {}
      if (!buf) {
        buf = await fetcher(
          `https://raw.githubusercontent.com/${source.repository}/${source.commit}/${e.path.split("/").map(encodeURIComponent).join("/")}`,
          true,
        );
        if (gitBlobSha(buf) !== e.sha)
          throw new Error(`Intégrité Git invalide : ${e.path}`);
        await writeFileAtomic(target, buf);
      }
      if (
        buf
          .toString("utf8", 0, 80)
          .startsWith("version https://git-lfs.github.com/spec/v1")
      )
        throw new Error(
          `Pointeur Git LFS : ${e.path}. Le contenu réel est nécessaire.`,
        );
      files.push({
        path: e.path,
        gitSha: e.sha,
        bytes: buf.length,
        archive: path.relative(root, target).split(path.sep).join("/"),
      });
    }
  }
  const settled = await Promise.allSettled(Array.from({ length: 6 }, worker));
  const failed = settled.find((r) => r.status === "rejected");
  if (failed) throw failed.reason;
  // Downloads finish and verify before replacing inputs. No upstream scripts are executed.
  if (!guidesOnly) {
    const staging = path.join(
      path.dirname(input),
      ".source-stage-" + source.id,
    );
    await fs.rm(staging, { recursive: true, force: true });
    await fs.mkdir(staging, { recursive: true });
    for (const e of selection.files) {
      await fs.mkdir(path.dirname(path.join(staging, e.path)), {
        recursive: true,
      });
      await fs.copyFile(path.join(archive, e.path), path.join(staging, e.path));
    }
    await fs.rm(input, { recursive: true, force: true });
    await fs.rename(staging, input);
  }
  const guideDir = path.join(root, ".local", "references", "guides", source.id);
  await fs.mkdir(guideDir, { recursive: true });
  for (const e of guides) {
    const dest = path.join(guideDir, e.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(path.join(archive, e.path), dest);
  }
  let packages = 0;
  if (selection.files.length) {
    const c = await buildLibrary(
      path.join(root, ".local", "references"),
      "github-" + source.id,
    );
    packages = c.packages.filter((p) =>
      p.path.startsWith("github-" + source.id + "/"),
    ).length;
  }
  const receipt = {
    schemaVersion: 1,
    source: {
      id: source.id,
      repository: source.repository,
      url: source.url,
      commit: source.commit,
      rights: source.rights,
    },
    availableFolders: selection.availableFolders,
    selectedFolders: selection.bundleFolders,
    packages,
    downloadedBytes: expected,
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    completeSelection: selection.bundleFolders === selection.availableFolders,
  };
  await writeJson(
    path.join(
      root,
      ".local",
      "references",
      "receipts",
      source.id + (guidesOnly ? "-guides" : "") + ".json",
    ),
    receipt,
  );
  return receipt;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.join(PROJECT_DIR, "src/sources.js")
) {
  const args = process.argv.slice(2),
    catalog = JSON.parse(
      await fs.readFile(
        path.join(PROJECT_DIR, "sources/catalogue.json"),
        "utf8",
      ),
    );
  if (args[0] === "list")
    for (const s of catalog.sources)
      console.log(
        `${s.id} | ${s.kind} | ${s.inventory.atlases} atlas | ${s.rights} | ${s.url}`,
      );
  else {
    const values = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--guides-only") {
        values[args[i]] = true;
        continue;
      }
      if (
        !["--source", "--bundles", "--max-mb"].includes(args[i]) ||
        args[i + 1] === undefined
      )
        throw new Error(
          "Options : --source id[,id] --bundles 100 (0=tout) --max-mb 512 --guides-only",
        );
      values[args[i]] = args[++i];
    }
    const ids = values["--source"]?.split(",");
    const selected = catalog.sources.filter((s) =>
      ids ? ids.includes(s.id) : values["--guides-only"] ? true : s.enabled,
    );
    if (ids?.some((id) => !selected.some((s) => s.id === id)))
      throw new Error("Source inconnue. Utilise npm run sources:list.");
    const bundles = Number(values["--bundles"] ?? 100),
      maxMB = Number(values["--max-mb"] ?? 512);
    if (
      !Number.isInteger(bundles) ||
      bundles < 0 ||
      !Number.isFinite(maxMB) ||
      maxMB <= 0
    )
      throw new Error("Limites invalides");
    const lockPath = path.join(PROJECT_DIR, ".local", "sources.lock");
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    const lock = await fs.open(lockPath, "wx");
    try {
      for (const source of selected) {
        if (source.availability) {
          console.log("Source indisponible : " + source.id);
          continue;
        }
        console.log(`Source ${source.id} (${source.rights})`);
        const r = await fetchSource(source, {
          bundleLimit: bundles,
          guidesOnly: !!values["--guides-only"],
          maxBytes: maxMB * 1024 * 1024,
        });
        console.log(
          `${r.packages} packages, ${r.selectedFolders}/${r.availableFolders} dossiers d’atlas, ${Math.round(r.downloadedBytes / 1024 / 1024)} Mio.`,
        );
      }
    } finally {
      await lock.close();
      await fs.rm(lockPath, { force: true });
    }
  }
}
