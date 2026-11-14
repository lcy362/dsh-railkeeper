# 收录与发布

本仓库发布的产物有两个去处，都需要**固定的资产名**与**指向本仓库的 `repository`**。

## npm

```sh
npm publish   # 需要已登录，且 token 允许免 2FA 发布（否则会要 OTP）
```

目录（`dshmarket` 读的那份）会**自己**发现 npm 包：它的 `probe-npm.mjs` 读本仓库
`package.json` 的 `name`，再去 registry 核对，**并要求该 npm 包的 `repository` 指回
`lcy362/dsh-railkeeper`**（防抢名）。少这一条，会一直判成「没有 npm 包」——既没有
下载量，安装命令也不会优先给 npm 包名。

为什么在意 npm：`dshmarket` 默认按「npm 下载量（近 30 天）」倒序排，比较函数只认
`downloads` 字段；那份目录里也没有 `githubReleaseDownloads` 可以兜底。没有 npm 数
就等于卡片无数字 + 默认排序沉底。

## GitHub Release

```sh
bash scripts/release.sh
```

资产名固定为 `dsh-railkeeper.tgz`。**不能带版本号**：目录里的 `tarball` 指向
`releases/latest/download/`，带版本号的名字在下次发版后就会 404，而目录的
`probe-tarballs.mjs` 实测 404 之后会**静默丢掉**这个字段。

## 投给 awesome-dsh-plugin

`market/awesome-dsh-plugin.yml` 就是条目内容，提交到该仓库的
`data/plugins/lcy362__dsh-railkeeper.yml`。

**一条硬门槛：仓库创建满 1 天。** `check-submission.mjs` 里 `MIN_AGE_DAYS = 1`，
由 CI 自动检查；仓库太新会被 gate 拦下（重新提交不会有任何负面影响，但没必要白跑）。

其余门槛：仓库里某处 `package.json` 声明 `dsh.bundle`（本仓库有）、仓库未归档、
不是 DSH 本身、打了 `dsh-plugin` topic（已打）、描述与代码相符。

## 两份副本的注意点

插件目前在两个地方各有一份：本仓库（对外、发布用），以及
`dsh-ops/plugins/dsh-railkeeper`（desktop profile 里 `link:` 指向它，正在被 DSH 使用）。
改代码时**先改本仓库**，再同步过去，否则两边会漂移。
