/**
 * Die Website für die Browser-Suite – so, wie sie ausgeliefert wird: der
 * statische Export aus `out/`, ohne Dev-Server. Ein Dev-Server kompiliert,
 * hydriert nach Laune und bricht Tests, die nichts mit dem Code zu tun haben;
 * die Produktion ist eine Handvoll Dateien hinter einem CDN. Genau das hier.
 *
 * Aufruf (aus dem Repository-Wurzelverzeichnis, nach `next build`):
 *   node cockpit/e2e/site-server.mjs          # PORT, Standard 3000
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../out/", import.meta.url)));
const port = Number(process.env.PORT ?? 3000);

const types = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

async function resolveFile(pathname) {
  // Wie ein statischer Host: /pfad/ → index.html, /pfad → pfad.html oder pfad/index.html
  // Ein kaputtes %-Escape (decodeURIComponent) darf den Prozess nicht mitreißen –
  // das wäre sonst ein einzelner falscher Request, der die ganze Testreihe stumm schaltet.
  let clean;
  try {
    clean = normalize(decodeURIComponent(pathname));
  } catch {
    return null;
  }
  let file = resolve(root, `.${clean.endsWith("/") ? `${clean}index.html` : clean}`);
  if (!file.startsWith(root)) return null;
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  } catch {
    if (!extname(file)) file += ".html";
  }
  return file;
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const file = await resolveFile(url.pathname);
    if (!file) throw new Error("outside root");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Nicht gefunden");
  }
}).listen(port, () => {
  console.log(`Website (statisch) auf http://localhost:${port}/ aus ${root}`);
});
