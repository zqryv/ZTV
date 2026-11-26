# ZTV 部署与发布指南

代码已全部完成并在本地 `master` 分支提交（commit `dfce9b4`），但**推送到 GitHub 需要你的 GitHub 账号授权**——当前环境没有配置任何 GitHub 凭据，因此这一步需你来完成。

## 1. 推送代码到 GitHub

当前本地仓库已配置一个占位远端，**请先改成你自己的仓库地址**：

```bash
cd ZTV
# 改成你自己的 GitHub 用户名 / 仓库名
git remote set-url origin https://github.com/<你的用户名>/ZTV.git

# 推送（会提示输入用户名 + Personal Access Token）
git push -u origin master
```

> 若使用 HTTPS，密码处需填 GitHub **Personal Access Token**（需要 `repo` 权限），而非账号密码。
> 也可以换用 SSH：`git remote set-url origin git@github.com:<你的用户名>/ZTV.git`

## 2. 修改更新地址

推送前，把 `constants/UpdateConfig.ts` 顶部的两个常量改成你的仓库：

```ts
const GITHUB_OWNER = "<你的用户名>";
const GITHUB_REPO = "ZTV";
```

应用的「检查更新」会从该仓库的 `main`/`master` 分支读取 `package.json` 版本号，并从对应 Release 下载安装包。

> 注意：本地分支是 `master`，而 UpdateConfig 默认读 `refs/heads/main`。二选一：把分支改名为 `main`（`git branch -M main`），或把 UpdateConfig 里的 `main` 改成 `master`。

## 3. 自动构建四个平台的安装包

仓库已内置两个 GitHub Actions 工作流（在 `.github/workflows/`）：

- `build-apk.yml`：手动触发（`workflow_dispatch`），构建 Android TV APK。
- `release.yml`：推送 `v*` 标签或手动触发，一次性构建 **Android TV / Android / Windows / Ubuntu** 四个平台的安装包，并自动创建 GitHub Release 上传全部资源。

发布流程：

```bash
# 版本号与 package.json 保持一致（当前 2.3.0）
git tag v2.3.0
git push origin v2.3.0
```

在仓库的 **Actions** 页签可看到构建进度；结束后在 **Releases** 页可下载：

| 平台 | 资源文件 |
| --- | --- |
| Android TV | `ZTV-v2.3.0-android-tv.apk` |
| Android 手机/平板 / 鸿蒙 4.x | `ZTV-v2.3.0-android.apk` |
| 鸿蒙 NEXT（PWA） | `ZTV-v2.3.0-harmony-web.zip` |
| Windows | `ZTV-v2.3.0-windows-setup.exe` |
| Ubuntu | `ZTV-v2.3.0-linux-amd64.deb` |
| macOS | `ZTV-v2.3.0-macos-universal.dmg` |
| iOS | `ZTV-v2.3.0-ios-xcode-project.zip` |

## 4. 各平台安装方式

- **Android TV（联想/乐视等 1.x+）**：U 盘拷贝 APK 到电视安装，或用 `adb install -r ZTV-v2.3.0-android-tv.apk`；安装后在「应用」里将 ZTV 设为启动器可开机自启。Leanback 启动项与横幅已保留。
- **Android 手机/平板 / 鸿蒙 4.x**：直接安装 APK，允许「未知来源」。
- **鸿蒙 NEXT**：解压 `ZTV-v2.3.0-harmony-web.zip`，用浏览器打开 `index.html`，通过菜单「添加到桌面」全屏使用。
- **Windows**：双击 `ZTV-v2.3.0-windows-setup.exe` 安装。
- **Ubuntu**：`sudo apt install ./ZTV-v2.3.0-linux-amd64.deb`。
- **macOS**：双击 `.dmg` 拖入应用程序；首次打开右键选择「打开」。
- **iOS**：解压 Xcode 工程 zip，用个人 Apple ID 免费签名安装真机。

> Windows / Ubuntu 安装包由 `desktop/` 下的 Electron 外壳封装 react-native-web 导出物生成。受原生模块限制，桌面版的视频解码能力弱于 Android TV 版，主要用于大屏浏览与设置体验。

## 5. 本地构建（可选）

本地打包 Android TV 需要 **JDK 17 + Android SDK**（当前构建环境未安装 Java，故未在本地产出 APK）：

```bash
yarn install
yarn build          # EXPO_TV=1 prebuild + gradle assembleRelease
# 产物：android/app/build/outputs/apk/release/app-release.apk
```

## 验证结果

- TypeScript 语法检查：全部改动文件通过。
- 完整类型检查：应用代码 **0 错误**；仅 `utils/__tests__/` 下原项目自带的 3 类测试类型报错（与本次改动无关）。
- JSON 配置（`app.json` / `package.json` / `eas.json` / `desktop/package.json`）：全部有效。
- 本地 Git：已初始化、已提交、工作区干净。
