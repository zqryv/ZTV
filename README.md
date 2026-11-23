# ZTV 📺

一个基于 [OrionTV](https://github.com/orion-lib/OrionTV)（React Native TVOS + Expo）二次开发的直播/点播播放器，面向 Android TV（含联想、乐视等 1.x 及以上系统）与 Apple TV，界面简单大方，全面适配遥控器操作。

## ✨ ZTV 功能

### v2.0.0 界面与功能全面升级

- **整体界面重设计**：暗色沉浸背景 `#0B0E13` + 青绿主色 `#00E6A8`，统一胶囊式底部导航、圆角卡片、品牌头部与语义色令牌；手机（底部 Tab）/ 平板、桌面（侧边栏）/ TV（遥控器焦点 Stack）四端自适应。
- **`MTV` 更名为 `MUSIC`**：分类名与所有界面文案统一为 `MUSIC`（内部槽位标识仍为 `mtv`，保持用户已保存绑定的兼容）。
- **新增「音乐播放」分类**：参考 any-listen 的歌单 / 曲目元数据 / 播放列表 / 播放控制理念，基于项目已有 `expo-av` 实现。支持歌单切换、渐变封面、进度拖拽、上一首/下一首、循环、随机、音量、歌词区，以及添加自定义在线音源。
- **新增「收音机」分类**：内置可直连的公开电台，支持分类筛选、上一台/下一台、播放/暂停/停止、音量、添加自定义电台。
- **搜索增强**：搜索框支持按影片名称**首字母检索**（如输入 `QYN` 命中「庆余年 第二季」），输入时实时联想；界面内展示**热搜影视榜**及 A–Z 首字母索引，点击热搜或联想项即可快速发起搜索。
- **TV 直播源设置增强**：新增/编辑源时**源名称可输入和修改**；地址输入框**固定显示 `https://` 前缀**，只需填写域名与路径；遥控器左右键可在名称/地址间切换焦点。API 地址输入框同样固定显示 `https://`。
- **跨端兼容加固**：TV 遥控器事件统一走 `useSafeTVEventHandler`，在 Web / 桌面（react-native-web）环境下安全退化为 no-op，避免设置页与播放页崩溃。

### v1.x 基础功能

- **首页 TV / MUSIC 入口**：首页分类栏的 `TV`、`MUSIC` 两个入口位于分类末尾，点击直接进入直播页，分别加载各自绑定的 M3U 源；未配置时显示引导页，可一键跳转到设置。
- **多直播源管理（TV 源设置）**：设置页新增「TV 源设置」，支持添加、编辑、删除**多个** M3U 源；每个源可「测试连接」并显示解析到的频道数量；可为 TV / MUSIC 入口分别绑定指定源。首次启动落库两个已验证的内置源。
- **旧配置自动迁移**：旧版单一 `m3uUrl` 会在首次启动时自动转换为一个「默认直播源」，并同时绑定到 TV / MUSIC 入口，升级无感。
- **直播页遥控器适配**：左右键换台、下键打开频道列表、上键在 TV / MUSIC 之间切换；频道列表打开时按返回键关闭。
- **应用品牌**：更名为 `ZTV`，Android 包名 `com.ztv.player`，scheme `ztv`；**Leanback 启动配置与 TV 横幅保持 OrionTV 原样**。

## 🛠️ 技术栈

- React Native TVOS (~0.74) + Expo (~51) + Expo Router + TypeScript
- expo-av 播放、AsyncStorage 持久化、Zustand 状态管理

## 📂 主要改动文件

| 文件 | 说明 |
| --- | --- |
| `constants/LiveSources.ts` | TV / MUSIC 槽位与 M3U 源类型定义、配置清洗工具、内置默认源 |
| `stores/settingsStore.ts`、`services/storage.ts` | 多源持久化、绑定关系、旧 `m3uUrl` 自动迁移 |
| `components/settings/TVSourcesSection.tsx` | 多源管理界面（增删改、源名称编辑、`https://` 固定前缀、测试连接、入口绑定） |
| `components/settings/APIConfigSection.tsx` | API 地址输入框固定显示 `https://` 前缀 |
| `app/settings.tsx` | 用新模块替换原单一直播源输入框 |
| `stores/homeStore.ts`、`app/index.tsx` | 首页分类置末 TV / MUSIC，追加音乐播放、收音机入口并跳转 |
| `app/live.tsx` | 按入口加载对应源、遥控器交互、空状态引导页 |
| `app/search.tsx`、`utils/pinyin.ts`、`constants/HotSearch.ts` | 首字母检索、热搜影视榜、A–Z 索引与点击快搜 |
| `app/music.tsx`、`app/radio.tsx`、`constants/AudioLibrary.ts` | 音乐播放页、收音机页与内置曲库/电台 |
| `services/audioPlayer.ts`、`stores/audioStore.ts` | 基于 `expo-av` 的播放服务与歌单/电台状态及自定义音源持久化 |
| `hooks/useSafeTVEventHandler.ts` | 跨平台 TV 遥控器事件安全封装 |
| `constants/Colors.ts`、`components/navigation/*` | 设计系统令牌、四端导航与视觉统一 |
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

仓库的 GitHub Releases 中提供以下安装包（版本号形如 `v2.0.0`）：

| 平台 | 资源文件 | 安装方式 |
| --- | --- | --- |
| Android TV（联想/乐视等） | `ZTV-v{version}-android-tv.apk` | U 盘拷贝或 adb `install -r` 安装；长按桌面图标设为启动器 |
| Android 手机/平板 | `ZTV-v{version}-android.apk` | 直接安装，允许「未知来源」 |
| Ubuntu（x86_64） | `ZTV-v{version}-linux-amd64.deb` | `sudo apt install ./ZTV-v{version}-linux-amd64.deb` |
| Windows（x86_64） | `ZTV-v{version}-windows-setup.exe` | 双击安装 |
| macOS（Intel / Apple Silicon 通用） | `ZTV-v{version}-macos-universal.dmg` | 双击挂载，拖入「应用程序」；首次打开若提示，右键→打开 |
| iOS（iPhone / iPad） | `ZTV-v{version}-ios-xcode-project.zip` | 解压后用 Xcode 打开 `ios/ZTV.xcworkspace`，个人 Apple ID 免费签名即可安装到自己的设备；付费开发者账号可上架 App Store |
| iOS 真机 IPA（可选） | `ZTV-v{version}-ios.ipa` | 配置 `EXPO_TOKEN` 等 EAS 凭证后由 CI 自动签名构建 |

> 说明：本项目为 React Native TVOS 应用，原生支持 Android TV / Apple TV。Windows / Ubuntu / macOS 安装包通过 Web 版（react-native-web）+ Electron 封装提供，用于在大屏/电脑上体验界面；直播播放能力以 Android TV 版为准。
>
> **关于 iOS 真机包**：按 Apple 规定，iOS 应用必须由开发者证书签名才能安装到真机，无法像 Android 那样直接分发未签名 IPA。因此默认交付可直接编译的 Xcode 工程源码，你用自己的 Apple ID 即可免费签名安装（个人签名 7 天有效，需每 7 天重签）。若希望 CI 直接产出已签名的 `.ipa`，在仓库 Settings → Secrets and variables → Actions 中配置 `EXPO_TOKEN`（Expo 账号令牌），并将 Variables 中的 `ENABLE_IOS_EAS` 设为 `true`，构建流程会自动增加 EAS 真机 IPA 产物。构建脚本见 `.github/workflows/release.yml`。

## 🔄 自动更新

设置页的「检查更新」从 `constants/UpdateConfig.ts` 中配置的 GitHub 仓库读取 `package.json` 版本号，并从对应版本的 Release 下载安装包。部署到自己的仓库后，把 `GITHUB_OWNER` / `GITHUB_REPO` 改成你的用户名与仓库名即可。

## ⚠️ 免责声明

ZTV 仅作为视频搜索与播放工具，不存储、上传或分发任何视频内容。所有内容均来自第三方 M3U 源或 API。使用本项目时请遵守当地法律法规。

本项目基于 OrionTV（MIT License）二次开发，致谢原作者及 MoonTV、LibreTV 等开源项目。
