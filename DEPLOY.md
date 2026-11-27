# ZTV 部署与发布指南（v2.4.0）

## 1. 仓库与分支

- 仓库：`https://github.com/zqryv/ZTV`，主分支 `main`。
- 应用内「检查更新」读取 `constants/UpdateConfig.ts` 的 `GITHUB_OWNER` / `GITHUB_REPO`（当前为 `zqryv/ZTV`），优先请求 GitHub Releases API，失败时并发竞速回退 raw / jsDelivr 镜像。
- 提交 `main` 且 `package.json` 变更时，`.github/workflows/auto-tag.yml` 自动创建 `v{version}` 标签。该标签由 `GITHUB_TOKEN` 创建，不会级联触发发版工作流，因此需要用有 `repo` 权限的 PAT 手动 `workflow_dispatch` 触发 `release.yml`。

## 2. 发布流程

```bash
cd ZTV
git add -A && git commit -m "feat: v2.4.0 大屏适配"
git push origin main

# 手动触发全平台 Release（auto-tag 已自动建好 tag）
curl -X POST \
  -H "Authorization: Bearer <PAT>" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/zqryv/ZTV/actions/workflows/release.yml/dispatches \
  -d '{"ref":"main"}'
```

在 **Actions** 页查看 `ZTV Release (all platforms)`；全部 job 成功后，**Releases** 页自动发布 `v2.4.0`。

## 3. Release 产物（7 个）

| 平台 | 资源文件 |
| --- | --- |
| Android TV | `ZTV-v2.4.0-android-tv.apk` |
| Android 手机/平板 / 鸿蒙 4.x | `ZTV-v2.4.0-android.apk` |
| 鸿蒙 NEXT（离线 PWA） | `ZTV-v2.4.0-harmony-web.zip` |
| Windows | `ZTV-v2.4.0-windows-setup.exe` |
| Ubuntu | `ZTV-v2.4.0-linux-amd64.deb` |
| macOS | `ZTV-v2.4.0-macos-universal.dmg` |
| iOS（iPhone / iPad） | `ZTV-v2.4.0-ios-xcode-project.zip` |

> 签名 IPA 为可选 job，需配置 `EXPO_TOKEN` 与 `ENABLE_IOS_EAS`，默认跳过。

## 4. GitHub Pages 网站

- **访问地址**：https://zqryv.github.io/ZTV/
- 工作流：`.github/workflows/pages.yml`，`push main` 或手动 `workflow_dispatch` 触发。
- 构建步骤：`yarn install --frozen-lockfile` → 临时给 `app.json` 注入 `expo.experiments.baseUrl = "/ZTV"` → `npx expo export --platform web` → `node scripts/preparePages.js web-build` → `actions/deploy-pages@v4`。
- `preparePages.js` 负责：把资源绝对路径改写为 `/ZTV/...`、生成 `404.html` 作为 SPA 深链回退、生成 `.nojekyll` 保留 `_expo` 资源目录、把 PWA manifest 改为相对路径。
- 仓库中的 `app.json` **不含** baseUrl，因此 `release.yml` 产出的鸿蒙离线 PWA zip 仍可用 `file://` 直接打开，不受 Pages 子路径影响。
- 首次使用需在仓库 **Settings → Pages** 把 Source 设为 **GitHub Actions**（也可通过 `POST /repos/zqryv/ZTV/pages` 的 `{"build_type":"workflow"}` 启用）。
- 站点支持直接访问 `/ZTV/`、`/ZTV/search`、`/ZTV/music`、`/ZTV/radio`，刷新深链由 `404.html` 承接。

## 5. 各平台安装方式

- **Android TV**：U 盘拷贝 APK 安装，或 `adb install -r ZTV-v2.4.0-android-tv.apk`。
- **Android 手机/平板 / 鸿蒙 4.x**：直接安装 APK，允许「未知来源」。
- **鸿蒙 NEXT**：解压 `ZTV-v2.4.0-harmony-web.zip`，浏览器打开 `index.html` →「添加到桌面」；或直接访问上面的 Pages 网址。
- **Windows / Ubuntu / macOS**：双击安装包 / `sudo apt install ./ZTV-v2.4.0-linux-amd64.deb`。
- **电视 / 投影仪浏览器**：打开 Pages 网址，方向键移动焦点、Enter/OK 确认、Escape 返回；媒体键可播放/暂停。

> Windows / Ubuntu / macOS 安装包由 `desktop/` 下的 Electron 外壳封装 Web 导出物生成，视频解码能力弱于 Android TV 版，主要用于大屏浏览与设置体验。

## 6. 本地验证

```bash
cd ZTV
yarn typecheck                       # tsc --noEmit
npx jest --ci --runInBand            # 单元 / 快照测试
node scripts/verifyRefactor.js       # 既有重构不变式
node scripts/verifyLargeScreenMatrix.js  # 大屏分辨率矩阵（8 分辨率 × 3 平台）
node scripts/verifyAudioSources.js  # 音源真实可用性
npx expo export --platform web      # Web/PWA 静态导出
```

## 7. v2.4.0 验证结果

- `tsc --noEmit`：**0 错误**。
- Jest：**6 suites / 90 tests / 1 snapshot 全通过**（新增 `utils/__tests__/LargeScreen.test.ts`；`ThemedText` 快照已按关闭字体缩放更新）。
- `verifyRefactor.js`：**51/51**（含三处版本号统一 2.4.0）。
- `verifyLargeScreenMatrix.js`：**248/248**，覆盖 1024×768 / 1280×720 / 1280×800 / 1366×768 / 1920×1080 / 1920×1200 / 2560×1440 / 3840×2160 共 8 种分辨率 × Web 投屏 / 原生电视 / 机顶盒 3 类平台。
- `verifyAudioSources.js`：**18/18**。
- Web 静态导出：成功，`EXPO_BASE_URL` / `experiments.baseUrl` 注入、资源路径改写、`404.html`、`.nojekyll`、相对 manifest 均已实测。
- 多视口 headless 浏览器渲染：1920×1080 / 1280×720 / 1024×768 / 3840×2160 下三屏完整显示、无裁剪。
- 完整修改说明见 `docs/LARGE_SCREEN_ADAPTATION.md`。
