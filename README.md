# ZTV 📺

一个基于 [OrionTV](https://github.com/orion-lib/OrionTV)（React Native TVOS + Expo）二次开发的直播/点播播放器，面向 Android TV（含联想、乐视等 1.x 及以上系统）与 Apple TV，界面简单大方，全面适配遥控器操作。

## ✨ ZTV 功能

### v2.5.0 中文输入 / 离线广播 / 模块化独立升级

- **搜索框焦点修复**：新增 `components/SearchInput.tsx` 统一可聚焦输入组件，去掉包裹 `TextInput` 的 `TouchableOpacity`（它抢走了指针事件）、移除音乐页 TV 上的 `focusable={false}`、`onFocus` 不再收起屏幕键盘；清空按钮移到输入框外层，所有平台一律 `editable` / `focusable`。搜索页与音乐在线页共用。
- **内置键盘支持中文**：`utils/pinyinIme.ts` 提供拼音组合串、全拼 / 首字母 / 单字三路候选召回、候选点选、中文码点安全删除；键盘新增「中 / En」切换、拼音显示区与候选栏。删除键先退拼音再退文字，清空键一次复位正文 / 组合 / 结果，返回键按「取消组合 → 收键盘 → 退页」依次回退。
- **音乐在线融合 Solara 思路**：有效结果缓存（空结果 / 错误响应不入库）、关键词无感记忆、多榜单去重 + 随机注入雷达、请求熔断与切换曲库不误触发；保留「在线检索 → 音乐电台 → 内置曲库」三级降级。仅借鉴设计，未复制其代码（Solara 为 CC BY-NC-SA，出处见 `docs/MODULAR_ARCHITECTURE.md`）。
- **收音机离线可听**：新增 12 条公版离线节目与预缓存能力，原生用 `expo-file-system`、Web 用 Cache API；播放器支持 `file://` / `blob:`；直播失败自动回退到已缓存节目。详见 [`docs/OFFLINE_RADIO.md`](docs/OFFLINE_RADIO.md)。
- **模块化独立升级**：三个屏幕迁入 `modules/<id>/`，`app/` 只留 3 行路由薄壳；每个模块有独立版本清单与几 KB 的 JSON 资源包，可单独检查 / 更新 / 回滚，无需重新下载安装整个 App（整包 67~165 MB vs 单模块 0.5~6 KB）。设置页新增「模块独立更新」入口。详见 [`docs/MODULAR_ARCHITECTURE.md`](docs/MODULAR_ARCHITECTURE.md)。
- **国内 / 海外都能检查并安装更新**：`services/updateChannels.ts` 把版本检查、模块清单、安装包下载分成国内通道（jsDelivr 三节点 + 四个 GitHub 加速代理）与海外通道（GitHub raw / Releases 直连），并发竞速、按成功耗时记忆优选通道，设置页可手动切换；模块清单与资源包同样双通道下发。另有 GitHub Pages 站点作为第三兜底通道，`version.json`、模块清单与资源包随站点一同发布。
- **验证**：`tsc --noEmit` 0 错误、Jest 10 suites / 106 tests、`verifyRefactor` 54/54、`verifyLargeScreenMatrix` 248/248、`verifyModules` 57/57、`verifyAudioSources` 18/18。

### v2.4.0 电视 / 投影仪大屏适配与 GitHub Pages 站点

- **响应式标尺重构**：新增 `utils/LargeScreen.ts` 纯计算层，尺寸同时受宽、高、宽高比与相对 1080p 的分辨率缩放约束，并扣除 200px 侧栏 / 顶栏占用；`utils/DesignTokens.ts` 显式监听 Dimensions change、window resize、orientationchange 与 visualViewport，投影仪切换分辨率、横竖屏旋转、浏览器缩放都会即时重排。低可用高度与竖屏自动降级单列。
- **三屏不再被裁剪**：搜索 / 音乐在线 / 收音机左栏改为独立 `ScrollView` 兜底（`contentContainerStyle` + `maxHeight: contentHeight`），解决 Web 端 `body{overflow:hidden}` 造成的「内容显示不完整」；音乐右栏按扣除侧栏后的 `contentWidth` 推导；4K 放大字号与控件，720p / 4:3 投影收紧行高与键盘。
- **按钮可选中、可操作**：`ThemedText` 关闭系统字体缩放，`useScale` 固定为 1，消除原生 TV 上 `lineHeight` 被放大 2~4 倍的「界面被放大」；统一大屏 60px 最小点击区与 hitSlop；移除音乐 / 收音机全局遥控器里与原生焦点冲突的 `select/up/down`，焦点改由 `onFocus` + `hasTVPreferredFocus` 单轨驱动；`useSafeTVEventHandler` 补 Web / 投影浏览器键盘桥接（方向键几何焦点导航、Enter/Space 触发、Escape 返回、媒体键）。
- **屏幕键盘不再溢出**：功能键按面板实际宽度做权重分配，取消 `Math.max(48/64)` 硬下限，任意分辨率下总宽都不超过面板。
- **网页访问地址**：Web/PWA 已部署到 GitHub Pages（**https://zqryv.github.io/ZTV/**）。`scripts/preparePages.js` 负责导出时临时注入 `/ZTV` base path、生成 `404.html` / `.nojekyll` 与相对路径 PWA manifest，并为八个路由生成显式入口使深链直接返回 200；产物发布在 `gh-pages` 分支。仓库内 `docs/pages-workflow.yml` 是可选的 CI 自动部署模板（当前 PAT 无 `workflow` scope，故采用分支部署）。
- **验证**：`tsc --noEmit` 0 错误、Jest 全通过、`verifyRefactor` 51/51、`verifyLargeScreenMatrix` 248/248（8 种分辨率 × Web / 原生 TV / 机顶盒）、`verifyAudioSources` 18/18、Web 静态导出与多视口 headless 渲染通过。完整修改说明与验证结果见 [`docs/LARGE_SCREEN_ADAPTATION.md`](docs/LARGE_SCREEN_ADAPTATION.md)。

### v2.3.0 三界面紧凑重构 / 分地区免费音源 / 更新链路提速

- **按设备设计稿统一收紧布局**：参考工作区「ZTV 多端界面设计预览」（3 界面 × 4 设备：393 / 1024 / 1440 / 1920），新增 `utils/DesignTokens.ts` 统一紧凑标尺。搜索、收音机、音乐在线三页在平板 / 桌面 / 电视改为左右分栏（左栏约 38~40%），控件尺寸由「栏宽」而非整屏宽度推导；电视保留 10-foot 字号与遥控器提示，但不再整屏铺开、不再出现下半屏空白。
- **搜索**：屏幕键盘收进左栏独立面板（电视仅占约 40% 宽），当前字母翡翠绿填充 + 发光描边；右栏为热搜 TOP5、搜索结果 / 完整榜单、猜你想搜胶囊；手机单列且键盘可收起。
- **收音机**：左栏调谐器焦点卡 + 分类胶囊 + 折叠筛选，右栏「探索电台」列表（电视单列 5 张填满、桌面双列网格）。
- **音乐在线**：分类「音乐播放」更名为「音乐在线」（首页 / 侧边栏 / 底部导航 / PWA 元信息同步）。左栏正在播放（封面按栏宽收紧）+ 五键控制，右栏发现音乐 + 曲目网格 + 精选歌单；常驻可输入搜索框、屏幕键盘与中文热词均保留。
- **分地区免费音源**：内置 **35 个实测可直连电台**与 **25 首内置曲目**，按 中国大陆 / 中国台湾 / 美国 / 日本 / 韩国 / 欧洲 分类。中国大陆 11 台（蜻蜓 FM 公开流等）、中国台湾 5 台（飛碟聯播網、AsiaFM 亞洲電台、Radio ICRT、高雄廣播電台、栗子的輕音樂）、美国 7 台（KEXP、NPR、Radio Paradise、MSNBC、Your Classical 等）；另有 9 条 24h 音乐流覆盖中国大陆 / 中国台湾 / 美国。来源为 radio-browser.info 公开目录、各电台官方公开流、SoundHelix 公版器乐与 iTunes 官方 30~90s 试听，仅做链接聚合；已剔除明确禁止二次流的 SomaFM 与本次复测失效的 SRG SSR。台湾统一表述为「中国台湾」地区标签。
- **更新链路修复（参考 2.1.0 流畅实现定位根因）**：v2.1.0 的 Releases API + 平台资源映射 + 浏览器兜底设计正确，但版本检查是串行回退（8s API + 3×6s 镜像，最坏 26s），raw 镜像路径写成 `/refs/heads/main/`（恒 404），时间戳在模块加载时就固定；下载中断只能从头重下且仅重试 2 次。本版改为 API 与 4 个镜像**并发竞速**（4.5s 超时 + 1.2s API 优先窗口）、正确镜像地址与请求时时间戳、5 分钟结果缓存与并发去重；下载增加多源换线、进度停滞看门狗、`pauseAsync` 断点续传、文件完整性校验与 4 次退避重试。
- **在线请求并发化**：iTunes 多地区检索与 radio-browser 多镜像由串行改为并发，最坏耗时从 36s 降到单次请求超时；自动检查更新等待 AsyncStorage 初始化完成，消除启动竞态。
- **验证**：`tsc --noEmit` 0 错误、Jest 75/75、`node scripts/verifyRefactor.js` 51/51、`node scripts/verifyAudioSources.js` 18/18（含 6 地区真实流探测）、Web/PWA 导出通过。

### v2.2.1 按设计方案替换音乐播放 / 收音机界面

- **设计方案落地**：参考工作区已有的 Ardot 设计稿「18 音乐播放器」「19 收音机」（fileId `750387664062996`），替换 `app/music.tsx` 与 `app/radio.tsx` 的界面层。沿用设计语言的暗色沉浸 `#0B0E13`、青绿 `#00E6A8`、圆角卡片与胶囊控件、胶囊式底部导航。
- **音乐播放**：改为沉浸式「正在播放」——氛围光晕渐变 + 按屏宽自适应的大方形封面 + 曲目信息 + 带滑块的进度条 + 五键控制（随机 / 上一首 / 播放 / 下一首 / 循环）+ 四工具图标（列表 / 歌词 / 音量 / 刷新）；音源、风格、地区、歌单收进可折叠的「发现音乐」面板，宽屏以播放器为主栏、曲目列表退到次栏。
- **收音机**：全宽「调谐器焦点卡」（正在播出徽标 / FM 频率 / 台名 / 波形律动 / 四个圆形控制）→「探索电台」+ 一行常显分类胶囊 → 电台卡片（彩色图标 / 来源 / 编码 / 播放态）；地区、在线目录、音量收进折叠面板，宽屏电台卡片按两列网格排布。
- **功能零回退**：常驻可输入的搜索框、屏幕键盘与中文热词、三音源三级降级、28 个内置电台、在线目录刷新、自定义音源增删、TV 遥控器、`useFocusEffect` 失焦停止与资源释放全部保留；`useAudioStore` / `audioPlayer` / `onlineMusic` / `AudioLibrary` 等数据接口未改动。

### v2.2.0 音乐播放 / 收音机重构与播放生命周期修复

- **两个界面重新规划布局**：音乐页按「音源 → 搜索 → 筛选 → 正在播放 → 曲目列表」分层，大屏左侧列表 / 右侧固定播放器；收音机页按「正在收听 → 来源与筛选 → 电台列表」分层，卡片标注国家、分类、编码与来源。两页都新增醒目的「停止」操作与播放状态标识。
- **修复音乐搜索框无法输入**：搜索框从折叠面板中移出、始终可见，补齐 `editable / focusable / showSoftInputOnFocus` 与明确高度；复用屏幕键盘并新增周杰伦、古典、爵士等**中文热词一键输入**，电视 / 机顶盒无需系统输入法即可搜索；键盘展开时暂停遥控器切歌按键，避免抢焦点。
- **替换与补充可用在线音乐源**：移除已失效的 Google media-session 样例（403）等地址；新增「音乐电台」第二音源（radio-browser 24h MP3 流）与 6 条国内可直连的 24h 音乐流；iTunes 因中国区商店恒返回 0 结果，改为按「cn → jp → us」自动回退，中文歌曲搜索与「最新单曲」开箱即用。三级降级：最新单曲 → 音乐电台 → 内置曲库。
- **内置可用广播电台**：收音机内置 **28 个实测可直连**的电台，覆盖中国 / 欧美 / 日本 / 韩国（蜻蜓 FM、NPO、Radio Paradise、SRG SSR、KEXP、NPR、Listen.moe 等），打开即可收听，不再依赖在线目录；刷新在线目录失败时自动保留内置电台。
- **修复退出后后台继续播放**：参考 `react-native-track-player` 的 `stopWithApp` / `StopPlaybackAndRemoveNotification` 语义与 React Navigation 的失焦清理实践，落实四层保障：`staysActiveInBackground: false`、AppState 退后台立即 stop、页面 `useFocusEffect` 失焦卸载 Sound、硬件返回键与 Web 标签页隐藏时停止；另用 `playToken` 消除「退出后异步加载完成又响起来」的竞态，停止时一并复位音频会话。
- **播放健壮性**：加载 12 秒超时、备用地址自动切换、移除 Web 端会触发 CORS 预检的自定义请求头；新增 `node scripts/verifyAudioSources.js` 音源体检脚本与 11 项音频/音源回归测试。

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
| `services/audioPlayer.ts`、`stores/audioStore.ts` | 基于 `expo-av` 的播放服务与歌单/电台状态、自定义音源与在线结果持久化；播放超时、备用地址回退、停止释放资源 |
| `hooks/useAudioLifecycle.ts`、`app/_layout.tsx` | 应用退后台 / 硬件返回 / Web 隐藏时停止播放并释放音频会话 |
| `app/music.tsx`、`app/radio.tsx` | 按 Ardot 设计稿重排界面：沉浸式正在播放（光晕 / 大封面 / 五键 / 四工具）与调谐器焦点卡（FM 频率 / 波形 / 分类胶囊 / 电台卡片），功能与数据接口保持不变 |
| `scripts/verifyAudioSources.js`、`services/__tests__/*` | 音源真实可用性体检与音频生命周期 / 地区回退回归测试 |
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

仓库的 GitHub Releases 中提供以下安装包（版本号形如 `v2.4.0`）：

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
