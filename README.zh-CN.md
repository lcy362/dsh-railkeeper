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

## 安装

```bash
dsh plugin --profile desktop add dsh-railkeeper
```

本地目录安装：**设置 → 插件 → 添加插件**。

装完打开 **设置 → 面板列表**。

## 重要：不要同时运行两个左栏管理插件

Railkeeper 改写的是侧栏读取的 `sidebar.panellist` 注册表。任何做同样事情的插件都会和它打架——两边会互相覆盖，形成来回对写。

最容易踩到的场景：**刚停用 `dsh-panellist` 但没有重新加载页面**，它的浏览器半区还在内存里跑，还在改同一批条目。Railkeeper 会检测到这一点，暂停改写顺序与名称，并给出提示让你重新加载页面（或重启应用）。「隐藏」标记仍然生效，不会丢东西。

重新加载一次页面，railkeeper 就会独占左栏。

## 兼容性

- DSH `>=0.2.0-rc.2 <0.3.0-0`，实测 `0.2.2-rc.3`。
- Node `^22.19.0 || >=24.0.0`（仅构建与测试需要）。

Railkeeper 刻意**不依赖**任何 Harness 客户端包（React 除外）：图标、控件、样式、设置页全部自带。这样 DSH 某次发布改掉内部导出名，也不会把本插件打成空白。

它确实用到一个内核接缝：改写注册表条目上的 `options` 不会通知订阅者，所以本插件会注册一个临时条目并立刻释放，推动侧栏重新读一遍注册表。这个技巧哪天失效，结果也只是「左栏不再跟随配置」，面板照常加载，不会崩。插件会把每轮实测结果上报到 `GET /railkeeper/api/client-status`，让这件事可查而不是玄学。

## HTTP 接口

全部挂在 `/railkeeper/api` 下，只允许回环访问，并额外校验 `Host`；写请求还要求同源（完全没有 `Origin` 的情况放行，那是桌面版的 IPC 桥）。

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

## 自检

页面加载后不久,本插件会跑一次**隐形**自检(它打开的菜单不绘制、不抢焦点),专门覆盖两条会“静默失效”的路径:

- `selectProbe` —— 直接调 `layout.selectPanel(成员)` 并把 `activePanelId` 读回来,然后还原原来的选中项。
- `clickProbe` —— 渲染分组弹出菜单,在第一个菜单项上派发一次真实的 `MouseEvent`,记录处理函数有没有执行、选中项最后落在哪。

两个结果、注册表现状、以及真实 DOM 的测量值都在 `GET /railkeeper/api/client-status` 里。外壳的槽位或布局行为一旦变化,这里会直接暴露,而不是表现为“点了没反应”。

## 验证到什么程度

`test/` 覆盖配置模型、渲染计划、弹出菜单的摆放计算、宿主存储、回环路由，以及 `dsh-panellist` 迁移。

DOM 相关的路径**没有**单元测试：改写轨道行、隐藏、分组弹出菜单都需要真实浏览器。它们是在真实应用里、每轮重建后读真实 DOM 验证的——行数、实际画出的行数、每行标签、隐藏标记数、分组行标记数都会上报到 `/client-status`，并与计划逐项对照。本插件注入的每一条样式选择器都被限定在轨道 `nav`（`[data-rk-rail]`）或它自己的 `.rk-*` 类名下，因此不可能改到别的页面。

## 许可

MIT
