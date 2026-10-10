const $ = (id) => document.getElementById(id);
let catalog = { machines: [], packages: [] };
const asset = (p, file) =>
  "/assets/" +
  (p.path + "/" + file).split("/").map(encodeURIComponent).join("/");
function page(which) {
  $("guide").classList.toggle("hidden", which !== "guide");
  $("library").classList.toggle("hidden", which !== "library");
}
$("home").onclick = () => page("guide");
$("gallery").onclick = () => page("library");
function render() {
  const q = $("search").value.toLowerCase(),
    m = $("machine").value;
  const list = catalog.packages.filter(
    (p) =>
      (!m || p.path.split("/")[0] === m) &&
      JSON.stringify([p.name, p.machine, p.animations])
        .toLowerCase()
        .includes(q),
  );
  $("count").textContent =
    `${list.length} package(s) · ${catalog.machines.length} machine(s)`;
  $("cards").replaceChildren();
  if (!list.length) {
    $("cards").textContent =
      "Aucun package trouvé. Dépose tes captures dans reception/Nom de machine/, puis lance npm run build.";
    return;
  }
  for (const p of list) {
    const b = document.createElement("button");
    b.className = "card";
    const name = document.createElement("strong");
    name.textContent = p.name;
    const small = document.createElement("small");
    small.textContent = `${p.machine} · ${p.animations.length} action(s) · ${p.complete ? "Complet" : "À vérifier"}`;
    b.append(name, small);
    b.onclick = () => show(p);
    $("cards").append(b);
  }
}
function show(p) {
  $("detail").classList.remove("hidden");
  $("title").textContent = `${p.machine} / ${p.name}`;
  $("status").textContent =
    p.warnings.join(" · ") ||
    `Spine ${p.version || "version inconnue"} · ${p.pieces.length} pièces`;
  $("status").className = p.warnings.length ? "warning" : "";
  const playable = ["spine-json", "spine-skel"].includes(p.format);
  $("player").classList.toggle(
    "hidden",
    !playable && p.format !== "spritesheet",
  );
  $("player").src = playable
    ? "/play.html#" +
      encodeURIComponent(
        JSON.stringify({
          id: p.id,
          skeleton: asset(p, p.skeleton),
          atlas: p.previewAtlas ? asset(p, p.previewAtlas) : null,
          pma: p.pma,
          version: p.version,
          format: p.format === "spine-skel" ? "binary" : "json",
          animations: p.animations.map((a) => a.name),
          skins: p.skins,
        }),
      )
    : p.format === "spritesheet"
      ? "/spritesheet.html#" +
        encodeURIComponent(
          JSON.stringify({
            sheet: asset(p, p.skeleton),
            assets:
              "/assets/" + p.path.split("/").map(encodeURIComponent).join("/"),
            pieces: p.pieces,
          }),
        )
      : "about:blank";
  $("pieces").replaceChildren();
  for (const piece of p.pieces.length
    ? p.pieces
    : p.textures.map((file) => ({ file, region: file }))) {
    const f = document.createElement("figure"),
      img = document.createElement("img"),
      caption = document.createElement("figcaption");
    img.src = asset(p, piece.file);
    img.alt = piece.region;
    img.loading = "lazy";
    caption.textContent = piece.region;
    f.append(img, caption);
    $("pieces").append(f);
  }
  $("links").replaceChildren();
  for (const file of [
    ...new Set([
      p.skeleton,
      ...p.atlases,
      ...p.textures,
      "metadata.json",
      ...p.files.map((f) => f.file),
    ]),
  ]) {
    const a = document.createElement("a");
    a.href = asset(p, file);
    a.textContent = file;
    a.target = "_blank";
    a.rel = "noopener";
    const row = document.createElement("div");
    row.append(a);
    $("links").append(row);
  }
  const actions = document.createElement("p");
  actions.textContent =
    "Actions : " +
    (p.animations
      .map(
        (a) =>
          `${a.name}${a.duration !== undefined ? " (" + a.duration + " s)" : ""}`,
      )
      .join(", ") ||
      "liste disponible uniquement dans le runtime pour les skeletons binaires");
  $("links").prepend(actions);
  $("metadata").textContent = JSON.stringify(p, null, 2);
  $("detail").scrollIntoView({ behavior: "smooth" });
}
async function load() {
  try {
    const r = await fetch("/api/catalog");
    if (!r.ok) throw new Error("Catalogue indisponible");
    catalog = await r.json();
    $("machine").replaceChildren(
      new Option("Toutes les machines", ""),
      ...catalog.machines.map((m) => new Option(m.name, m.id)),
    );
    render();
  } catch (e) {
    $("count").textContent = e.message;
  }
}
$("machine").onchange = render;
$("search").oninput = render;
$("reload").onclick = load;
load();
