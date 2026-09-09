// test/test-config-server.js
process.env.ZRO_PORT = "27899";
process.env.ZRO_CONFIG = require("path").join(__dirname, "test-config.json");
process.env.ZRO_TOKEN_FILE = require("path").join(__dirname, "test-token");
require("fs").copyFileSync(require("path").join(__dirname, "test-headers.json"), process.env.ZRO_CONFIG);
require("fs").rmSync(require("path").join(__dirname, "test-token"), { force: true }); // fresh token each run
// production: the UI injector creates the token at install time; the test
// mimics that here (wrapper only reads, never writes)
require("fs").writeFileSync(process.env.ZRO_TOKEN_FILE, require("crypto").randomBytes(32).toString("hex"));
require("../wrapper.js");
const assert = require("assert");
const TOKEN = require("fs").readFileSync(require("path").join(__dirname, "test-token"), "utf8").trim();
(async () => {
  // no token -> 401
  const anon = await fetch("http://127.0.0.1:27899/api/config");
  assert.strictEqual(anon.status, 401, "anonymous request must be rejected");
  // wrong token -> 401
  const bad = await fetch("http://127.0.0.1:27899/api/config", { headers: { "x-zro-token": "nope" } });
  assert.strictEqual(bad.status, 401);
  // right token -> 200
  const g = await fetch("http://127.0.0.1:27899/api/config", { headers: { "x-zro-token": TOKEN } });
  assert.strictEqual(g.status, 200);
  assert.ok(Array.isArray((await g.json()).routes));
  // POST with token -> ok, disk updated
  const p = await fetch("http://127.0.0.1:27899/api/config", {
    method: "POST",
    headers: { "content-type": "application/json", "x-zro-token": TOKEN },
    body: JSON.stringify({ routes: [
      { match: "a.example.com", preset: "claude-code", proxy: null },
      { match: "b.example.com", preset: "codex", proxy: "http://127.0.0.1:12334" },
    ]}),
  });
  assert.strictEqual(p.status, 200);
  const pj = await p.json();
  assert.ok(pj.ok && pj.routes === 2, "post resp: " + JSON.stringify(pj));
  const disk = JSON.parse(require("fs").readFileSync(process.env.ZRO_CONFIG, "utf8"));
  assert.strictEqual(disk.routes.length, 2);
  // right token but evil origin -> 403 (defense in depth)
  const evil = await fetch("http://127.0.0.1:27899/api/config", {
    method: "POST",
    headers: { "content-type": "application/json", "x-zro-token": TOKEN, "origin": "https://evil.com" },
    body: JSON.stringify({ routes: [] }),
  });
  assert.strictEqual(evil.status, 403);
  console.log("[PASS] config server auth(token)/GET/POST/CSRF-guard");
  process.exit(0);
})().catch((e) => { console.error("[FAIL]", e.message); process.exit(1); });
