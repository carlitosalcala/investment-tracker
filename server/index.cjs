const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { retrieve } = require("./market-data.cjs");
const { retrieveStock } = require("./stock-data.cjs");
const production = process.argv.includes("--production");
const port = Number(process.env.PORT || 8080);
const uiPort = Number(process.env.UI5_PORT || 8081);
const cache = new Map();
const pending = new Map();
async function marketData(isin, stock = false) {
  const key = (stock ? "stock:" : "fund:") + isin;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < 15 * 60 * 1000) return hit.data;
  if (!pending.has(key)) {
    pending.set(
      key,
      (stock ? retrieveStock(isin) : retrieve(isin))
        .then((data) => {
          cache.set(key, { time: Date.now(), data });
          return data;
        })
        .finally(() => pending.delete(key)),
    );
  }
  return pending.get(key);
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    const match = url.pathname.match(/^\/api\/prices\/([A-Z0-9]{12})$/);
    const stock = url.pathname.match(/^\/api\/stocks\/([A-Z0-9.]{1,12})$/);
    if (req.method !== "GET" || (!match && !stock)) {
      res.writeHead(404);
      return res.end(JSON.stringify({ error: "Unknown endpoint" }));
    }
    try {
      res.end(JSON.stringify(await marketData((match || stock)[1], !!stock)));
    } catch (error) {
      res.writeHead(error.status || 502);
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  if (production) {
    const root = path.resolve(__dirname, "../dist");
    let filename;
    try {
      filename = path.resolve(
        root,
        "." +
          decodeURIComponent(
            url.pathname === "/" ? "/index.html" : url.pathname,
          ),
      );
    } catch {
      res.writeHead(400);
      return res.end();
    }
    if (!filename.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    const mime = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".json": "application/json",
      ".css": "text/css",
      ".xml": "application/xml",
      ".svg": "image/svg+xml",
      ".properties": "text/plain",
      ".woff2": "font/woff2",
    };
    fs.stat(filename, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404);
        return res.end();
      }
      res.setHeader(
        "Content-Type",
        mime[path.extname(filename)] || "application/octet-stream",
      );
      // Application files keep stable URLs between deployments.
      res.setHeader("Cache-Control", "no-cache");
      fs.createReadStream(filename).pipe(res);
    });
  } else {
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: uiPort,
        path: req.url === "/" ? "/index.html" : req.url,
        method: req.method,
        headers: req.headers,
      },
      (response) => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(503);
      res.end("UI5 is starting. Please reload shortly.");
    });
    req.pipe(upstream);
  }
});
let child;
if (!production) {
  child = spawn(
    process.execPath,
    ["scripts/ui5.cjs", "serve", "--port", String(uiPort)],
    { cwd: path.resolve(__dirname, ".."), stdio: "inherit" },
  );
  child.on("exit", () => server.close());
}
server.listen(port, "0.0.0.0", () =>
  console.log(`Investment journal: http://localhost:${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    child?.kill(signal);
    server.close(() => process.exit());
  });
