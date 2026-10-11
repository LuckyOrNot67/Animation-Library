import { readHar } from "./har.js";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { detect } from "./detect/index.js";
import { sha256, slugify, stemOf, dirOfKey, writeJson } from "./lib/util.js";
import {
  matchSkeletonAtlases,
  buildImageIndex,
  resolveAtlasPages,
  matchLooseImages,
} from "./analyze/associate.js";
import { extractPragmatic } from "./vendors/pragmatic.js";
import { ktx2ToPng } from "./vendors/basis.js";

export async function walk(dir) {
  const files = [];
  for (const e of (await fs.readdir(dir, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    if (e.name.startsWith(".")) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(f)));
    else if (e.isFile()) files.push(f); // never follow symlinks
  }
  return files;
}
const json = async (f) => JSON.parse(await fs.readFile(f, "utf8"));
const portable = (name) => {
  const parts = String(name).replaceAll("\\", "/").split("/");
  if (
    parts.some((s) => !s || s === "." || s === ".." || /[:\x00-\x1f]/.test(s))
  )
    throw new Error(`Chemin de ressource invalide : ${name}`);
  return parts.join("/");
};
function resource(buf, source, key, filename = path.basename(source)) {
  return {
    buf,
    source,
    filename,
    sha: sha256(buf),
    stem: stemOf(filename),
    keys: [key],
    dirs: new Set([dirOfKey(key)]),
    filenames: new Set([filename]),
    first_ts: null,
    det: detect(buf, { filename }),
  };
}
async function pieces(atlas, image, dest, warnings, cache) {
  const cacheKey = atlas.sha + image.img.sha + image.page.name;
  if (cache.has(cacheKey)) {
    const old = cache.get(cacheKey);
    for (const entry of old.entries) {
      const target = path.join(dest, entry.file);
      await fs.mkdir(path.dirname(target), { recursive: true });
      try {
        await fs.link(path.join(old.dest, entry.file), target);
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
      }
    }
    warnings.push(...old.warnings);
    return old.entries;
  }
  const warningStart = warnings.length;
  // Preserve packed bounds and restore original dimensions/offsets where available.
  let page = null,
    region = null;
  const regions = [];
  for (const raw of atlas.buf
    .toString("utf8")
    .replaceAll("\r", "")
    .split("\n")) {
    const s = raw.trim();
    if (!s) {
      page = null;
      region = null;
      continue;
    }
    if (!s.includes(":")) {
      if (!page) {
        page = s;
        region = null;
      } else {
        region = { name: s, page, props: {} };
        regions.push(region);
      }
    } else if (region) {
      const i = s.indexOf(":");
      region.props[s.slice(0, i)] = s.slice(i + 1).trim();
    }
  }
  const entries = [];
  for (const r of regions.filter((r) => r.page === image.page.name)) {
    try {
      const numbers = (k) => (r.props[k] || "").split(",").map(Number);
      const b = r.props.bounds
        ? numbers("bounds")
        : [...numbers("xy"), ...numbers("size")];
      let [x, y, w, h] = b;
      const rotation =
        r.props.rotate === "true" ? 90 : Number(r.props.rotate || 0);
      if (rotation === 90 || rotation === 270) [w, h] = [h, w];
      if (
        ![x, y, w, h].every(Number.isInteger) ||
        x < 0 ||
        y < 0 ||
        w <= 0 ||
        h <= 0
      )
        throw new Error("bounds invalides");
      let out = sharp(image.img.png || image.img.buf).extract({
        left: x,
        top: y,
        width: w,
        height: h,
      });
      if (rotation) out = out.rotate((360 - rotation) % 360);
      let data = await out.png().toBuffer();
      const dims = await sharp(data).metadata();
      const offsets = r.props.offsets
        ? numbers("offsets")
        : [...numbers("offset"), ...numbers("orig")];
      const [ox, oy, ow, oh] = offsets;
      if (
        [ox, oy, ow, oh].every(Number.isInteger) &&
        ow >= dims.width &&
        oh >= dims.height &&
        ox >= 0 &&
        oy >= 0 &&
        ox + dims.width <= ow &&
        oy + dims.height <= oh
      ) {
        data = await sharp({
          create: {
            width: ow,
            height: oh,
            channels: 4,
            background: "#00000000",
          },
        })
          .composite([{ input: data, left: ox, top: oh - oy - dims.height }])
          .png()
          .toBuffer();
      }
      const file = `pieces/${slugify(r.name)}-${sha256(atlas.sha + r.page + r.name + JSON.stringify(r.props)).slice(0, 8)}.png`;
      await fs.mkdir(path.join(dest, "pieces"), { recursive: true });
      await fs.writeFile(path.join(dest, file), data);
      entries.push({ region: r.name, file, page: r.page, properties: r.props });
    } catch (e) {
      warnings.push(`Découpe ${r.name} : ${e.message}`);
    }
  }
  cache.set(cacheKey, {
    dest,
    entries,
    warnings: warnings.slice(warningStart),
  });
  return entries;
}
export async function buildMachine(input, output, name, harFiles = []) {
  const resources = [],
    ignored = [],
    issues = [];
  const imports = [];
  function addResource(buf, source, key, filename) {
    const r = resource(buf, source, key, filename);
    resources.push(r);
    if (r.det.kind === "json-bundle")
      for (const e of r.det.embedded)
        resources.push(
          resource(
            e.data,
            source + "#" + e.jsonPath,
            new URL(e.name, r.keys[0]).href,
            e.name,
          ),
        );
  }
  const files = input ? await walk(input) : [];
  for (const file of files) {
    if (/\.har$/i.test(file)) {
      harFiles.push(file);
      continue;
    }
    const source = path.relative(input, file).split(path.sep).join("/");
    try {
      addResource(await fs.readFile(file), source, pathToFileURL(file).href);
    } catch (e) {
      issues.push({ file: source, error: e.message });
    }
  }
  for (const file of harFiles) {
    console.log(`Import HAR : ${path.basename(file)}`);
    const imported = await readHar(file);
    imports.push(imported.report);
    issues.push(...imported.issues);
    for (const asset of imported.assets) {
      try {
        addResource(asset.buf, asset.source, asset.key, asset.filename);
      } catch (e) {
        issues.push({ file: asset.source, error: e.message });
      }
    }
    console.log(
      `  ${imported.report.extracted} réponses extraites, ${imported.report.missingBodies} sans contenu.`,
    );
  }
  if (harFiles.length && !resources.length)
    throw new Error(
      "Aucune réponse exploitable dans le HAR. Réexporte avec le contenu des réponses ; la bibliothèque précédente est conservée.",
    );
  const vendor = await extractPragmatic(
    resources,
    (r) => r.buf,
    (u) => resources.find((r) => r.keys.includes(u)),
  );
  if (vendor)
    for (const f of vendor.files)
      resources.push(
        resource(
          f.data,
          "pack:" + f.group,
          new URL(f.name, "embedded://uht-" + slugify(f.group) + "/").href,
          f.name,
        ),
      );
  const byHash = new Map();
  for (const r of resources) {
    const old = byHash.get(r.sha);
    if (old) {
      old.keys.push(...r.keys);
      for (const d of r.dirs) old.dirs.add(d);
      for (const n of r.filenames) old.filenames.add(n);
    } else byHash.set(r.sha, r);
  }
  const unique = [...byHash.values()];
  for (const r of unique.filter((r) => r.det.image?.format === "ktx2")) {
    try {
      r.png = (await ktx2ToPng(r.buf)).png;
    } catch (e) {
      issues.push({ file: r.source, error: e.message });
    }
  }
  const atlases = unique.filter((r) => r.det.kind === "spine-atlas");
  const images = buildImageIndex(
    unique.filter((r) => ["image", "texture"].includes(r.det.kind)),
  );
  const used = new Set(),
    packages = [],
    pieceCache = new Map();
  await fs.mkdir(output, { recursive: true });
  for (const skel of unique.filter((r) =>
    ["spine-json", "spine-skel", "spritesheet"].includes(r.det.kind),
  )) {
    const folder = `animations/${slugify(skel.stem)}-${skel.sha.slice(0, 8)}`;
    const dest = path.join(output, folder),
      warnings = [],
      files = [],
      saved = new Map();
    await fs.mkdir(dest, { recursive: true });
    async function save(r, name) {
      name = portable(name);
      if (saved.has(name) && saved.get(name) !== r.sha)
        throw new Error(`Deux ressources différentes attendues sous ${name}`);
      saved.set(name, r.sha);
      used.add(r.sha);
      await fs.mkdir(path.dirname(path.join(dest, name)), { recursive: true });
      await fs.writeFile(path.join(dest, name), r.buf);
      if (!files.some((f) => f.file === name))
        files.push({
          file: name,
          source: r.source,
          sha256: r.sha,
          kind: r.det.kind,
        });
      return name;
    }
    const skeleton = await save(
      skel,
      skel.det.kind === "spine-skel"
        ? "skeleton.skel"
        : skel.det.kind === "spritesheet"
          ? "spritesheet.json"
          : "skeleton.json",
    );
    const matched =
      skel.det.kind === "spritesheet"
        ? []
        : matchSkeletonAtlases(skel, atlases).chosen;
    const atlasFiles = [],
      textures = [],
      extracted = [];
    for (const c of matched) {
      const a = c.res,
        atlasName = `atlas-${a.sha.slice(0, 8)}.atlas`;
      await save(a, atlasName);
      atlasFiles.push(atlasName);
      let atlasText = a.buf.toString("utf8");
      if (c.cov.ratio !== null && c.cov.ratio < 1)
        warnings.push(
          `Atlas partiel : ${c.cov.matched}/${c.cov.total} régions associées.`,
        );
      for (const pr of resolveAtlasPages(a, images)) {
        if (!pr.img) {
          warnings.push(`Texture absente : ${pr.page.name}`);
          continue;
        }
        if (pr.ambiguous)
          warnings.push(
            `Association ambiguë pour ${pr.page.name} : sélection par dimensions/proximité.`,
          );
        if (pr.sizeMatch === false)
          warnings.push(`Dimensions différentes pour ${pr.page.name}.`);
        const n = portable(pr.page.name);
        if (pr.img.png) {
          const png = n.replace(/\.[^.]+$/, ".png");
          await save(
            pr.img,
            `originaux/${pr.img.sha.slice(0, 8)}-${path.basename(pr.img.filename)}`,
          );
          await fs.mkdir(path.dirname(path.join(dest, png)), {
            recursive: true,
          });
          await fs.writeFile(path.join(dest, png), pr.img.png);
          atlasText = atlasText
            .split("\n")
            .map((line) => (line.trim() === pr.page.name ? png : line))
            .join("\n");
          textures.push(png);
        } else {
          await save(pr.img, n);
          textures.push(n);
        }
        extracted.push(...(await pieces(a, pr, dest, warnings, pieceCache)));
      }
      await fs.writeFile(path.join(dest, atlasName), atlasText);
    }
    if (skel.det.kind === "spine-skel")
      warnings.push(
        "Skeleton binaire : liste des actions lisible dans le runtime, timelines non extraites.",
      );
    let previewAtlas = atlasFiles[0] || null;
    if (atlasFiles.length > 1) {
      previewAtlas = "preview.atlas";
      await fs.writeFile(
        path.join(dest, previewAtlas),
        (
          await Promise.all(
            atlasFiles.map((f) => fs.readFile(path.join(dest, f), "utf8")),
          )
        )
          .map((t) => t.trim())
          .join("\n\n") + "\n",
      );
    }
    if (skel.det.kind === "spritesheet") {
      const ref = skel.det.sheet.image;
      const found = unique.find((r) =>
        r.keys.includes(new URL(ref || "missing", skel.keys[0]).href),
      );
      if (found) {
        await save(found, portable(ref));
        textures.push(ref);
      } else warnings.push(`Texture spritesheet absente : ${ref}`);
      const obj = JSON.parse(skel.buf);
      const frames = Array.isArray(obj.frames)
        ? obj.frames.map((f, i) => [f.filename || String(i), f])
        : Object.entries(obj.frames);
      for (const [n, f] of frames)
        if (found)
          try {
            const rect = f.frame;
            let pic = sharp(found.buf).extract({
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
            });
            if (f.rotated) pic = pic.rotate(270);
            const file = `pieces/${slugify(n)}-${sha256(n).slice(0, 8)}.png`;
            await fs.mkdir(path.join(dest, "pieces"), { recursive: true });
            await pic.png().toFile(path.join(dest, file));
            extracted.push({ region: n, file, properties: f });
          } catch (e) {
            warnings.push(`Frame ${n} : ${e.message}`);
          }
    } else if (!matched.length) {
      const loose = matchLooseImages(skel, images);
      if (loose)
        for (const [region, img] of loose.hits) {
          const n = `images/${portable(region)}.${img.det.image.format === "jpeg" ? "jpg" : img.det.image.format}`;
          await save(img, n);
          textures.push(n);
        }
      warnings.push(
        "Aucun atlas associé : aperçu Spine indisponible, sources conservées.",
      );
    }
    const info = skel.det.spine;
    const actions =
      info?.animations ||
      skel.det.sheet?.animations?.map((name) => ({ name })) ||
      [];
    const meta = {
      id: folder,
      name: skel.stem,
      machine: name,
      format: skel.det.kind,
      version: info?.version || skel.det.skel?.version || null,
      skeleton,
      previewAtlas,
      pma: matched[0]?.res.det.atlas.pages[0]?.pma || false,
      atlases: atlasFiles,
      textures,
      animations: actions,
      skins: info?.skins || [],
      bones: info?.bones || [],
      slots: info?.slots || [],
      pieces: extracted,
      files,
      warnings,
      complete: warnings.length === 0,
    };
    for (const action of actions) {
      const actionFolder = `actions/${slugify(action.name)}-${sha256(action.name).slice(0, 8)}`;
      const original =
        skel.det.kind === "spine-json"
          ? JSON.parse(skel.buf).animations[action.name]
          : JSON.parse(skel.buf).animations?.[action.name];
      await writeJson(path.join(dest, actionFolder, "animation.json"), {
        ...action,
        data: original,
        package: "../../metadata.json",
        note: "Le rig, les skins, atlas et textures du package parent sont requis. Les pièces couvrent tous les skins/actions du rig.",
      });
    }
    await writeJson(path.join(dest, "metadata.json"), meta);
    await fs.writeFile(
      path.join(dest, "README.md"),
      `# ${skel.stem}\n\nMachine : ${name}. Format : ${meta.format}. Version : ${meta.version || "inconnue"}.\n\nLe skeleton contient le rig et toutes les actions. actions/ expose les timelines de chaque action. pieces/ contient les découpes des textures ; metadata.json relie les régions aux pages et sources.\n\n${warnings.map((w) => "- " + w).join("\n")}\n`,
    );
    packages.push(meta);
  }
  const useful = new Set([
    "spine-atlas",
    "spine-json",
    "spine-skel",
    "image",
    "texture",
    "spritesheet",
    "dragonbones",
    "json-bundle",
  ]);
  for (const r of unique) {
    if (used.has(r.sha)) continue;
    if (
      useful.has(r.det.kind) ||
      /\.spine$/i.test(r.filename) ||
      vendor?.consumed.has(r.sha)
    ) {
      const f = `autres/${r.det.kind}/${r.sha.slice(0, 8)}-${path.basename(r.filename).replace(/[^\w.\-]/g, "_")}`;
      await fs.mkdir(path.dirname(path.join(output, f)), { recursive: true });
      await fs.writeFile(path.join(output, f), r.buf);
    } else
      ignored.push({
        file: r.source,
        kind: r.det.kind,
        reason: "Pas de contenu visuel reconnu",
      });
  }
  const manifest = {
    name,
    packages,
    ignored,
    issues,
    sourceFiles: resources.length,
    imports,
  };
  await writeJson(path.join(output, "manifest.json"), manifest);
  return manifest;
}
export async function buildLibrary(root, machine = null) {
  const reception = path.join(root, "reception"),
    library = path.join(root, "bibliotheque");
  await fs.mkdir(reception, { recursive: true });
  await fs.mkdir(library, { recursive: true });
  // Exclusive build lock: another process must never swap the same library.
  const lock = await fs.open(path.join(root, ".build.lock"), "wx");
  try {
    const entries = await fs.readdir(reception, { withFileTypes: true });
    const groups = new Map();
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const isHar = e.isFile() && /\.har$/i.test(e.name);
      if (!e.isDirectory() && !isHar) continue;
      const name = isHar ? e.name.slice(0, -4) : e.name;
      if (machine && name !== machine.replace(/\.har$/i, "")) continue;
      const group = groups.get(name) || { name, input: null, harFiles: [] };
      if (isHar) group.harFiles.push(path.join(reception, e.name));
      else group.input = path.join(reception, e.name);
      groups.set(name, group);
    }
    const dirs = [...groups.values()];
    if (machine && !dirs.length)
      throw new Error(
        `Machine introuvable : ${machine} (dossier ou fichier .har dans reception/)`,
      );
    const ids = new Set();
    for (const d of dirs) {
      const id = slugify(d.name);
      if (ids.has(id))
        throw new Error(`Noms de machines en collision : ${d.name}`);
      ids.add(id);
      const target = path.join(library, id);
      try {
        const old = await json(path.join(target, "manifest.json"));
        if (old.name !== d.name)
          throw new Error(`Collision avec la machine ${old.name}`);
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      const stage = await fs.mkdtemp(path.join(library, ".stage-"));
      const backup = path.join(library, ".backup-" + id);
      try {
        console.log(`Tri : ${d.name}`);
        await buildMachine(d.input, stage, d.name, d.harFiles);
        let existed = false;
        try {
          await fs.rename(target, backup);
          existed = true;
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
        try {
          await fs.rename(stage, target);
        } catch (e) {
          if (existed) await fs.rename(backup, target);
          throw e;
        }
        if (existed) await fs.rm(backup, { recursive: true });
      } finally {
        await fs.rm(stage, { recursive: true, force: true });
      }
    }
    const catalog = { schemaVersion: 1, machines: [], packages: [] };
    for (const e of await fs.readdir(library, { withFileTypes: true }))
      if (e.isDirectory() && !e.name.startsWith(".")) {
        const m = await json(path.join(library, e.name, "manifest.json"));
        catalog.machines.push({
          id: e.name,
          name: m.name,
          packages: m.packages.length,
          ignored: m.ignored.length,
          issues: m.issues,
        });
        catalog.packages.push(
          ...m.packages.map((p) => ({
            ...p,
            id: e.name + "/" + p.id,
            path: e.name + "/" + p.id,
          })),
        );
      }
    await writeJson(path.join(library, "catalogue.json"), catalog);
    return catalog;
  } finally {
    await lock.close();
    await fs.rm(path.join(root, ".build.lock"), { force: true });
  }
}
