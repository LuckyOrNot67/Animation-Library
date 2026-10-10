import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { PROJECT_DIR } from "./lib/paths.js";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".atlas": "text/plain",
};
const port = Number(process.env.PORT || 4173);
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let base, relative;
      if (url.pathname === "/api/catalog") {
        res.setHeader("Content-Type", "application/json");
        try {
          res.end(
            await fs.readFile(
              path.join(PROJECT_DIR, "bibliotheque/catalogue.json"),
            ),
          );
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
          res.end(JSON.stringify({ machines: [], packages: [] }));
        }
        return;
      }
      if (url.pathname.startsWith("/assets/")) {
        base = path.join(PROJECT_DIR, "bibliotheque");
        relative = decodeURIComponent(url.pathname.slice(8));
      } else {
        base = path.join(PROJECT_DIR, "viewer");
        relative = decodeURIComponent(
          url.pathname === "/" ? "index.html" : url.pathname.slice(1),
        );
      }
      const target = path.resolve(base, relative);
      if (
        !target.startsWith(base + path.sep) ||
        relative.split(/[\\/]/).some((s) => s.startsWith("."))
      ) {
        res.writeHead(403);
        res.end();
        return;
      }
      const real = await fs.realpath(target);
      if (!real.startsWith(base + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const data = await fs.readFile(real);
      res.setHeader(
        "Content-Type",
        types[path.extname(real)] || "application/octet-stream",
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(data);
    } catch (e) {
      res.writeHead(e.code === "ENOENT" ? 404 : 500);
      res.end("Fichier indisponible");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Animation Library : http://127.0.0.1:${port}`),
  );
