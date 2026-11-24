# ZTV 📺

一个基于 [OrionTV](https://github.com/orion-lib/OrionTV)（React Native TVOS + Expo）二次开发的直播/点播播放器，面向 Android TV（含联想、乐视等 1.x 及以上系统）与 Apple TV，界面简单大方，全面适配遥控器操作。

## ✨ ZTV 功能

### v2.1.0 更新修复 / 鸿蒙与折叠屏适配 / 搜索键盘

- **检查更新修复**：改为 **GitHub Releases API 优先**（直接读取最新 tag 与真实资源名），API 不可用时自动回退 raw.githubusercontent、GitHub raw 与 jsDelivr 三个镜像；请求带 8 秒超时，不再因单个镜像卡死而「检查失败」。下载链接按当前平台自动选择（TV / 手机 / 鸿蒙 / Windows / macOS / Linux / iOS），不再是写死的 Android TV 包。
- **更新兜底**：iOS / macOS / Windows / 鸿蒙 NEXT 无法应用内安装 APK，更新弹窗与设置页提供「浏览器下载 / 前往下载页面」直达 Release；下载失败也能一键跳转。版本比对兼容 `v2.1.0`、`release-2.1.0-beta.1` 等写法。
- **鸿蒙系统支持**：识别 HarmonyOS NEXT（原生）与 HarmonyOS 4.x / 荣耀（Android 兼容层）。兼容层直接安装 Android APK；NEXT 发布可「添加到桌面」的 PWA 离线包（`*-harmony-web.zip`）。设置页新增「设备与显示」，实时展示系统、形态、折叠状态、屏幕尺寸与布局列数。
- **多形态设备适配**：三折屏 / 二折屏 / 单屏手机 / 平板 / 电视 / 机顶盒 / 桌面按窗口宽度与硬件型号实时切换网格密度与导航容器；折叠、展开、横竖屏、窗口缩放立即重排。机顶盒使用遥控器焦点与更大卡片。
- **搜索页重做**：顶部输入区加入「屏幕键盘」开关，内置 QWERTY + 数字符号键盘，点选字母即可输入拼音首字母（Q / Y / N → 庆余年），电视与机顶盒默认展开；热搜从 24 条扩充到 **71 条**，新增 TOP10 宫格、A–Z 索引与宽屏双列榜单；宽屏（折叠展开 / 平板 / 桌面）采用「左侧热搜 + 右侧结果」分栏。
- **拼音表修正**：修复「长 / 感 / 隘」重复映射导致的首字母错误，补充「吒 / 仇 / 界 / 剑」。

### v2.0.1 分类统一 / 在线音乐电台 / 连接提速

- **分类样式统一与更名**：首页功能入口（电视 / 音乐台 / 音乐播放 / 收音机）改为与「电影」完全一致的胶囊样式（去掉图标与描边）；`TV` 更名 `电视`、`MUSIC` 更名 `音乐台`，顺序调整为 **电视 → 音乐台 → 音乐播放 → 收音机**（内部槽位 id 保持 `tv`/`mtv`，已保存的绑定不受影响）。
- **音乐播放增强**：内置 16 首可直连在线曲目，按**音乐风格**（流行/摇滚/电子/古典/爵士/轻音乐/民谣/说唱）与**国家/地区**（中国/欧美/日本/韩国）分类浏览；新增「搜索最新音乐」，通过 iTunes Search API 在线检索真实歌曲（含封面/歌手/试听），可按风格+国家联网浏览，离线自动回退内置曲库。
- **收音机增强**：内置电台扩充到 8 个（多国可直连流），支持**国家/地区 + 分类**双维筛选；新增「在线电台」按钮，通过 radio-browser.info 按国家/分类加载全球广播（多镜像容错），失败时保留内置电台可离线收听。
- **API 连接提速**：所有 API 请求加入 **12 秒超时 + AbortController**（弱网不再无限挂起）；登录检查去重并去掉固定 1 秒重试睡眠（2-3 秒 → 0.2 秒）；首页点播内容不再串行等待登录检查，首屏更快；海报优先走服务器代理，避免豆瓣图床直连超时。

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
| `app/music.tsx`、`app/radio.tsx`、`constants/AudioLibrary.ts` | 音乐播放页（在线搜索/风格分国）、收音机页（在线电台/分国）、内置曲库/电台 |
| `services/onlineMusic.ts` | iTunes 在线音乐搜索 + radio-browser 在线电台（带超时与镜像容错） |
| `services/audioPlayer.ts`、`stores/audioStore.ts` | 基于 `expo-av` 的播放服务与歌单/电台状态、自定义音源与在线结果持久化 |
| `services/api.ts`、`stores/authStore.ts`、`components/PosterImage.tsx` | 请求超时、登录检查去重提速、海报代理优先加载 |
| `constants/UpdateConfig.ts`、`services/updateService.ts`、`stores/updateStore.ts` | Releases API 优先 + 三镜像回退、按平台选包、浏览器下载兜底、版本比对修正 |
| `components/settings/UpdateSection.tsx`、`components/UpdateModal.tsx` | 更新入口全平台可见、更新说明、平台提示与「浏览器下载」按钮 |
| `utils/DeviceUtils.ts`、`hooks/useResponsiveLayout.ts`、`components/navigation/ResponsiveNavigation.tsx` | 鸿蒙识别、三折/二折/机顶盒形态识别、折叠态实时重排 |
| `components/settings/DeviceInfoSection.tsx` | 设置页展示系统 / 形态 / 折叠状态 / 屏幕尺寸 / 布局列数 |
| `components/SearchKeyboard.tsx`、`app/search.tsx`、`constants/HotSearch.ts` | 内置屏幕键盘、搜索页分栏重做、71 条热搜与 TOP10 宫格 |
| `public/manifest.json`、`app/+html.tsx` | PWA 清单与安全区域适配，供鸿蒙 NEXT「添加到桌面」 |
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

仓库的 GitHub Releases 中提供以下安装包（版本号形如 `v2.1.0`）：

| 平台 | 资源文件 | 安装方式 |
| --- | --- | --- |
| Android TV（联想/乐视等） | `ZTV-v{version}-android-tv.apk` | U 盘拷贝或 adb `install -r` 安装；长按桌面图标设为启动器 |
| Android 手机/平板 | `ZTV-v{version}-android.apk` | 直接安装，允许「未知来源」 |
| 华为鸿蒙 4.x / 荣耀 MagicOS | `ZTV-v{version}-android.apk` | 兼容 Android 应用，直接安装；应用内自动识别为鸿蒙兼容模式 |
| 华为鸿蒙 NEXT | `ZTV-v{version}-harmony-web.zip` | 解压后用浏览器打开，菜单「添加到桌面」即可全屏使用 |
| Ubuntu（x86_64） | `ZTV-v{version}-linux-amd64.deb` | `sudo apt install ./ZTV-v{version}-linux-amd64.deb` |
| Windows（x86_64） | `ZTV-v{version}-windows-setup.exe` | 双击安装 |
| macOS（Intel / Apple Silicon 通用） | `ZTV-v{version}-macos-universal.dmg` | 双击挂载，拖入「应用程序」；首次打开若提示，右键→打开 |
| iOS（iPhone / iPad） | `ZTV-v{version}-ios-xcode-project.zip` | 解压后用 Xcode 打开 `ios/ZTV.xcworkspace`，个人 Apple ID 免费签名即可安装到自己的设备；付费开发者账号可上架 App Store |
| iOS 真机 IPA（可选） | `ZTV-v{version}-ios.ipa` | 配置 `EXPO_TOKEN` 等 EAS 凭证后由 CI 自动签名构建 |

> 说明：本项目为 React Native TVOS 应用，原生支持 Android TV / Apple TV。Windows / Ubuntu / macOS 安装包通过 Web 版（react-native-web）+ Electron 封装提供，用于在大屏/电脑上体验界面；直播播放能力以 Android TV 版为准。
>
> **关于 iOS 真机包**：按 Apple 规定，iOS 应用必须由开发者证书签名才能安装到真机，无法像 Android 那样直接分发未签名 IPA。因此默认交付可直接编译的 Xcode 工程源码，你用自己的 Apple ID 即可免费签名安装（个人签名 7 天有效，需每 7 天重签）。若希望 CI 直接产出已签名的 `.ipa`，在仓库 Settings → Secrets and variables → Actions 中配置 `EXPO_TOKEN`（Expo 账号令牌），并将 Variables 中的 `ENABLE_IOS_EAS` 设为 `true`，构建流程会自动增加 EAS 真机 IPA 产物。构建脚本见 `.github/workflows/release.yml`。

## 🔄 自动更新

设置页的「检查更新」优先请求 GitHub Releases API 读取最新 tag、更新说明与真实资源名；API 不可用（限流或网络问题）时依次回退 `raw.githubusercontent.com` → jsDelivr → `github.com/raw` 上的 `package.json`。下载链接根据设备形态自动选择：Android TV / 手机 / 鸿蒙兼容层走应用内 APK 安装；iOS / 桌面 / 鸿蒙 NEXT 自动打开对应 Release 下载页。所有平台均保留「浏览器下载」兜底。部署到自己的仓库后，把 `constants/UpdateConfig.ts` 中的 `GITHUB_OWNER` / `GITHUB_REPO` 改成你的用户名与仓库名即可。

## ⚠️ 免责声明

ZTV 仅作为视频搜索与播放工具，不存储、上传或分发任何视频内容。所有内容均来自第三方 M3U 源或 API。使用本项目时请遵守当地法律法规。

本项目基于 OrionTV（MIT License）二次开发，致谢原作者及 MoonTV、LibreTV 等开源项目。
