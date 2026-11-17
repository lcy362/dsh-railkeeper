# Railkeeper（左栏管家）

[English](README.md) | 简体中文

接管 [DeepSeek Harness](https://www.deepseek.com/zh/harness/) 的左侧栏：**排序、改名、换图标、隐藏、分组**。改动即时生效，重启后保留。

它是已停止维护的 `dsh-panellist` 的替代品，按当前 DSH 客户端接口（`0.2.2`）重写，并且**一键导入已有的 `dsh-panellist` 配置**。

## 能做什么

| 能力 | 说明 |
|---|---|
| 排序 | 拖动手柄，或用 ↑ / ↓ 按钮（键盘可达）。 |
| 改名 | 直接输入新名字；清空即恢复插件自己的名称。 |
| 换图标 | 24 个内置线条图标；选「原始图标」恢复插件自带图标。 |
| 隐藏 | 隐藏的面板照常工作、照常可选，只是左侧栏不再画它那一行。 |
| 分组 | 把两个以上面板合成一行；点这一行会在旁边弹出成员菜单，而不是把你带走。 |
| 导入 / 导出 | 整份配置导出为 JSON，可备份、可换机器。 |
| 迁移 | 读取 `$DSH_HOME/panellist.json` 并转换成本插件结构。 |
| 存储 | 单文件 `$DSH_HOME/railkeeper.json`，按 profile 分节，权限 `0600`。 |

配置是本插件唯一自己持有的状态。它**不会**去改 profile 的 `cordis.patch.yml`；配置文件损坏时会先复制成 `.corrupt-<时间戳>` 留档，而不是直接丢掉。

改动停下约 0.5 秒后自动写盘，标题下方的状态行会显示「保存中… / 已保存 / 有改动待保存」。写入失败时改动会保留在页面上，并给出「重试」按钮。

设置页底部有一个到 [GitHub 仓库](https://github.com/lcy362/dsh-railkeeper) 的入口——觉得好用的话去点个 star，作者会很高兴；点「以后再说」就不再出现。

## 安装

```bash
dsh plugin --profile desktop add dsh-railkeeper
```

本地目录安装：**设置 → 插件 → 添加插件**。

装完打开 **设置 → 面板列表**。

## 和别的左栏插件共存

Railkeeper **不改写别人的注册条目**。它给需要改动的面板注册一条自己的「遮蔽条目」（同 id、priority 比同格其它注册者再低一档），由内核按 priority 决定谁渲染。所以：

- 只做装饰的插件（典型是插件市场的更新角标）照常工作——用户没动过的面板，railkeeper 根本不遮蔽；
- 另一个**也**管左栏顺序的插件（最常见是刚停用 `dsh-panellist` 但页面没重载）不会形成来回对写：双方各写各的条目，一次收敛；
- 卸载 railkeeper 只摘自己的条目，别人的注册原样保留。

如果 railkeeper 发现自己为某格注册的遮蔽条目被对方用更低的 priority 盖住了，设置页会如实提示，建议重载页面（⌘R）或重启应用。它**不会**去抢——抢就是对着写，那正是早期版本会卡死的原因。

一个已知取舍：插件市场只在某格「恰好一条注册」时才挂更新角标，被 railkeeper 遮蔽的格子它不会挂。这是它自己的规则，railkeeper 无法绕过；撤掉遮蔽后它会自动恢复。

## 兼容性

- DSH `>=0.2.0-rc.2 <0.3.0-0`，实测 `0.2.2-rc.3`。
- Node `^22.19.0 || >=24.0.0`（仅构建与测试需要）。

Railkeeper 刻意**不依赖**任何 Harness 客户端包（React 除外）：图标、控件、样式、设置页全部自带。这样 DSH 某次发布改掉内部导出名，也不会把本插件打成空白。

它确实用到一个内核接缝：改写注册表条目上的 `options` 不会通知订阅者，所以本插件会注册一个临时条目并立刻释放，推动侧栏重新读一遍注册表。这个技巧哪天失效，结果也只是「左栏不再跟随配置」，面板照常加载，不会崩。插件会把每轮实测结果上报到 `GET /railkeeper/api/client-status`，让这件事可查而不是玄学。

## HTTP 接口

全部挂在 `/railkeeper/api` 下，按顺序过三道准入：

1. **DSH 自己的信任栅栏** —— 每个请求先问 `ctx.connection.requestRejection(req)`。用 `webServer.register` 挂上的路由**不经过** DSH 自己的 Host/Origin 准入，所以插件必须主动问。这一层是权威判据。
2. **本地兜底** —— socket 对端必须是回环，且 `Host` 头必须是回环权威。为什么不能只比 `Origin` 与 `Host`：DNS rebinding 之后两者会一起变成攻击者的域名，比较相等反而通过；要求 `Host` 是回环才真的挡住。`sec-fetch-site: cross-site` 一律拒绝。
3. **写请求必须是 JSON** —— `POST`/`PUT` 必须声明 `application/json`。跨站表单无法不带预检就发这个头，于是简单请求类 CSRF 被挡住。浏览器半区一直是这么发的。

栅栏返回 `403` 直接拒；返回 `401`（可信但未认证）**不**拒：桌面端页面由 `dsh-app://` 加载，不是 `http://127.0.0.1`，它的 `fetch` 不一定带得上 auth cookie，一律拒会把界面掐死。`401` 交给第 2 层判，跨站形态仍被挡住。

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/health` | 存储与 profile 状态。 |
| `GET` | `/config` | 当前 profile 的配置。 |
| `PUT` | `/config` | 保存 `{ config }`；非法输入回 `400` 并说明原因。 |
| `POST` | `/config/reset` | 恢复空配置。 |
| `GET` | `/legacy` | 转换已有的 `dsh-panellist` 配置。 |
| `GET`/`POST` | `/client-status` | 浏览器半区最近的上报（内存里保留最近 50 条）。 |

## 配置结构

```jsonc
{
  "schemaVersion": 1,
  "profiles": {
    "desktop": {
      "sequence": [
        { "type": "panel", "id": "plugins" },
        { "type": "group", "id": "g_1", "label": "统计", "icon": "chart",
          "members": ["dsh-context", "personal-kit-usage"] }
      ],
      "panels": {
        "schedules": { "hidden": true },
        "personal-kit-models": { "label": "模型开关", "icon": "bolt" }
      }
    }
  }
}
```

`sequence` 只描述顺序与分组关系；`panels` 存单个面板的覆盖项。当前没注册的面板行会**保留**，所以插件卸了再装回来，那一行会回到原来的位置；设置页把它们列在「已配置但当前未安装」下面。

## 开发

```bash
node scripts/build-client.mjs   # 由 src/client/ 构建 lib/client.js
node --test "test/*.test.mjs"   # 51 项：配置、计划、宿主存储、路由、迁移
```

`src/client/*` 是普通 ES 模块。构建会把它们内联成 DSH 要求的单一浏览器产物（`window.__ModuleLoader__.load({ id, factory })`），因为运行时 `require()` 只能解析平台 seed。

改完 `src/client/*` 后重新构建，客户端 HMR 会热生效，不用重启应用；改 `src/host/*` 需要重启。改动客户端代码时顺手递增 `src/client/index.js` 里的 `CLIENT_VERSION`——它会上报到 `/client-status`，用来确认现在跑的是哪一代。

## 自检（默认关闭）

自检覆盖两条会「静默失效」的路径：

- `selectProbe` —— 调 `layout.selectPanel(成员)` 并把 `activePanelId` 读回来，然后还原。
- `clickProbe` —— 渲染分组弹出菜单，在第一个菜单项上派发一次真实的 `MouseEvent`。

**它默认不跑，因为验证方式本身有副作用**：要证明「点了能切过去」，只能真的切一次再切回来。而 `layout.selectPanel()` 会先 `abort()` 当前导航并同步通知订阅者，中间那一帧是用户看得见的——侧栏那一行（以及它所属的分组行）会闪一下选中态。曾经以为「两次变更在同一个 tick 里、React 会合并」就看不见，这个假设是错的。

需要排查「点了没反应」时，两种方式手动触发：

- 设置 → 面板列表 → **跑一次自检**（会二次确认，因为它真的会切面板）；
- 或在控制台执行 `localStorage['dsh-railkeeper.probe'] = '1'` 后重载页面，让它在启动时自动跑一次。

结果写在 `GET /railkeeper/api/client-status` 的 `selectProbe` / `clickProbe` 里。没跑时它们的值是 `{ skipped: 'probe-disabled' }`，和「跑了但失败」区分得开。

## 验证到什么程度

`test/` 覆盖配置模型、渲染计划、遮蔽条目与 SlotCore 等价注册表的比对、配置写入路径、弹出菜单的摆放计算、宿主存储、回环路由、`dsh-panellist` 迁移，以及自检开关的行为。

DOM 相关的路径**没有**单元测试：改写轨道行、隐藏、分组弹出菜单都需要真实浏览器。它们是在真实应用里、每轮重建后读真实 DOM 验证的——行数、实际画出的行数、每行标签、隐藏标记数、分组行标记数都会上报到 `/client-status`，并与计划逐项对照。本插件注入的每一条样式选择器都被限定在轨道 `nav`（`[data-rk-rail]`）或它自己的 `.rk-*` 类名下，因此不可能改到别的页面。

## 许可

MIT
