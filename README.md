# ZTV 📺

一个基于 [OrionTV](https://github.com/orion-lib/OrionTV)（React Native TVOS + Expo）二次开发的直播/点播播放器，面向 Android TV（含联想、乐视等 1.x 及以上系统）与 Apple TV，界面简单大方，全面适配遥控器操作。

## ✨ ZTV 新增功能

- **首页 TV / MTV 入口**：首页分类栏新增 `TV`、`MTV` 两个入口，点击直接进入直播页，分别加载各自绑定的 M3U 源；未配置时显示引导页，可一键跳转到设置。
- **多直播源管理（TV 源设置）**：设置页新增「TV 源设置」，支持添加、编辑、删除**多个** M3U 源；每个源可「测试连接」并显示解析到的频道数量；可为 TV / MTV 入口分别绑定指定源。
- **旧配置自动迁移**：旧版单一 `m3uUrl` 会在首次启动时自动转换为一个「默认直播源」，并同时绑定到 TV / MTV 入口，升级无感。
- **直播页遥控器适配**：左右键换台、下键打开频道列表、上键在 TV / MTV 之间切换；频道列表打开时按返回键关闭。
- **应用品牌**：更名为 `ZTV`，Android 包名 `com.ztv.player`，scheme `ztv`；**Leanback 启动配置与 TV 横幅保持 OrionTV 原样**。

## 🛠️ 技术栈

- React Native TVOS (~0.74) + Expo (~51) + Expo Router + TypeScript
- expo-av 播放、AsyncStorage 持久化、Zustand 状态管理

## 📂 主要改动文件

| 文件 | 说明 |
| --- | --- |
| `constants/LiveSources.ts`（新增） | TV/MTV 槽位与 M3U 源类型定义、配置清洗工具 |
| `stores/settingsStore.ts`、`services/storage.ts` | 多源持久化、绑定关系、旧 `m3uUrl` 自动迁移 |
| `components/settings/TVSourcesSection.tsx`（新增） | 多源管理界面（增删改、测试连接、入口绑定） |
| `app/settings.tsx` | 用新模块替换原单一直播源输入框 |
| `stores/homeStore.ts`、`app/index.tsx` | 首页分类追加 TV/MTV 并跳转直播页 |
| `app/live.tsx` | 按入口加载对应源、遥控器交互、空状态引导页 |
| `services/m3u.ts` | 新增带超时的 `testM3uUrl` |

## 🚀 本地开发

```bash
yarn                 # 安装依赖（项目使用 yarn，并带 react-native-tvos 的 resolutions）
yarn prebuild        # 生成原生工程并拷贝 xml/ 下的 TV 配置
yarn android         # 运行到 Android TV 设备/模拟器
yarn start-tv        # 启动 TV 模式 Metro
yarn typecheck       # TypeScript 类型检查
```

> 首次构建 TV 工程需要 Android SDK；打包 Release 需要 Java（JDK 17）。

## 📦 各平台安装版本

仓库的 GitHub Releases 中提供以下安装包（版本号形如 `v1.0.0`）：

| 平台 | 资源文件 | 安装方式 |
| --- | --- | --- |
| Android TV（联想/乐视等） | `ZTV-v{version}-android-tv.apk` | U 盘拷贝或 adb `install -r` 安装；长按桌面图标设为启动器 |
| Android 手机/平板 | `ZTV-v{version}-android.apk` | 直接安装，允许「未知来源」 |
| Ubuntu（x86_64） | `ZTV-v{version}-ubuntu-amd64.deb` | `sudo apt install ./ZTV-v{version}-ubuntu-amd64.deb` |
| Windows（x86_64） | `ZTV-v{version}-windows-setup.exe` | 双击安装 |

> 说明：本项目为 React Native TVOS 应用，原生支持 Android TV / Apple TV。Windows 与 Ubuntu 安装包通过 Web 版（react-native-web）+ Electron 封装提供，用于在大屏/电脑上体验界面；直播播放能力以 Android TV 版为准。构建脚本见 `.github/workflows/release.yml`。

## 🔄 自动更新

设置页的「检查更新」从 `constants/UpdateConfig.ts` 中配置的 GitHub 仓库读取 `package.json` 版本号，并从对应版本的 Release 下载安装包。部署到自己的仓库后，把 `GITHUB_OWNER` / `GITHUB_REPO` 改成你的用户名与仓库名即可。

## ⚠️ 免责声明

ZTV 仅作为视频搜索与播放工具，不存储、上传或分发任何视频内容。所有内容均来自第三方 M3U 源或 API。使用本项目时请遵守当地法律法规。

本项目基于 OrionTV（MIT License）二次开发，致谢原作者及 MoonTV、LibreTV 等开源项目。
