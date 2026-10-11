import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import {
  safeRepoPath,
  gitBlobSha,
  selectAssets,
  fetchSource,
} from "../src/sources.js";
import { inspectRig, learn } from "../src/learn.js";
import { casinoRig } from "../src/create-demo.js";

test("sélection des bundles : ignore symlinks, conserve licences et refuse arbres tronqués", () => {
  const tree = {
    tree: [
      { type: "blob", mode: "100644", path: "examples/a/export/a.atlas" },
      { type: "blob", mode: "100644", path: "examples/a/export/a.png" },
      { type: "blob", mode: "120000", path: "examples/a/export/evil.json" },
      { type: "blob", mode: "100644", path: "examples/a/license.txt" },
      { type: "blob", mode: "100644", path: "examples/b/export/b.atlas" },
    ],
  };
  const s = selectAssets(tree, ["examples/"], 1);
  assert.equal(s.availableFolders, 2);
  assert.equal(s.bundleFolders, 1);
  assert.ok(s.files.some((f) => f.path.endsWith("license.txt")));
  assert.ok(!s.files.some((f) => f.path.endsWith("evil.json")));
  assert.throws(
    () => selectAssets({ ...tree, truncated: true }, [""]),
    /tronqué/,
  );
  for (const p of ["../bad", "a/../../x", "/root", "a\\b", "a/C:x"])
    assert.throws(() => safeRepoPath(p));
});
async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sources-check-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const png = await sharp({
    create: { width: 384, height: 160, channels: 4, background: "#fff" },
  })
    .png()
    .toBuffer();
  const files = {
    "examples/demo/skeleton.json": Buffer.from(JSON.stringify(casinoRig())),
    "examples/demo/texture.atlas": Buffer.from(
      "texture.png\nsize:384,160\nfilter:Linear,Linear\nbody\nbounds:0,16,128,128\nhalo\nbounds:128,0,160,160\nspark\nbounds:294,54,52,52\n",
    ),
    "examples/demo/texture.png": png,
    "README.md": Buffer.from("# Read only guide"),
  };
  const tree = {
    tree: Object.entries(files).map(([p, b]) => ({
      path: p,
      type: "blob",
      mode: "100644",
      size: b.length,
      sha: gitBlobSha(b),
    })),
  };
  const source = {
    id: "test-source",
    repository: "owner/repo",
    commit: "a".repeat(40),
    url: "https://github.com/owner/repo",
    assetPrefixes: ["examples/"],
    guides: ["README.md"],
    rights: "test",
  };
  let downloads = 0;
  const fetcher = async (url, binary) => {
    if (!binary) return tree;
    downloads++;
    const p = decodeURIComponent(url.split("/").slice(6).join("/"));
    assert.ok(files[p], p);
    return files[p];
  };
  return { root, source, files, fetcher, downloads: () => downloads };
}
test("import figé : vérifie blobs, réutilise cache, conserve assets en mode guides-only", async (t) => {
  const f = await setup(t);
  const r = await fetchSource(f.source, { root: f.root, fetcher: f.fetcher });
  assert.equal(r.packages, 1);
  assert.equal(f.downloads(), 4);
  await fetchSource(f.source, { root: f.root, fetcher: f.fetcher });
  assert.equal(f.downloads(), 4);
  await fetchSource(f.source, {
    root: f.root,
    fetcher: f.fetcher,
    guidesOnly: true,
  });
  assert.equal(f.downloads(), 4);
  await fs.access(
    path.join(
      f.root,
      ".local/references/reception/github-test-source/examples/demo/skeleton.json",
    ),
  );
  const index = await learn(f.root);
  assert.equal(index.counts.actions, 5);
  assert.equal(index.cases[0].complexity.bones, 11);
});
test("budget et intégrité : un import invalide ne remplace pas les sources existantes", async (t) => {
  const f = await setup(t);
  await fetchSource(f.source, { root: f.root, fetcher: f.fetcher });
  await assert.rejects(
    fetchSource(f.source, { root: f.root, fetcher: f.fetcher, maxBytes: 1 }),
    /budget/,
  );
  const png = path.join(
    f.root,
    ".local/references/downloads/test-source",
    f.source.commit,
    "examples/demo/texture.png",
  );
  await fs.rm(png);
  await assert.rejects(
    fetchSource(f.source, {
      root: f.root,
      fetcher: async (u, b) => (b ? Buffer.from("corrupt") : f.fetcher(u, b)),
    }),
    /Intégrité/,
  );
  await fs.access(
    path.join(
      f.root,
      ".local/references/reception/github-test-source/examples/demo/skeleton.json",
    ),
  );
});
test("analyse rig : lie os, attachments et actions sans inventer la visibilité", () => {
  const r = inspectRig(casinoRig());
  assert.equal(r.bones.length, 11);
  assert.equal(r.attachments.find((a) => a.slot === "body").bone, "body");
  const win = r.actions.find((a) => a.name === "win");
  assert.ok(win.tags.includes("win"));
  assert.ok(win.channels.some((c) => c.path === "bones.spark0.translate"));
  assert.equal(win.duration, 0.65);
});
