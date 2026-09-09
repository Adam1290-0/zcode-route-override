// test/test-headers.js — 断言：命中路由的请求头被白名单重建+注入预设；未命中原样透传
process.env.ZRO_CONFIG = require("path").join(__dirname, "test-headers.json");
require("../wrapper.js");
const assert = require("assert");
(async () => {
  // 命中：127.0.0.1 在 test-headers.json 路由里（preset claude-code，无 proxy）
  const r = await fetch("http://127.0.0.1:18899/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": "test-key",
      "x-client-language": "zh-CN",
      "x-device-mid": "abc",
      "user-agent": "zcode/1.0",
    },
    body: JSON.stringify({ hi: 1 }),
  });
  const j = await r.json();
  const h = j.headers;
  assert.strictEqual(h["user-agent"], "claude-cli/2.1.227 (external, cli)", "UA 应被预设覆盖");
  assert.strictEqual(h["x-api-key"], "test-key", "认证头必须保留");
  assert.strictEqual(h["content-type"], "application/json");
  assert.strictEqual(h["x-client-language"], undefined, "ZCode 特征头必须被剥掉");
  assert.strictEqual(h["x-device-mid"], undefined);
  assert.strictEqual(h["x-app"], "cli");
  // 未命中：localhost 不在路由 → 原样透传（UA 保留 zcode-test）
  const r2 = await fetch("http://localhost:18899/passthrough", {
    headers: { "user-agent": "zcode-test", "x-client-language": "zh" },
  });
  const j2 = await r2.json();
  assert.strictEqual(j2.headers["user-agent"], "zcode-test", "未命中必须零改动");
  assert.strictEqual(j2.headers["x-client-language"], "zh");
  console.log("[PASS] header rebuild + passthrough");
  process.exit(0);
})().catch((e) => { console.error("[FAIL]", e.message); process.exit(1); });
