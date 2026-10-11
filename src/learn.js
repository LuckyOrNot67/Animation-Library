import fs from "node:fs/promises";
import path from "node:path";
import { sniffImage } from "./detect/image.js";
import { PROJECT_DIR } from "./lib/paths.js";
import { writeJson, slugify, sha256 } from "./lib/util.js";

export function inspectRig(rig) {
  const attachments = [];
  const skins = Array.isArray(rig.skins)
    ? rig.skins
    : Object.entries(rig.skins || {}).map(([name, attachments]) => ({
        name,
        attachments,
      }));
  for (const skin of skins)
    for (const [slot, atts] of Object.entries(skin.attachments || {}))
      for (const [name, a] of Object.entries(atts || {}))
        attachments.push({
          skin: skin.name,
          slot,
          name,
          region: a.path || a.name || name,
          type: a.type || "region",
          bone: rig.slots?.find((s) => s.name === slot)?.bone || null,
          transform: {
            x: a.x || 0,
            y: a.y || 0,
            rotation: a.rotation || 0,
            scaleX: a.scaleX ?? 1,
            scaleY: a.scaleY ?? 1,
          },
          size: { width: a.width, height: a.height },
          mesh: a.uvs
            ? {
                uvPairs: a.uvs.length / 2,
                vertexNumbers: a.vertices?.length || 0,
                triangles: (a.triangles?.length || 0) / 3,
                weighted: a.vertices?.length !== a.uvs.length,
              }
            : null,
          parent: a.parent || null,
          sequence: a.sequence || null,
        });
  const actions = Object.entries(rig.animations || {}).map(([name, action]) => {
    const channels = [];
    let keyframes = 0,
      curves = 0,
      duration = 0;
    const visit = (n, trail = []) => {
      if (Array.isArray(n)) {
        if (
          n.some(
            (x) => x && typeof x === "object" && ("time" in x || "curve" in x),
          )
        ) {
          channels.push({ path: trail.join("."), keyframes: n.length });
          keyframes += n.length;
        }
        for (const x of n) visit(x, trail);
        return;
      }
      if (!n || typeof n !== "object") return;
      for (const [k, v] of Object.entries(n)) {
        if (k === "time" && typeof v === "number")
          duration = Math.max(duration, v);
        else if (k === "curve") curves++;
        else visit(v, [...trail, k]);
      }
    };
    visit(action);
    return {
      name,
      duration,
      keyframes,
      curvedKeys: curves,
      channels,
      animatedBones: Object.keys(action.bones || {}),
      animatedSlots: Object.keys(action.slots || {}),
      deformationSkins: Object.keys(action.deform || {}),
      hasDrawOrder: !!(action.drawOrder || action.draworder),
      events: (action.events || []).map((e) => ({
        name: e.name,
        time: e.time || 0,
      })),
      tags: tagAction(name),
    };
  });
  return {
    bones: (rig.bones || []).map((b) => ({
      name: b.name,
      parent: b.parent || null,
      x: b.x || 0,
      y: b.y || 0,
      length: b.length || 0,
      rotation: b.rotation || 0,
      scaleX: b.scaleX ?? 1,
      scaleY: b.scaleY ?? 1,
    })),
    slots: (rig.slots || []).map((s) => ({
      name: s.name,
      bone: s.bone,
      setupAttachment: s.attachment || null,
      blend: s.blend || "normal",
      color: s.color || "ffffffff",
    })),
    attachments,
    actions,
    complexity: {
      bones: rig.bones?.length || 0,
      slots: rig.slots?.length || 0,
      attachments: attachments.length,
      meshAttachments: attachments.filter((a) => a.mesh).length,
      meshUvPairs: attachments.reduce((n, a) => n + (a.mesh?.uvPairs || 0), 0),
      constraints: {
        ik: rig.ik?.length || 0,
        transform: rig.transform?.length || 0,
        path: rig.path?.length || 0,
        physics: rig.physics?.length || 0,
      },
    },
  };
}
export function tagAction(name) {
  const n = name.toLowerCase(),
    tags = [];
  for (const [tag, pattern] of Object.entries({
    idle: /idle|loop|breath/,
    anticipation: /anticip|charge|prepare/,
    win: /win|victory|celebrat|reward|burst/,
    transition: /enter|exit|appear|intro|outro|transition/,
    spin: /spin|rotate|reel/,
    character: /walk|run|attack|shoot|jump|wave/,
    effects: /spark|glow|flash|rain|trail|fx|explode/,
  }))
    if (pattern.test(n)) tags.push(tag);
  return tags.length ? tags : ["unclassified"];
}
async function readOr(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw e;
  }
}
export async function learn(root = PROJECT_DIR) {
  const local = await readOr(path.join(root, "bibliotheque/catalogue.json"), {
    packages: [],
  });
  const refs = await readOr(
    path.join(root, ".local/references/bibliotheque/catalogue.json"),
    { packages: [] },
  );
  const records = [],
    cases = [];
  const textureCache = new Map();
  const output = path.join(root, "learning");
  await fs.mkdir(path.join(output, "cases"), { recursive: true });
  for (const [collection, catalog, base] of [
    ["library", local, path.join(root, "bibliotheque")],
    ["github", refs, path.join(root, ".local/references/bibliotheque")],
  ])
    for (const p of catalog.packages) {
      const packageDir = path.join(base, p.path);
      const id =
        slugify(p.id) + "-" + sha256(collection + "/" + p.id).slice(0, 8);
      let analysis = null;
      if (p.format === "spine-json")
        analysis = inspectRig(
          JSON.parse(
            await fs.readFile(path.join(packageDir, p.skeleton), "utf8"),
          ),
        );
      let texturePixels = 0,
        unknownTextures = 0;
      for (const texture of p.textures) {
        const file = path.join(packageDir, texture);
        const contentKey =
          p.files.find((f) => f.file === texture)?.sha256 || file;
        if (!textureCache.has(contentKey)) {
          let dims = null;
          try {
            dims = sniffImage(await fs.readFile(file));
          } catch (e) {
            if (e.code !== "ENOENT") throw e;
          }
          textureCache.set(contentKey, dims);
        }
        const dims = textureCache.get(contentKey);
        if (dims?.width && dims?.height)
          texturePixels += dims.width * dims.height;
        else unknownTextures++;
      }
      const provenance =
        collection === "github"
          ? await readOr(
              path.join(
                root,
                ".local/references/receipts",
                p.path.split("/")[0].replace(/^github-/, "") + ".json",
              ),
              null,
            )
          : null;
      const summary = {
        id,
        collection,
        name: p.name,
        machine: p.machine,
        format: p.format,
        version: p.version,
        packagePath: path.relative(root, packageDir).split(path.sep).join("/"),
        skeleton: p.skeleton,
        complete: p.complete,
        warnings: p.warnings,
        provenance: provenance?.source || {
          rights: [
            "original-coin-burst",
            "original-wild-symbol",
            "original-bonus-gem",
          ].includes(p.machine)
            ? "original-procedural"
            : "user-provided-unverified",
        },
        complexity: analysis?.complexity || null,
        textureCount: p.textures.length,
        textureBudget: {
          pixels: texturePixels,
          rgbaBytesEstimate: texturePixels * 4,
          unknownDimensions: unknownTextures,
          note: "Estimation RGBA, pas une mesure GPU ni le nombre de draw calls.",
        },
        pieceCount: p.pieces.length,
        actions:
          analysis?.actions ||
          p.animations.map((a) => ({ ...a, tags: tagAction(a.name) })),
        analysisPath: "learning/cases/" + id + "/analysis.json",
        exactActionVisibility: false,
      };
      const atlasRegions = p.pieces.map((piece) => ({
        region: piece.region,
        file: piece.file,
        page: piece.page,
        properties: piece.properties,
      }));
      await writeJson(path.join(output, "cases", id, "analysis.json"), {
        ...summary,
        rig: analysis,
        atlasRegions,
        note: "Les pièces couvrent les atlas associés ; leur présence ne prouve pas leur visibilité dans une action. Une pose exacte doit être évaluée par le runtime.",
      });
      const lines = [
        `# ${p.machine} / ${p.name}`,
        "",
        `Source : ${summary.packagePath}. Format ${p.format}, version ${p.version || "inconnue"}.`,
        "",
        `Droits : ${summary.provenance.rights}. ${p.complete ? "Aucun avertissement structurel." : "Avertissements : " + p.warnings.join("; ")}`,
        "",
        "## Lecture du rig",
        "",
        analysis
          ? `${analysis.complexity.bones} os, ${analysis.complexity.slots} slots, ${analysis.complexity.attachments} attachments, ${analysis.complexity.meshAttachments} meshes.`
          : "Skeleton binaire/spritesheet : structure détaillée non décodée. Utiliser le viewer ou une conversion version-compatible.",
        "",
        "## Actions",
        "",
        ...summary.actions.map(
          (a) =>
            `- ${a.name} : ${a.duration ?? "?"} s, tags ${a.tags.join(", ")}${a.keyframes !== undefined ? ", " + a.keyframes + " clés" : ""}.`,
        ),
        "",
        "## Fichiers utiles",
        "",
        `- Skeleton : ${summary.packagePath}/${p.skeleton}`,
        `- Atlas : ${p.atlases.map((a) => summary.packagePath + "/" + a).join(", ") || "aucun atlas associé"}`,
        `- Pièces : ${summary.packagePath}/pieces/`,
        "- analysis.json relie attachment → slot → bone et région → page de texture.",
        "",
        "Les noms suggèrent une intention ; les tags sont heuristiques, pas une annotation certifiée.",
      ];
      await fs.writeFile(
        path.join(output, "cases", id, "README.md"),
        lines.join("\n") + "\n",
      );
      cases.push(summary);
      for (const a of summary.actions)
        records.push({
          caseId: id,
          collection,
          name: p.name,
          machine: p.machine,
          action: a.name,
          duration: a.duration ?? null,
          tags: a.tags,
          format: p.format,
          version: p.version,
          complete: p.complete,
          keyframes: a.keyframes ?? null,
          channels: a.channels || [],
          rights: summary.provenance.rights,
          analysisPath: summary.analysisPath,
          packagePath: summary.packagePath,
        });
    }
  const hashes = new Set();
  let duplicates = 0;
  for (const p of [...local.packages, ...refs.packages]) {
    const sha = p.files.find((f) => f.file === p.skeleton)?.sha256;
    if (sha) {
      if (hashes.has(sha)) duplicates++;
      hashes.add(sha);
    }
  }
  const index = {
    schemaVersion: 1,
    counts: {
      packages: cases.length,
      actions: records.length,
      jsonPackages: cases.filter((c) => c.format === "spine-json").length,
      binaryPackages: cases.filter((c) => c.format === "spine-skel").length,
      exactDuplicateSkeletons: duplicates,
    },
    cases,
  };
  await writeJson(path.join(output, "index.json"), index);
  await fs.writeFile(
    path.join(output, "actions.jsonl"),
    records.map((r) => JSON.stringify(r)).join("\n") +
      (records.length ? "\n" : ""),
  );
  console.log(
    `${cases.length} packages, ${records.length} actions indexées, ${duplicates} skeletons identiques. Le nombre de fichiers ne mesure pas la qualité.`,
  );
  return index;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.join(PROJECT_DIR, "src/learn.js")
)
  await learn();
