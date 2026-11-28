# ZTV 部署与发布指南（v2.5.0）

## 1. 仓库与分支

- 仓库：`https://github.com/zqryv/ZTV`，主分支 `main`。
- 应用内「检查更新」读取 `constants/UpdateConfig.ts` 的 `GITHUB_OWNER` / `GITHUB_REPO`（当前为 `zqryv/ZTV`），优先请求 GitHub Releases API，失败时并发竞速回退 raw / jsDelivr 镜像。
- 提交 `main` 且 `package.json` 变更时，`.github/workflows/auto-tag.yml` 自动创建 `v{version}` 标签。该标签由 `GITHUB_TOKEN` 创建，不会级联触发发版工作流，因此需要用有 `repo` 权限的 PAT 手动 `workflow_dispatch` 触发 `release.yml`。

## 2. 发布流程

```bash
cd ZTV
git add -A && git commit -m "feat: v2.5.0 大屏适配"
git push origin main

# 手动触发全平台 Release（auto-tag 已自动建好 tag）
curl -X POST \
  -H "Authorization: Bearer <PAT>" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/zqryv/ZTV/actions/workflows/release.yml/dispatches \
  -d '{"ref":"main"}'
```

在 **Actions** 页查看 `ZTV Release (all platforms)`；全部 job 成功后，**Releases** 页自动发布 `v2.5.0`。

## 3. Release 产物（7 个）

| 平台 | 资源文件 |
| --- | --- |
| Android TV | `ZTV-v2.5.0-android-tv.apk` |
| Android 手机/平板 / 鸿蒙 4.x | `ZTV-v2.5.0-android.apk` |
| 鸿蒙 NEXT（离线 PWA） | `ZTV-v2.5.0-harmony-web.zip` |
| Windows | `ZTV-v2.5.0-windows-setup.exe` |
| Ubuntu | `ZTV-v2.5.0-linux-amd64.deb` |
| macOS | `ZTV-v2.5.0-macos-universal.dmg` |
| iOS（iPhone / iPad） | `ZTV-v2.5.0-ios-xcode-project.zip` |

> 签名 IPA 为可选 job，需配置 `EXPO_TOKEN` 与 `ENABLE_IOS_EAS`，默认跳过。

## 4. GitHub Pages 网站

- **访问地址**：https://zqryv.github.io/ZTV/ （已启用，Pages API 状态 `built`）。
- **当前部署方式**：Web 静态产物发布在 `gh-pages` 分支，Pages Source 设为 `gh-pages / /`（`build_type: legacy`）。`push main` 不会自动重建站点，需要按下方步骤重新发布产物。
- **可选自动化**：仓库提供 `docs/pages-workflow.yml` 模板，将其放到 `.github/workflows/pages.yml` 后，具备 `workflow` scope 的凭证即可让 `push main` 自动构建与部署（步骤：`yarn install --frozen-lockfile` → 临时注入 `expo.experiments.baseUrl = "/ZTV"` → `npx expo export --platform web` → `node scripts/preparePages.js web-build` → `actions/deploy-pages@v4`）。当前 PAT 的 scopes 为 `repo, write:packages`，GitHub 拒绝由它新增工作流文件，因此采用分支部署。
- `preparePages.js` 负责：把资源绝对路径改写为 `/ZTV/...`、生成 `404.html` 作为 SPA 深链回退、生成 `.nojekyll` 保留 `_expo` 资源目录、把 PWA manifest 改为相对路径；`search/ music/ radio/ live/ play/ detail/ favorites/ settings/` 另有同名 `index.html`，让深链直接返回 200。
- 仓库中的 `app.json` **不含** baseUrl，因此 `release.yml` 产出的鸿蒙离线 PWA zip 仍可用 `file://` 直接打开，不受 Pages 子路径影响。
- 站点支持直接访问 `/ZTV/`、`/ZTV/search`、`/ZTV/music`、`/ZTV/radio` 等路由。

## 5. 各平台安装方式

- **Android TV**：U 盘拷贝 APK 安装，或 `adb install -r ZTV-v2.5.0-android-tv.apk`。
- **Android 手机/平板 / 鸿蒙 4.x**：直接安装 APK，允许「未知来源」。
- **鸿蒙 NEXT**：解压 `ZTV-v2.5.0-harmony-web.zip`，浏览器打开 `index.html` →「添加到桌面」；或直接访问上面的 Pages 网址。
- **Windows / Ubuntu / macOS**：双击安装包 / `sudo apt install ./ZTV-v2.5.0-linux-amd64.deb`。
- **电视 / 投影仪浏览器**：打开 Pages 网址，方向键移动焦点、Enter/OK 确认、Escape 返回；媒体键可播放/暂停。

> Windows / Ubuntu / macOS 安装包由 `desktop/` 下的 Electron 外壳封装 Web 导出物生成，视频解码能力弱于 Android TV 版，主要用于大屏浏览与设置体验。

## 6. 本地验证

```bash
cd ZTV
yarn typecheck                       # tsc --noEmit
npx jest --ci --runInBand            # 单元 / 快照测试
node scripts/verifyRefactor.js       # 既有重构不变式
node scripts/verifyLargeScreenMatrix.js  # 大屏分辨率矩阵（8 分辨率 × 3 平台）
node scripts/verifyModules.js        # 模块化 / 中文输入 / 离线 / 双通道
node scripts/verifyAudioSources.js  # 音源真实可用性
node scripts/buildModulePacks.js    # 重建模块资源包与清单
npx expo export --platform web      # Web/PWA 静态导出
```

## 7. v2.5.0 验证结果

- `tsc --noEmit`：**0 错误**。
- Jest：**10 suites / 106 tests / 1 snapshot 全通过**（新增拼音输入、音乐雷达 / 熔断、模块校验和、内置资源包 4 组测试）。
- `verifyRefactor.js`：**54/54**（含三处版本号统一 2.5.0、路由薄壳化、焦点修复）。
- `verifyLargeScreenMatrix.js`：**248/248**，8 分辨率 × 3 平台。
- `verifyModules.js`：**57/57**（清单校验和一致性、CRLF 代理换行兼容、单模块重建、中文输入语义、离线节目、双通道 + Pages 兜底）。
- `verifyAudioSources.js`：**18/18**。
- Web 静态导出与线上多视口 headless 渲染通过。
- 完整说明：`docs/MODULAR_ARCHITECTURE.md`、`docs/OFFLINE_RADIO.md`、`docs/LARGE_SCREEN_ADAPTATION.md`。

## 8. 单独升级一个模块（不发版）

```bash
# 1. 只改 modules/defaultPacks.ts 中目标模块的 config 与版本
node scripts/buildModulePacks.js --only music
# 2. 把 module-packs/music.json 与 module-registry.json 推到 main 分支
# 3. 客户端：设置 → 模块独立更新 → 检查模块更新 → 更新「音乐在线」
```

只需推送两个小 JSON（约 1~2 KB + 清单），**不需要打包 APK / dmg / exe，也不需要用户重装 App**。其它模块包的 checksum 保持不变，不会被误更新。校验和与体积由构建脚本计算，客户端下载后复核，失败自动保留旧版本；设置页可一键回滚到内置包。

## 9. 国内 / 海外更新通道

| 用途 | 国内通道 | 海外通道 | 兜底通道 |
| --- | --- | --- | --- |
| 版本检查 / 模块清单 / 资源包 | `cdn.jsdelivr.net`、`fastly.jsdelivr.net`、`gcore.jsdelivr.net`、`ghproxy.net` 代理 | `raw.githubusercontent.com`、`github.com/raw/refs/heads/main` | `zqryv.github.io/ZTV`（`version.json` / `module-registry.json` / `module-packs/*.json`） |
| 安装包下载 | `ghfast.top`、`gh-proxy.com`、`ghproxy.net`、`hub.gitmirror.com` 四个加速前缀 | GitHub Releases 直连 | 设置页手动打开 Release 页面 |

- `services/updateChannels.ts` 在 `auto` 模式下用时区 / 语言提示选择首轮优先通道，但**两组端点始终全部保留**作兜底；所有请求并发竞速，任一可用即成功。
- 成功端点的耗时写入 AsyncStorage，下次优先；用户也可在「设置 → 模块独立更新」手动切换自动 / 国内优先 / 海外优先。
- 所有 URL 带请求时时间戳，避免 CDN 返回旧版本；模块包独立走 jsDelivr + GitHub raw + Pages 三通道。
- `scripts/preparePages.js` 会把 `version.json`、模块清单与资源包一并发布到 Pages；当 `cdn.jsdelivr.net` 或 `raw.githubusercontent.com` 在本地网络被 TLS 阻断时，客户端仍能完成版本检查与模块升级。
- v2.5.0 线上实测：Pages 站点首页及 `search` / `music` / `radio` / `settings` 深链、`manifest.json`、`module-registry.json`、`module-packs/radio.json` 全部 **HTTP 200**；jsDelivr 的 Fastly / Gcore 节点与 `ghproxy.net` 返回 `version=2.5.0`。
- `app.json` 的 `extra` 声明 `moduleRegistry` / `modulePackDir` / `updateChannels`，便于换仓库或自建镜像时统一改配置。
