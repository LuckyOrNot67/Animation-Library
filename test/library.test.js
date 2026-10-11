import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { buildLibrary } from "../src/library.js";
const skeleton = {
  skeleton: { spine: "4.2.00", width: 16, height: 16 },
  bones: [{ name: "root" }],
  slots: [{ name: "body", bone: "root", attachment: "body" }],
  skins: [
    {
      name: "default",
      attachments: { body: { body: { width: 16, height: 16 } } },
    },
  ],
  animations: {
    idle: {
      bones: {
        root: {
          rotate: [
            { time: 0, value: 0 },
            { time: 1, value: 10 },
          ],
        },
      },
    },
    exit: {
      bones: {
        root: {
          translate: [
            { time: 0, x: 0 },
            { time: 2, x: 30 },
          ],
        },
      },
    },
  },
};
const atlas =
  "body.png\nsize:16,16\nfilter:Linear,Linear\npma:false\nbody\nbounds:0,0,16,16\n";
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "animation-library-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const input = path.join(root, "reception", "Demo");
  await fs.mkdir(input, { recursive: true });
  await fs.writeFile(path.join(input, "hero.json"), JSON.stringify(skeleton));
  await fs.writeFile(path.join(input, "hero.atlas"), atlas);
  await sharp({
    create: { width: 16, height: 16, channels: 4, background: "#8ee3c8" },
  })
    .png()
    .toFile(path.join(input, "body.png"));
  await fs.writeFile(path.join(input, "unused.js"), 'console.log("ignored")');
  return { root, input };
}
test("associe sources, extrait les pièces et les actions, écarte le bruit sans supprimer les imports", async (t) => {
  const { root, input } = await fixture(t);
  const before = await fs.readFile(path.join(input, "hero.json"));
  const c = await buildLibrary(root);
  assert.equal(c.packages.length, 1);
  const p = c.packages[0];
  assert.equal(p.complete, true);
  assert.equal(p.animations.length, 2);
  assert.equal(p.pieces.length, 1);
  const file = path.join(root, "bibliotheque", p.path, p.pieces[0].file);
  assert.equal((await sharp(file).metadata()).width, 16);
  assert.deepEqual(await fs.readFile(path.join(input, "hero.json")), before);
  assert.equal(c.machines[0].ignored, 1);
  const files = await fs.readdir(
    path.join(root, "bibliotheque", p.path, "actions"),
  );
  assert.equal(files.length, 2);
  const again = await buildLibrary(root);
  assert.equal(again.packages[0].id, p.id);
});
test("signale une texture absente sans perdre le skeleton", async (t) => {
  const { root, input } = await fixture(t);
  await fs.rm(path.join(input, "body.png"));
  const c = await buildLibrary(root);
  assert.equal(c.packages[0].complete, false);
  assert.match(c.packages[0].warnings.join(), /Texture absente/);
});
test("un échec de reconstruction conserve la bibliothèque précédente et libère le verrou", async (t) => {
  const { root, input } = await fixture(t);
  const c = await buildLibrary(root);
  await fs.writeFile(
    path.join(input, "hero.atlas"),
    atlas.replace("body.png", "../body.png"),
  );
  await assert.rejects(buildLibrary(root), /Chemin/);
  const old = JSON.parse(
    await fs.readFile(path.join(root, "bibliotheque/catalogue.json")),
  );
  assert.equal(old.packages[0].id, c.packages[0].id);
  await assert.rejects(fs.access(path.join(root, ".build.lock")));
});
test("isole les machines et refuse les collisions de noms", async (t) => {
  const { root } = await fixture(t);
  await fs.mkdir(path.join(root, "reception", "Démô"));
  await assert.rejects(buildLibrary(root), /collision/i);
});

test("spritesheet : conserve les frames et noms d’actions", async (t) => {
  const { root, input } = await fixture(t);
  await fs.writeFile(
    path.join(input, "sheet.json"),
    JSON.stringify({
      frames: { body: { frame: { x: 0, y: 0, w: 16, h: 16 } } },
      meta: { image: "body.png" },
      animations: { loop: ["body"] },
    }),
  );
  const c = await buildLibrary(root);
  const sheet = c.packages.find((p) => p.format === "spritesheet");
  assert.equal(sheet.pieces.length, 1);
  assert.equal(sheet.animations[0].name, "loop");
});
test("atlas rotatif : restaure orientation et dimensions d’origine", async (t) => {
  const { root, input } = await fixture(t);
  await fs.writeFile(
    path.join(input, "hero.atlas"),
    "body.png\nsize:16,16\nfilter:Linear,Linear\nbody\nbounds:0,0,4,8\nrotate:90\noffsets:2,3,12,14\n",
  );
  const c = await buildLibrary(root);
  const p = c.packages[0];
  const m = await sharp(
    path.join(root, "bibliotheque", p.path, p.pieces[0].file),
  ).metadata();
  assert.equal(m.width, 12);
  assert.equal(m.height, 14);
});

test("pack UHT : extrait un skeleton dont le groupe est un GUID", async (t) => {
  const { root, input } = await fixture(t);
  const pack = {
    resources: [
      {
        type: "UHTSpine",
        id: "7f13f4679528d7947a08606f160e66de",
        data: {
          name: "packed-hero",
          spineJSON: Buffer.from(
            JSON.stringify({
              ...skeleton,
              skeleton: { ...skeleton.skeleton, hash: "packed" },
            }),
          ).toString("base64"),
        },
      },
    ],
  };
  await fs.writeFile(
    path.join(input, "main_resources000.json"),
    JSON.stringify(pack),
  );
  const c = await buildLibrary(root);
  assert.ok(c.packages.some((p) => p.name === "packed-hero"));
});

async function capture(input) {
  const entries = [];
  for (const [name, mime, encoding] of [
    ["hero.json", "application/json", null],
    ["hero.atlas", "text/plain", null],
    ["body.png", "image/png", "base64"],
  ]) {
    const bytes = await fs.readFile(path.join(input, name));
    entries.push({
      request: {
        url: `https://cdn.example.test/game/${name}?token=SECRET_TOKEN`,
        headers: [{ name: "Cookie", value: "PRIVATE_COOKIE" }],
      },
      response: {
        status: 200,
        content: {
          mimeType: mime,
          text: bytes.toString(encoding || "utf8"),
          ...(encoding ? { encoding } : {}),
        },
      },
    });
  }
  return { log: { entries } };
}
test("HAR déposé directement : crée la machine, associe les textures, conserve le HAR et exclut les secrets", async (t) => {
  const { root, input } = await fixture(t);
  const har = await capture(input);
  const file = path.join(root, "reception", "gatorhunters2.har");
  const text = JSON.stringify(har);
  await fs.writeFile(file, text);
  await fs.rm(input, { recursive: true });
  const c = await buildLibrary(root, "gatorhunters2");
  assert.equal(c.machines[0].name, "gatorhunters2");
  assert.equal(c.packages[0].complete, true);
  assert.equal(c.packages[0].pieces.length, 1);
  assert.equal(c.packages[0].animations.length, 2);
  assert.equal(await fs.readFile(file, "utf8"), text);
  const manifest = JSON.parse(
    await fs.readFile(
      path.join(root, "bibliotheque/gatorhunters2/manifest.json"),
      "utf8",
    ),
  );
  assert.equal(manifest.imports[0].extracted, 3);
  assert.ok(!JSON.stringify(manifest).includes("SECRET_TOKEN"));
  assert.ok(!JSON.stringify(manifest).includes("PRIVATE_COOKIE"));
  const again = await buildLibrary(root, "gatorhunters2.har");
  assert.equal(again.packages[0].id, c.packages[0].id);
});
test("HAR dans un dossier : fusionne ses réponses avec les fichiers existants", async (t) => {
  const { root, input } = await fixture(t);
  const har = await capture(input);
  await fs.rm(path.join(input, "body.png"));
  await fs.writeFile(path.join(input, "capture.har"), JSON.stringify(har));
  const c = await buildLibrary(root);
  assert.equal(c.packages.length, 1);
  assert.equal(c.packages[0].complete, true);
});
test("HAR sans réponses intégrées : explique le problème et conserve la sortie précédente", async (t) => {
  const { root, input } = await fixture(t);
  const old = await buildLibrary(root);
  await fs.rm(input, { recursive: true });
  await fs.writeFile(
    path.join(root, "reception", "Demo.har"),
    JSON.stringify({
      log: {
        entries: [
          {
            request: { url: "https://cdn.example.test/hero.json" },
            response: {
              status: 200,
              content: { mimeType: "application/json" },
            },
          },
        ],
      },
    }),
  );
  await assert.rejects(buildLibrary(root), /Aucune réponse exploitable/);
  const c = JSON.parse(
    await fs.readFile(path.join(root, "bibliotheque/catalogue.json"), "utf8"),
  );
  assert.equal(c.packages[0].id, old.packages[0].id);
});
test("HAR invalide : erreur compréhensible et verrou libéré", async (t) => {
  const { root, input } = await fixture(t);
  await fs.rm(input, { recursive: true });
  await fs.writeFile(path.join(root, "reception", "Broken.har"), "{}");
  await assert.rejects(buildLibrary(root), /HAR invalide/);
  await assert.rejects(fs.access(path.join(root, ".build.lock")));
});

test("HAR 304 : conserve une réponse en cache quand son contenu est inclus", async (t) => {
  const { root, input } = await fixture(t);
  const har = await capture(input);
  har.log.entries[2].response.status = 304;
  await fs.rm(input, { recursive: true });
  await fs.writeFile(
    path.join(root, "reception", "Demo.har"),
    JSON.stringify(har),
  );
  const c = await buildLibrary(root);
  assert.equal(c.packages[0].complete, true);
  assert.equal(c.packages[0].pieces.length, 1);
});
