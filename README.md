# ZCode Route Override / ZCode 渠道请求头与通道管理

> 🔗 **广告**：[sharellm.net](https://sharellm.net/sign-up?aff=wb5b) — AI 模型共享平台，海量模型一键体验（注册邀请链接）

[English](#english) · [中文](#中文)

![Version](https://img.shields.io/badge/version-1.0.3-blue) ![License](https://img.shields.io/badge/license-MIT-green)

给 [ZCode](https://zcode.z.ai) 桌面端加上「渠道级请求头预设 + per-渠道 VPN 隧道」：每个自定义模型供应商（中转站）可单独设置请求头伪装（Claude Code / Codex / 自定义）与是否走本地 VPN 代理出站，全部内置在 ZCode 进程内——零额外进程、零手动操作、打开 VPN 即自动生效。模型设置页 Base URL 下方两个下拉直接配置。

Give the [ZCode](https://zcode.z.ai) desktop app per-provider request-header presets and an optional per-provider VPN tunnel: each custom relay provider gets its own header identity (Claude Code / Codex / custom) and its own "direct vs via-VPN" network mode, all built into ZCode's own process — no extra processes, no manual steps, works the moment your VPN is up. Configured via two dropdowns below the Base URL field in the model-settings page.

---

## 📌 版本对应表 / Version Matrix

**打补丁前请先核对你的 ZCode 版本！**

| 补丁版本 | 适配 ZCode 版本 | 状态 | 主要变化 |
|---|---|---|---|
| **v1.0.3（最新）** | **3.11.2 / 3.12.2 / 3.12.3** | ✅ 当前维护版本 | 🐛 修复编辑面板定位（非密码框供应商、初始加载竞态）+ 事件驱动刷新 |
| v1.0.2 | 3.11.2 | ✅ | 🐛 修复渠道设置丢失（upsert 保存机制） |
| v1.0.1 | 3.11.2 | ✅ | 🆕 OpenSquilla 预设 + 非 ASCII 头值防护 + UI 锚点回退 + 发布物脱敏 |
| v1.0.0 | 3.11.2 | ✅ | 首个版本：渠道级请求头预设（Claude Code / Codex / 自定义）+ per-渠道 VPN 隧道（CONNECT）+ 设置页下拉 UI + 配置服务 token 鉴权 |

> ⚠️ 本项目是**社区第三方补丁**，通过向 ZCode 的 CLI 核心（`zcode.cjs`）注入一行 require 并修改 `app.asar`（渲染层注入）实现，**与 ZCode 官方无关**。使用前请阅读 [DISCLAIMER.md](DISCLAIMER.md)。
>
> ⚠️ This is a **community third-party patch**. It works by injecting one `require` line into ZCode's CLI core (`zcode.cjs`) and modifying `app.asar` (renderer injection), and is **not affiliated with ZCode**. Read [DISCLAIMER.md](DISCLAIMER.md) before use.
>
> **ZCode 是闭源应用且更新频繁**——每次官方更新都可能让补丁失效。若你的 ZCode 版本不在上表中，请勿直接打补丁；可以提 Issue 告知你的版本号，我会评估适配。

---

<a name="english"></a>
## English

### Features

- 🎭 **Per-provider header presets**: default / Claude Code / Codex CLI / OpenSquilla / custom — two dropdowns (请求头 / 网络) below the Base URL field in the model-settings page
- ✍️ **Custom headers**: multi-line `Header: Value` (prefix `-` to remove a header); the whitelist rebuild strips ZCode's own identity headers (`x-client-language`, `x-device-mid`, …) so relays can't fingerprint you
- 🌐 **Per-provider VPN tunnel**: only providers you mark go through the proxy (reverse whitelist) — everything else stays direct, zero wasted VPN traffic
- ⚙️ **Zero extra processes**: the wrapper lives inside ZCode's CLI core (one-line try/catch `require` in `zcode.cjs`); the CONNECT tunnel is Node-stdlib only and dies with ZCode
- 🔄 **Hot reload**: config written by the UI takes effect within a second (`fs.watch`), no restart
- 🔐 **Local config service** on `127.0.0.1:27891` with a per-install auth token (embedded into the patched renderer) — random webpages, even `file://`, can't read or rewrite your routes
- 🛡️ **Fail-open**: any wrapper error falls back to the original request; the injected line is try/catch-wrapped, so a broken wrapper file never breaks ZCode
- 🅱️ **Plan B**: `standalone-proxy.py` — a zero-invasion reverse-proxy mode (no ZCode patching at all), handy when you don't want to touch the app or as an emergency fallback after an update

### Install

**Prerequisites**: Windows 10/11, Python 3, Node.js (`npx`).

1. **Fully quit ZCode** (right-click the tray icon → Quit, not just closing the window)
2. Edit `patch-route-override.bat` — set `ASAR_PATH` to your ZCode install path (`...\resources\app.asar`)
3. Double-click `patch-route-override.bat`, wait for `[SUCCESS]`
4. Reopen ZCode → Settings → Model Settings → select a custom provider → the 请求头 / 网络 dropdowns appear below Base URL

### Uninstall

1. Quit ZCode
2. Double-click `unpatch-route-override.bat`
3. Restores `zcode.cjs.robak` + `app.asar.robak` (created automatically on first patch) — removes this patch only, keeps other injections (e.g. zcode-skin-manager)

### Coexistence with other patches

`patch-route-override.bat` extracts from the **current** `app.asar` (not an old backup) and re-injects idempotently, so it preserves other patches such as [zcode-skin-manager](https://github.com/Adam1290-0/zcode-skin-manager), [zcode-account-switcher](https://github.com/Adam1290-0/zcode-account-switcher) and [zcode-pin](https://github.com/Adam1290-0/zcode-pin) — and vice versa. Any order, any number of runs.

### Usage

| What you want | How |
|---|---|
| Make a relay accept this client | Select its provider → 请求头 dropdown → **Claude Code** (or Codex CLI for OpenAI-style relays) |
| Send a relay through your VPN | Select its provider → 网络 dropdown → **走代理（VPN）** |
| Set fully custom headers | 请求头 → **自定义…** → enter `Header: Value` per line; prefix `-` to delete a header |
| Turn everything off (soft switch) | Edit `route-overrides.json` next to the wrapper → set `"routes": []` |
| Plan B without patching ZCode | Run `start-standalone-proxy.bat <upstream-url>` and point the provider's Base URL at `http://127.0.0.1:8899/v1` |

### Files

```
├── patch-route-override.bat         # one-click patch (extract → inject → repack, auto-restore on failure)
├── unpatch-route-override.bat       # one-click restore (this patch only)
├── inject-zcode-wrapper.py          # zcode.cjs injector (idempotent, binary-safe, args for custom paths)
├── inject-route-override-ui.py      # asar renderer injector (also creates the auth token)
├── wrapper.js                       # core: fetch patch + header rebuild + CONNECT tunnel + config server
├── ui_route_override.js             # renderer UI injected into ZCode (dropdowns under Base URL)
├── standalone-proxy.py              # Plan B: zero-invasion reverse proxy (no patching)
├── start-standalone-proxy.bat       # Plan B launcher
├── route-overrides.example.json     # route config example
└── test/                            # unit tests (headers rebuild, config server auth/CSRF) + integration test
```

### FAQ

**Q: The dropdowns disappear after ZCode auto-updates?**
A: Updates overwrite `app.asar` and `zcode.cjs`. Re-run `patch-route-override.bat` (each new ZCode version gets a fresh backup automatically). If ZCode jumped several versions, check the [Version Matrix](#-版本对应表--version-matrix) first.

**Q: Still getting `401 unauthorized client detected`?**
A: That relay fingerprints clients. Make sure its 请求头 preset is **Claude Code** (verified: bare UA → 401, claude-code preset → 200) and 网络 is **走代理** if the relay is geo-blocked.

**Q: `402 Budget pool quota has been exhausted`?**
A: Your account's quota at the relay, not a tool issue — top up / switch pool in their console. A 402 means the full chain (headers + tunnel) already works.

**Q: Will my other providers be affected?**
A: No. Matching is a reverse whitelist — providers not named in `route-overrides.json` pass through untouched, direct connection, no VPN.

**Q: VPN is off — what happens?**
A: Only providers marked 走代理 fail (CONNECT refused); all direct providers keep working.

**Q: Where is the config stored?**
A: `route-overrides.json` next to `wrapper.js` (the patch directory). UI changes write it instantly; editing it manually also works (hot-reloaded). It's gitignored so local routes are never committed.

### How it works

ZCode's CLI core (`zcode.cjs`) is a standalone Node process — the AI SDK resolves `globalThis.fetch` lazily, so patching that one function intercepts every upstream request. This tool injects a single try/catch `require` line at the top of `zcode.cjs`:

1. **Match** — every `fetch` is matched by hostname against `route-overrides.json`; non-matching requests pass through unchanged.
2. **Rewrite** — matching requests get their headers rebuilt from a whitelist (auth + protocol headers kept, ZCode fingerprint headers dropped), then the chosen preset (claude-code / codex) or custom headers are applied.
3. **Tunnel (optional)** — if the route sets `proxy`, the request goes out through a hand-rolled CONNECT tunnel (`net.connect` → `CONNECT` → `tls.connect` → `http.request` over the established TLS socket), preserving SSE streaming via `Readable.toWeb`.
4. **Config service** — `wrapper.js` also serves `127.0.0.1:27891` (GET/POST `/api/config`) with a per-install auth token plus Origin/Host guards; `fs.watch` hot-reloads changes within a second.
5. **UI** — the renderer script locates the provider edit panel by its visible Base URL input (preferring the active/focused panel), so switching providers rebuilds the controls for the right host — no cross-writing.

---

<a name="中文"></a>
## 中文

### 功能

- 🎭 **渠道级请求头预设**：默认 / Claude Code / Codex CLI / OpenSquilla / 自定义——模型设置页 Base URL 下方「请求头」「网络」两个下拉，每个供应商独立配置
- ✍️ **自定义请求头**：多行 `Header: Value`（行首 `-` 表示删除该头）；白名单重建会剥掉 ZCode 的特征头（`x-client-language`、`x-device-mid` 等），中转站无法指纹识别
- 🌐 **per-渠道 VPN 隧道**：只有你点名的渠道走代理（反向白名单）——其他渠道原样直连，一分 VPN 流量都不浪费
- ⚙️ **零额外进程**：wrapper 活在 ZCode 的 CLI 核心进程里（`zcode.cjs` 头部一行 try/catch require），CONNECT 隧道纯 Node 标准库实现，随 ZCode 生灭
- 🔄 **热更新**：UI 改配置秒级生效（`fs.watch`），不用重启
- 🔐 **本地配置服务**：`127.0.0.1:27891`，带安装时生成的随机 token（嵌入渲染层）——恶意网页（包括 `file://`）无法读写你的路由配置
- 🛡️ **fail-open**：wrapper 任何异常回落原版请求；注入行 try/catch 包裹，wrapper 文件坏了 ZCode 也照常启动
- 🅱️ **Plan B**：`standalone-proxy.py` 零侵入反代模式（完全不打补丁），不想动 ZCode 本体或补丁失效时的应急方案

### 安装

**前置条件**：Windows 10/11、Python 3、Node.js（`npx`）。

1. **完全退出 ZCode**（右键系统托盘图标 → 退出，不是关窗口）
2. 编辑 `patch-route-override.bat`，把 `ASAR_PATH` 改成你的 ZCode 安装路径（`...\resources\app.asar`）
3. 双击 `patch-route-override.bat`，等待出现 `[SUCCESS]`
4. 重新打开 ZCode → 设置 → 模型设置 → 选一个自定义供应商 → Base URL 下方出现「请求头」「网络」两个下拉

> 💡 **与其他注入补丁共存**：patch 从**当前** app.asar 解包（不是老备份），注入幂等——重打本补丁自动替换旧注入、保留其他补丁（如 [zcode-skin-manager](https://github.com/Adam1290-0/zcode-skin-manager)、[zcode-account-switcher](https://github.com/Adam1290-0/zcode-account-switcher)、[zcode-pin](https://github.com/Adam1290-0/zcode-pin)）的修改，任意顺序反复打互不覆盖。

### 卸载

1. 退出 ZCode
2. 双击 `unpatch-route-override.bat`
3. 恢复 `zcode.cjs.robak` + `app.asar.robak`（首次打补丁时自动备份）——只移除本补丁，保留其他注入补丁

### 使用说明

| 你想做什么 | 怎么做 |
|---|---|
| 让中转站接受这个客户端 | 选中该供应商 → 「请求头」下拉 → **Claude Code**（OpenAI 风格中转站选 Codex CLI） |
| 让某渠道走你的 VPN | 选中该供应商 → 「网络」下拉 → **走代理（VPN）** |
| 设置完全自定义的头 | 「请求头」→ **自定义…** → 每行一条 `Header: Value`；行首 `-` 删除某头 |
| 一键停用全部规则（软开关） | 编辑 `route-overrides.json`（wrapper 同目录）→ `"routes": []` |
| 不打补丁的 Plan B | 运行 `start-standalone-proxy.bat`，把该供应商 Base URL 改成 `http://127.0.0.1:8899/v1` |

### 文件说明

```
├── patch-route-override.bat         # 一键打补丁（解包 → 注入 → 重打包，失败自动还原）
├── unpatch-route-override.bat       # 一键还原（仅本补丁）
├── inject-zcode-wrapper.py          # zcode.cjs 注入器（幂等、二进制安全、路径可传参）
├── inject-route-override-ui.py      # asar 渲染层注入器（同时生成 auth token）
├── wrapper.js                       # 核心：fetch patch + 头重建 + CONNECT 隧道 + 配置服务
├── ui_route_override.js             # 注入 ZCode 渲染层的 UI（Base URL 下两个下拉）
├── standalone-proxy.py              # Plan B：零侵入独立反代（不打补丁）
├── start-standalone-proxy.bat       # Plan B 启动脚本
├── route-overrides.example.json     # 路由配置示例
└── test/                            # 单测（头重建、配置服务鉴权/CSRF）+ 集成测试
```

### 常见问题

**Q：ZCode 自动更新后下拉没了？**
A：更新会覆盖 `app.asar` 和 `zcode.cjs`，重新双击 `patch-route-override.bat` 即可（每个新版本会自动刷新备份）。若跨了多个版本，先对照上方[版本对应表](#-版本对应表--version-matrix)确认。

**Q：还是报 `401 unauthorized client detected`？**
A：该中转站做客户端指纹检测。确认它的「请求头」预设是 **Claude Code**（实测：裸 UA → 401，claude-code 预设 → 200），若该站被墙还需把「网络」设为**走代理**。

**Q：报 `402 Budget pool quota has been exhausted`？**
A：这是你账号在目标中转站的配额问题，不是工具问题——去他们控制台充值/换池即可。能收到 402 说明改头+隧道全链路已经通了。

**Q：其他供应商会受影响吗？**
A：不会。匹配是反向白名单——`route-overrides.json` 里没点名的供应商原样直连、零接触、不走 VPN。

**Q：VPN 没开会怎样？**
A：只有标记了「走代理」的渠道连不上（CONNECT 被拒），其他直连渠道完全不受影响。

**Q：配置存在哪？**
A：`wrapper.js` 同目录的 `route-overrides.json`。UI 改动即时写入；手动编辑同样生效（热更新）。它已在 `.gitignore` 中，本地路由配置不会被提交。

### 原理

ZCode 的 CLI 核心（`zcode.cjs`）是独立 Node 子进程，AI SDK 对 `globalThis.fetch` 是懒取值——patch 这一个函数就能拦截所有上游请求。本工具在 `zcode.cjs` 头部注入一行 try/catch require：

1. **匹配**：每个 fetch 按域名匹配 `route-overrides.json`；未命中原样放行。
2. **重写**：命中请求按白名单重建头（保留认证/协议头，剥掉 ZCode 特征头），再叠加所选预设（claude-code / codex）或自定义头。
3. **隧道（可选）**：路由带 `proxy` 时经手写 CONNECT 隧道出站（`net.connect` → `CONNECT` → `tls.connect` → `http.request` 复用已建立的 TLS socket），`Readable.toWeb` 保证 SSE 流式完整。
4. **配置服务**：`wrapper.js` 同时提供 `127.0.0.1:27891`（GET/POST `/api/config`），带安装时生成的随机 token + Origin/Host 双重校验；`fs.watch` 秒级热更新。
5. **UI**：渲染层脚本按可见的 Base URL 输入定位编辑面板（优先当前活跃/聚焦的面板），切换供应商时按当前面板的域名重建控件——不会写串渠道。

### 更新日志 / Changelog

### v1.0.3

- 🐛 修复编辑面板定位：API key 非密码框的供应商（openai / openai-compatible）此前可能抓取其他供应商的密码框，导致请求头下拉错误显示「默认」——现在按可见的 Base URL 输入定位，并优先当前活跃/聚焦的面板
- 🐛 修复初始加载竞态：`/api/config` 首次返回前不再渲染空状态下拉（杜绝启动瞬间的「默认」闪现）
- ⚡ 供应商切换改为事件驱动刷新（MutationObserver 即时响应），轮询降为 3 秒兜底
- ✅ 验证适配 ZCode 3.12.2 / 3.12.3（`zcode.cjs` 注入锚点与 UI 标记全部保留，仅重打补丁，无需代码改动）

### v1.0.2

- 🐛 修复渠道设置随机丢失：保存机制改为服务器端合并（upsert），UI 只提交当前渠道，磁盘真值合并，杜绝「改 A 丢 B」

### v1.0.1

- 🆕 新增 OpenSquilla 请求头预设（归因头 + X-OpenSquilla-* 关联头套件，面向 OpenSquilla 生态平台）
- 🐛 UI 面板定位回退锚点：API Key 非密码输入框的供应商也能正常显示下拉

### v1.0.0

- 🎭 首个版本：渠道级请求头预设（默认 / Claude Code / Codex CLI / 自定义）+ per-渠道 VPN 隧道（手写 CONNECT，SSE 流式无损）
- 🛡️ 安全设计：配置服务 token 鉴权（安装时生成并嵌入渲染层）+ Origin/Host 防护；fail-open + 注入行 try/catch 包裹；日志永不记录密钥
- 🅱️ Plan B 零侵入反代模式（`standalone-proxy.py`，不打补丁，只改供应商 Base URL）
- ✅ 验证适配 ZCode 3.11.2

## License

[MIT](LICENSE)
