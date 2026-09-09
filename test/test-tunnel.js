// test/test-tunnel.js — INTEGRATION TEST (needs VPN + real agentrouter key)
// Usage: AGENTROUTER_KEY=sk-xxx node test/test-tunnel.js
process.env.ZRO_CONFIG = require("path").join(__dirname, "test-tunnel.json");
require("../wrapper.js");
const key = process.env.AGENTROUTER_KEY;
if (!key) { console.error("[SKIP] set AGENTROUTER_KEY env to run this integration test"); process.exit(0); }
const UPSTREAM = process.env.TEST_UPSTREAM || "https://agentrouter.org";
(async () => {
  const r = await fetch(UPSTREAM + "/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: 16, messages: [{ role: "user", content: "hi" }] }),
  });
  const j = await r.json();
  if (r.status === 402) { console.log("[PASS] tunnel reached upstream (402 quota = account issue, link OK)"); process.exit(0); }
  if (r.status !== 200 || !j.content) throw new Error("status " + r.status + ": " + JSON.stringify(j).slice(0, 200));
  console.log("[PASS] tunnel non-stream ->", JSON.stringify(j.content[0]).slice(0, 80));
  const r2 = await fetch(UPSTREAM + "/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: 32, stream: true, messages: [{ role: "user", content: "say ok" }] }),
  });
  if (r2.status !== 200) throw new Error("stream status " + r2.status);
  const reader = r2.body.getReader();
  const { value } = await reader.read();
  const first = Buffer.from(value).toString("utf8");
  if (!/message_start|event/.test(first)) throw new Error("stream head unexpected: " + first.slice(0, 120));
  console.log("[PASS] tunnel SSE, content-type =", r2.headers.get("content-type"));
  process.exit(0);
})().catch((e) => { console.error("[FAIL]", e.message); process.exit(1); });
