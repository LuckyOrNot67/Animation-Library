import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PROJECT_DIR } from "./lib/paths.js";
import { writeJson } from "./lib/util.js";
import { buildLibrary } from "./library.js";

export function casinoRig(kind = "coin-burst") {
  const bones = [
    { name: "root" },
    { name: "body", parent: "root" },
    { name: "halo", parent: "root" },
  ];
  for (let i = 0; i < 8; i++)
    bones.push({ name: "spark" + i, parent: "root", rotation: i * 45 });
  const slots = [
    {
      name: "halo",
      bone: "halo",
      attachment: "halo",
      color: "ffffff60",
      blend: "additive",
    },
    { name: "body", bone: "body", attachment: "body" },
  ];
  for (let i = 0; i < 8; i++)
    slots.push({
      name: "spark" + i,
      bone: "spark" + i,
      attachment: "spark",
      color: "ffffff00",
      blend: "additive",
    });
  const attachments = {
    halo: { halo: { width: 160, height: 160 } },
    body: { body: { width: 128, height: 128 } },
  };
  for (let i = 0; i < 8; i++)
    attachments["spark" + i] = { spark: { width: 20, height: 20 } };
  const animations = {
    idle: {
      bones: {
        body: {
          scale: [
            { time: 0, x: 1, y: 1, curve: [0.2, 0, 0.8, 1] },
            { time: 1, x: 1.04, y: 1.04, curve: [0.2, 0, 0.8, 1] },
            { time: 2, x: 1, y: 1 },
          ],
        },
      },
      slots: {
        halo: {
          rgba: [
            { time: 0, color: "ffffff40" },
            { time: 1, color: "ffffff80" },
            { time: 2, color: "ffffff40" },
          ],
        },
      },
    },
    anticipation: {
      bones: {
        body: {
          scale: [
            { time: 0, x: 1, y: 1 },
            { time: 0.2, x: 1.12, y: 0.88 },
            { time: 0.35, x: 0.92, y: 1.08 },
            { time: 0.5, x: 1, y: 1 },
          ],
          rotate: [
            { time: 0, value: 0 },
            { time: 0.15, value: -8 },
            { time: 0.3, value: 6 },
            { time: 0.5, value: 0 },
          ],
        },
      },
    },
    spin: {
      bones: {
        body: {
          rotate: [
            { time: 0, value: 0 },
            { time: 0.8, value: 360 },
          ],
          scale: [
            { time: 0, x: 1, y: 1 },
            { time: 0.2, x: 0.2, y: 1 },
            { time: 0.4, x: 1, y: 1 },
            { time: 0.6, x: 0.2, y: 1 },
            { time: 0.8, x: 1, y: 1 },
          ],
        },
      },
    },
    win: {
      bones: {
        body: {
          scale: [
            { time: 0, x: 0.85, y: 0.85 },
            { time: 0.15, x: 1.25, y: 1.25 },
            { time: 0.3, x: 0.95, y: 0.95 },
            { time: 0.5, x: 1, y: 1 },
          ],
        },
        halo: {
          scale: [
            { time: 0, x: 0.5, y: 0.5 },
            { time: 0.2, x: 1.4, y: 1.4 },
            { time: 0.65, x: 1, y: 1 },
          ],
        },
      },
      slots: {
        halo: {
          rgba: [
            { time: 0, color: "ffffff00" },
            { time: 0.15, color: "ffffffc0" },
            { time: 0.65, color: "ffffff40" },
          ],
        },
      },
    },
    exit: {
      bones: {
        root: {
          translate: [
            { time: 0, x: 0, y: 0 },
            { time: 0.25, x: 0, y: 20 },
            { time: 0.6, x: 0, y: -240 },
          ],
          scale: [
            { time: 0, x: 1, y: 1 },
            { time: 0.6, x: 0.3, y: 0.3 },
          ],
        },
      },
      slots: {
        body: {
          rgba: [
            { time: 0, color: "ffffffff" },
            { time: 0.6, color: "ffffff00" },
          ],
        },
      },
    },
  };
  for (let i = 0; i < 8; i++) {
    animations.win.bones["spark" + i] = {
      translate: [
        { time: 0, x: 0, y: 0 },
        { time: 0.15, x: 70, y: 0 },
        { time: 0.65, x: 140, y: 0 },
      ],
      rotate: [
        { time: 0, value: 0 },
        { time: 0.65, value: 120 },
      ],
    };
    animations.win.slots["spark" + i] = {
      rgba: [
        { time: 0, color: "ffffff00" },
        { time: 0.1, color: "ffffffff" },
        { time: 0.65, color: "ffffff00" },
      ],
    };
  }
  return {
    skeleton: {
      spine: "4.2.00",
      x: -180,
      y: -300,
      width: 360,
      height: 520,
      fps: 60,
      images: "./",
    },
    bones,
    slots,
    skins: [{ name: "default", attachments }],
    animations,
  };
}
function art(kind) {
  const gold =
    kind === "wild-symbol"
      ? "#a37bff"
      : kind === "bonus-gem"
        ? "#66e4cf"
        : "#ffd45a";
  const body =
    kind === "bonus-gem"
      ? `<path d="M64 6 116 48 88 113 40 113 12 48Z" fill="${gold}" stroke="#ffffff" stroke-width="4"/><path d="m12 48 52 15 52-15M64 6v57l24 50M64 63l-24 50" fill="none" stroke="#ffffff" opacity=".6" stroke-width="3"/>`
      : `<circle cx="64" cy="64" r="58" fill="${gold}" stroke="#fff1b3" stroke-width="5"/><circle cx="64" cy="64" r="47" fill="none" stroke="#5b3a22" opacity=".4" stroke-width="4"/><path d="m64 23 12 25 28 4-20 20 5 28-25-14-25 14 5-28-20-20 28-4Z" fill="#fff8d0"/>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="384" height="160"><defs><radialGradient id="h"><stop stop-color="${gold}" stop-opacity=".65"/><stop offset="1" stop-color="${gold}" stop-opacity="0"/></radialGradient></defs><g transform="translate(0 16)">${body}</g><circle cx="208" cy="80" r="78" fill="url(#h)"/><path d="m320 0 6 20 20 6-20 6-6 20-6-20-20-6 20-6Z" fill="#fff4a8" transform="translate(0 54)"/></svg>`,
  );
}
export async function createDemos(root = PROJECT_DIR) {
  for (const kind of ["coin-burst", "wild-symbol", "bonus-gem"]) {
    const dir = path.join(root, "examples", "original-casino", kind);
    await fs.mkdir(dir, { recursive: true });
    await writeJson(path.join(dir, "skeleton.json"), casinoRig(kind));
    await sharp(art(kind)).png().toFile(path.join(dir, "texture.png"));
    await fs.writeFile(
      path.join(dir, "texture.atlas"),
      "texture.png\nsize:384,160\nfilter:Linear,Linear\npma:false\nbody\nbounds:0,16,128,128\nhalo\nbounds:128,0,160,160\nspark\nbounds:294,54,52,52\n",
    );
    await fs.writeFile(
      path.join(dir, "README.md"),
      `# ${kind}\n\nExemple original généré par src/create-demo.js, sans éditeur Spine. Rendu procédural simple ; référence technique, pas une promesse de qualité graphique de studio.\n\nActions : idle, anticipation, spin, win, exit. 11 os, 10 slots, halo additive et 8 éclats. Tous les morceaux sont dessinés dans le générateur.\n`,
    );
    const reception = path.join(root, "reception", "original-" + kind);
    await fs.mkdir(reception, { recursive: true });
    for (const f of ["skeleton.json", "texture.atlas", "texture.png"])
      await fs.copyFile(path.join(dir, f), path.join(reception, f));
    await buildLibrary(root, "original-" + kind);
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.join(PROJECT_DIR, "src/create-demo.js")
)
  await createDemos();
