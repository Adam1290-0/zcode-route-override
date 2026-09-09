# ZCode Route Override

> ZCode（智谱基于 Claude Code 分支的桌面客户端，Electron）的第三方补丁插件：**渠道级请求头预设改写 + per-渠道 VPN 隧道**。

[TODO: 效果图——设置页 Base URL 下方出现「请求头」「网络」两个下拉]

---

## 1. 解决什么问题

| 痛点 | 现象 | 触发场景 |
|---|---|---|
| 中转站客户端指纹检测 | `401 unauthorized client detected` | agentrouter.org 等中转站按 UA/客户端特征反查，拒绝非官方客户端 |
| 被墙中转站连不上 | connect failed / 502 | ZCode 的 Node 子进程不读 Windows 系统代理，被墙域名出不去 |
| ZCode 内置全局代理浪费流量 | 全部流量都走 VPN | 不想为国内流量也开代理 |

实测验证（2026-09-09，agentrouter.org，真 key）：

- 裸 UA：返回 `401 unauthorized client detected`
- `claude-code` 预设头集：返回 `200`，可正常对话

---

## 2. 工作原理

### 2.1 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│ ZCode 桌面客户端 (Electron)                                   │
│                                                              │
│   ┌──────────────────────────┐    ┌────────────────────────┐  │
│   │ Renderer (app.asar)      │    │ zcode.cjs (CLI 核心)    │  │
│   │                          │    │ 独立 Node 子进程        │  │
│   │  ui_route_override.js    │    │                        │  │
│   │  ├─ 注入 index.html       │    │  wrapper.js            │  │
│   │  ├─ 模型设置页插入下拉    │    │  ├─ 一行 require 注入  │  │
│   │  └─ fetch(/api/config)   │    │  ├─ patch globalThis   │  │
│   │       GET/POST 27891      │    │  │     .fetch          │  │
│   │                          │    │  ├─ 按域名匹配 routes  │  │
│   └────────┬─────────────────┘    │  ├─ 重建请求头（白名单）│  │
│            │ 同源 CSRF            │  └─ 可选 CONNECT 隧道  │  │
│            │ 127.0.0.1:27891      │                        │  │
│            ▼                      │  route-overrides.json  │  │
│   ┌──────────────────────────┐    │  ├─ match / preset /  │
│   │ wrapper.js 起的配置服务    │◄───┤  │   proxy / custom   │
│   │  GET /api/config          │    │  └─ headers           │
│   │  POST /api/config (写盘)  │    │                        │
│   │  fs.watch 热更新          │    └────────────────────────┘  │
│   └──────────────────────────┘                                 │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 关键流程

**请求拦截**——`wrapper.js` 被 `require()` 进 `zcode.cjs` 后立刻 patch `globalThis.fetch`。AI SDK 内部按惯例懒取 `globalThis.fetch.bind(...)`，patch 后所有出站请求都被接管。

**路由匹配**——按域名命中 `route-overrides.json` 里的 `routes[].match`（支持精确匹配与 `*.domain` 后缀）。未命中：完全透传，对原请求零改动。

**请求头重建**——命中后：

1. 透传关键协议头：`content-type`、`accept`、`authorization`、`x-api-key`、`anthropic-version`、`anthropic-beta`
2. 剥掉 ZCode 特征头：`x-client-language`、`x-device-mid`、ZCode 自带 UA 等
3. 注入预设身份头（`claude-code` / `codex`），再叠加 `customHeaders`
4. 按 `removeHeaders` 列表再次清理（自定义头名不区分大小写）

**VPN 隧道（可选）**——手写 `CONNECT` 隧道绕过 ZCode 的全局代理：

```
fetch → net.connect(127.0.0.1:7890)
     → 写 "CONNECT api.relay:443 HTTP/1.1"
     → 等 "HTTP/1.1 200"
     → tls.connect({ socket, servername })
     → http.request({ createConnection: () => tlsSock })
        （注意：不传 agent；传 agent:false 会让它忽略 createConnection 自行拨号）
     → 响应 Readable.toWeb → Response（保 SSE 流式）
```

**配置服务**——`wrapper.js` 在 `127.0.0.1:27891` 起 HTTP 服务，路由 `GET/POST /api/config` + `Origin` 校验 + `Host` 校验（防 CSRF 与 DNS rebind）。UI 在 renderer 内 fetch 该端口，配置改动写盘后 `fs.watch` 触发热更新，下次请求秒级生效，不用重启 ZCode。

**Fail-open 设计**——`wrapper.js` 任何异常（解析失败、隧道异常、配置加载错误）都回落原版 `fetch`；注入行本身包在 `try/catch`，`wrapper.js` 文件被误删 ZCode 也照常启动。日志只记事件，**永不记录任何 API key 或 header 值**。

---

## 3. 前置要求

| 项目 | 要求 |
|---|---|
| 操作系统 | **Windows 10/11**（脚本用 `tasklist`/`copy`/`npx.cmd`，未测过 macOS/Linux） |
| ZCode | 桌面版，默认路径 `H:\Zcode\`；其它安装位置改 bat 顶部两个 `ASAR_PATH` 变量即可 |
| Node.js | `npx` 可用即可，用于 `asar extract` / `asar pack` |
| Python 3 | 两个 `.py` 注入器需要 |
| VPN | 可选；仅当要走 VPN 出口时需要。必须是 **HTTP 代理**（如 `http://127.0.0.1:7890`），SOCKS5 不行 |

---

## 4. 安装

1. **完全关闭 ZCode**（不是最小化，托盘图标也要退出；运行中打 asar 会被还原）
2. 编辑 `patch-route-override.bat` 顶部两个路径变量（如果你的 ZCode 不在 `H:\Zcode\`）：

```bat
set "ASAR_PATH=H:\Zcode\resources\app.asar"
set "UNPACKED_PATH=H:\Zcode\resources\app.asar.unpacked"
```

3. 双击 `patch-route-override.bat`，按步骤执行（解包 + 注入 + 重打包约 2-3 分钟）
4. 看到 `[SUCCESS] Route Override patched!` 即完成
5. 重开 ZCode → 设置 → 模型设置 → 选自定义供应商 → Base URL 下方应出现「请求头」「网络」两个下拉

> 每次 ZCode 升级后补丁会失效（`app.asar` 被覆盖、`zcode.cjs` 被覆盖），**重跑同一 bat 即可**。脚本会自动判断备份是否需要刷新（按 asar 大小比对）。

**安全机制说明**：安装时 UI 注入器会在补丁目录生成随机 `auth-token` 文件，并把它嵌入 ZCode 渲染层。配置服务（`127.0.0.1:27891`）只接受携带该 token 的请求——这样即使恶意网页（包括 `file://` 页面）也无法读写你的路由配置。`auth-token` 已在 `.gitignore` 中排除，不会上传。

---

## 5. 使用

### 5.1 设置页 UI

进入「设置 - 模型设置」，在每个自定义供应商的 **Base URL 下方** 会插入两个下拉：

| 控件 | 选项 |
|---|---|
| 请求头 | `默认` / `Claude Code` / `Codex CLI` / `自定义` |
| 网络 | `直连` / `走代理` |

- 选 `走代理` 后，下方会出现代理地址输入框（默认 `http://127.0.0.1:7890`，按你的本地代理改）
- 选 `自定义` 后，出现 `Header: Value` 多行编辑框；行首写 `-Header` 表示**删除**该请求头（如 `-User-Agent`）
- 锚点用 API Key 密码框定位编辑面板（v1.1 修复：旧版用全局第一个 URL 框定位，切换供应商会串台）

### 5.2 预设说明

| 预设 | 身份 |
|---|---|
| `claude-code` | `user-agent: claude-cli/2.1.227 (external, cli)` + `x-app: cli` + `anthropic-version: 2023-06-01` + `x-stainless-*` 系列（`lang:js` / `runtime:node` / `os:Windows` / `arch:x64` / `package-version:0.70.0` / `retry-count:0` / `timeout:600` / `helper-method:stream` 等）+ `anthropic-dangerous-direct-browser-access: true` |
| `codex` | `originator: codex_cli_rs` + `user-agent: codex_cli_rs/{ver} (Windows)` + `openai-beta: responses=experimental` |

### 5.3 配置文件

UI 改动最终落到**补丁仓库目录内**（`wrapper.js` 同目录）：

```
<克隆目录>\route-overrides.json
```

> `wrapper.js` 以自身位置（`__dirname`）定位配置，因此配置文件就是补丁目录里的 `route-overrides.json`，不需要复制到别处。手动编辑此文件同样生效（`fs.watch` 热更新）。`.gitignore` 已把它排除，本地配置不会被提交。

示例（参考 `route-overrides.example.json`）：

```json
{
  "routes": [
    {
      "match": "api.example-gateway.com",
      "preset": "claude-code",
      "customHeaders": {},
      "removeHeaders": [],
      "proxy": "http://127.0.0.1:7890"
    },
    {
      "match": "another-relay.example.net",
      "preset": "codex",
      "proxy": null
    }
  ]
}
```

`proxy: null` 或省略 = 直连；命中后只改头不走隧道。

---

## 6. 卸载

### 6.1 软开关（推荐先试）

不改文件，只让所有规则失效——把 `routes` 改成空数组：

```json
{ "routes": [] }
```

UI 不会显示任何下拉。重启 ZCode 也不影响。

### 6.2 完全卸载

双击 `unpatch-route-override.bat`：还原 `app.asar.robak` 到 `app.asar`、还原 `zcode.cjs.robak` 到 `zcode.cjs`。

### 6.3 应急恢复

如果 bat 在中途失败没还原备份，可手动：

```bat
copy /Y "H:\Zcode\resources\app.asar.robak" "H:\Zcode\resources\app.asar"
copy /Y "H:\Zcode\resources\glm\zcode.cjs.robak" "H:\Zcode\resources\glm\zcode.cjs"
```

配置目录 `~/.zcode/zcode-route-override/` 卸载时不会被触碰，需要手动删。

---

## 6.5 Plan B：独立反代模式（不碰 ZCode 本体）

`standalone-proxy.py` 是**零侵入**的替代方案：不改 `zcode.cjs`、不打 `app.asar`，起一个本地反向代理完成同样的「改头 + 走代理」。

```bat
:: 默认上游 agentrouter，监听 127.0.0.1:8899
start-standalone-proxy.bat

:: 指定任意上游
start-standalone-proxy.bat https://your-relay.example.com
```

然后把 ZCode 里该供应商的 **Base URL 改成 `http://127.0.0.1:8899/v1`** 即可（Key 照填）。

| | Plan A（补丁） | Plan B（独立反代） |
|---|---|---|
| 侵入性 | 修改 zcode.cjs + app.asar | 零修改，只改供应商 Base URL |
| 进程 | 零额外进程（ZCode 进程内） | 一个本地 python 进程（手动/自启） |
| UI 设置页下拉 | 有 | 无（改 bat/env 配置） |
| ZCode 升级后 | 需重跑 patch bat | 不受影响 |
| 适用 | 日常主力 | 不想动 ZCode 本体 / 补丁失效时应急 |

环境变量：`PROXY_PORT`（默认 8899）、`PROXY_URL`（出站代理，默认 `http://127.0.0.1:12334`，置空则直连）。

---

## 7. 测试

### 7.1 单元测试

```bash
node test/test-headers.js
node test/test-config-server.js
```

`test-headers.js` 起本地 echo server，验证 `buildHeaders` 在各预设下的白名单/剥除/合并顺序；`test-config-server.js` 验证配置服务的读写、CSRF 拒绝、热更新触发。

### 7.2 集成测试

```bash
AGENTROUTER_KEY=sk-ant-... node test/test-tunnel.js
```

会真的命中 agentrouter.org 跑一次对话，验证隧道 + 预设头集真端到端可用（需要本地 VPN 代理在 `127.0.0.1:7890` 监听）。

---

## 8. FAQ

**Q：ZCode 升级后失效怎么办？**
A：`app.asar` 与 `zcode.cjs` 被覆盖，重跑 `patch-route-override.bat` 即可。脚本会按 asar 大小判断是否刷新备份。

**Q：开了 VPN 还是 `502` / `CONNECT failed` 怎么办？**
A：本地代理端口不对、或代理不是 HTTP 协议（SOCKS5 不行）。看 `wrapper.log`（在配置目录）里 `proxy CONNECT failed: ...` 一行就能定位。

**Q：选了预设还是 `401 unauthorized client`？**
A：预设选错了供应商（Anthropic 中转用 `claude-code`，OpenAI/Codex 风格中转用 `codex`），或目标域名匹配字段写错（`match` 用域名不是 URL）。

**Q：`402` 配额错误？**
A：跟补丁无关，是中转账号本身欠费/配额用完。

**Q：会影响没在 `routes` 里的渠道吗？**
A：不会。未命中 `match` 的请求 `wrapper.js` 原样放行，连请求头都不重建，零接触。

**Q：会被 ZCode 检测到吗？**
A：本插件只动本地文件（`app.asar` + `zcode.cjs`），不联网注册、不上报；ZCode 内置完整性校验是否会检查 asar 哈希不在本项目控制范围。

---

## 9. 免责声明

本项目属于第三方补丁，会解包并重打包 ZCode 的 `app.asar`，存在随官方升级失效、违反服务条款等风险。详见 [DISCLAIMER.md](./DISCLAIMER.md)。

**仅供学习研究；使用风险自负。**

---

## 10. 文件清单

```
zcode-route-override/
├─ wrapper.js                          核心 fetch patch + CONNECT 隧道 + 配置服务
├─ ui_route_override.js                设置页 UI 注入脚本（Base URL 下两个下拉）
├─ inject-zcode-wrapper.py             zcode.cjs 注入器（幂等，二进制安全，参数可传路径）
├─ inject-route-override-ui.py         asar renderer 注入器
├─ patch-route-override.bat            一键安装：zcode.cjs 注入 + asar 解包注入回打包，失败自动还原
├─ unpatch-route-override.bat          一键卸载
├─ standalone-proxy.py                 Plan B：独立反向代理（零侵入模式，见 6.5 节）
├─ start-standalone-proxy.bat          Plan B 启动脚本
├─ route-overrides.example.json        配置示例
├─ DISCLAIMER.md                       免责声明
├─ LICENSE                             许可证
└─ test/
   ├─ echo-server.js
   ├─ test-headers.js                  单测：请求头构建
   ├─ test-headers.json
   ├─ test-config-server.js            单测：配置服务
   └─ test-tunnel.js                   集成测试（需 AGENTROUTER_KEY 环境变量）
```