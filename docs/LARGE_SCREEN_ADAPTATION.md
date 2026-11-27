# ZTV v2.4.0 大屏（电视 / 投影仪）适配：修改说明与验证结果

> 目标：修复「搜索 / 音乐在线 / 收音机」在电视、投影仪等大屏设备上分辨率变化时界面放大、内容显示不完整、按钮无法选中或操作的问题。

## 一、问题现象与根因

| # | 现象 | 根因（v2.3.0 代码） |
| --- | --- | --- |
| 1 | 内容显示不完整、被裁切 | `utils/DesignTokens.ts` 的 `getCompactMetrics` 只有 `coverSize` 用到 `height`，其余尺寸（栏宽、字号、间距、按键高度）**只由宽度推导**；`isWide = width >= 900` 只判宽不判高。三页根容器是无 `ScrollView` 的 `ThemedView`，左栏 `leftColumnWide` 为固定像素宽且 `flexShrink: 0`。Web 端 `<ScrollViewStyleReset />` 注入 `body{overflow:hidden}`，一旦纵向溢出就永久裁掉、无法滚到。 |
| 2 | 界面被放大 | `components/ThemedText.tsx` 未设置 `allowFontScaling`，RN 默认跟随系统「显示大小」（电视常为 1.2~1.5×），字号与 lineHeight 一起放大；`hooks/useScale.ts` 的 `Platform.isTV ? width / 1000 : 1` 又让 `constants/TextStyles.ts` 的 lineHeight 在 1920 上变成 46、3840 上变成 92，而页面 fontSize 由 DesignTokens 覆盖，形成「字号 15 / 行高 92」的错配。 |
| 3 | 分辨率变化不重排 | 布局只依赖 `useWindowDimensions()`；缺少对 `orientationchange` / `visualViewport` 的显式监听，投影仪切换输入分辨率、浏览器缩放时部分平台不刷新。 |
| 4 | 右栏被挤压 | Web 大屏被 `ResponsiveNavigation` 套上固定 200px 侧栏 + 顶栏，但标尺按**窗口全宽**推导；`app/music.tsx` 的 `rightWidth` 也用 `metrics.width`，导致按 1280 算出的 474px 左栏被塞进约 1080px 的内容区。 |
| 5 | 按钮无法选中 / 操作 | `app/music.tsx` 与 `app/radio.tsx` 的全局 `handleTVEvent` 用 `up/down` 改 `focusIndex`（只画边框、不驱动真实焦点）、`select` 直接执行业务动作，与 react-native-tvos 原生焦点引擎及 `onPress` **双轨并存**，OK 键会叠加触发甚至播放另一台；`useSafeTVEventHandler` 在 Web 上因缺少 `useTVEventHandler` 退化为 no-op，投影浏览器里遥控器 / 键盘完全失效。 |
| 6 | 键盘按钮点不到 | `components/SearchKeyboard.tsx` 功能行用 `Math.max(48/64, letterKeyWidth * 1.5)` 硬下限，配合 `flexWrap: "nowrap"`，窄面板时 4 个键总宽超过 `available`，两端被裁掉。 |

## 二、修改方案

### 2.1 纯计算标尺层（新增 `utils/LargeScreen.ts`）

- 定义 `LARGE_SCREEN_PROFILES`：8 种常见电视 / 投影分辨率（1024×768、1280×720、1280×800、1366×768、1920×1080、1920×1200、2560×1440、3840×2160）。
- `isLargeScreenResolution(w, h)` 按宽度 + 宽高比识别大屏（含 4:3 投影），Web 大屏因此也能拿到 TV 形态的 10-foot 标尺、大按钮与遥控器提示。
- `getCompactMetrics()` 保留原 5 个参数签名，新增可选 `ViewportOptions`：
  - `contentWidth = width - padding - chromeWidth`、`contentHeight = height - padding - chromeHeight`，从源头扣除侧栏 / 顶栏占用；
  - `resolutionScale = clamp(sqrt(w*h / (1920*1080)), 0.82, 1.6)` 与 `heightScale` 同时作用于字号、间距、圆角、封面、按键；
  - `isWide = contentWidth >= 760 && contentHeight >= 520 && aspect >= 1.2`，低高度 / 竖屏自动降级单列；
  - 新增 `minTouchTarget`（大屏 60px）、`focusBorderWidth`、`columnScroll`、`contentWidth/contentHeight`、`resolutionScale`、`isLargeScreen` 等字段；
  - 大屏字号设下限（body ≥ 14、caption ≥ 12），键高不低于 `minTouchTarget * 0.72`，避免 720p 被压缩到 11px / 32px。
- `getKeyboardActionWidths(available, gap)` 按 `[1.5, 1.5, 1.5, 2]` 权重分配功能键宽度，总宽恒等于 `available - gap*3`。
- `estimateLeftColumnHeight()` 供验证脚本评估左栏内容高度。

### 2.2 响应式重算（`utils/DesignTokens.ts`）

- 改为 `LargeScreen` 的 re-export + `useCompactLayout()` Hook；
- 显式监听 `Dimensions change`、`window resize`、`orientationchange`、`visualViewport resize`，并优先使用监听得到的最新 viewport；
- 按设备形态注入 `chromeWidth = 200`（非原生 TV 的大屏）/ `chromeHeight = 116`（含顶栏与页头）、原生 TV 为 `0 / 72`。

### 2.3 三屏布局（`app/search.tsx` / `app/music.tsx` / `app/radio.tsx`）

- 左栏由 `View` 改为 `ScrollView`（`contentContainerStyle={{flexGrow:1}}`、`keyboardShouldPersistTaps`、`nestedScrollEnabled`），并给左右栏加 `maxHeight: m.contentHeight`；
- 音乐页 `rightWidth` 改用 `metrics.contentWidth - metrics.leftWidth - gap`；
- 搜索 / 音乐 / 收音机的图标按钮、字母胶囊、榜单项、筛选胶囊、音量档、曲目行、电台卡、工具按钮统一应用 `minTouchTarget` 与 `hitSlop`；
- 大屏按键、`QWERTY` 键盘、封面、列数均随新标尺实时重算。

### 2.4 字体与焦点

- `components/ThemedText.tsx`：加 `allowFontScaling={false}` + `maxFontSizeMultiplier={1}`；
- `hooks/useScale.ts`：固定返回 1，字号统一由标尺管理（消除行高 2~4 倍放大）；
- `hooks/useSafeTVEventHandler.ts`：新增「模块内单例」Web 键盘桥接——方向键按屏幕几何位置移动 DOM 焦点、Enter/Space 触发当前焦点控件、Escape/Backspace 广播 `back`、媒体键广播 `playPause`/`left`/`right`；方向键与 OK 不再广播业务事件，避免双重消费；
- 音乐 / 收音机移除全局 `select/up/down/left/right` 业务消费，改为 `onFocus` 同步视觉焦点 + `hasTVPreferredFocus` 首项初始焦点 + `hitSlop`；`back` 键先关键盘 / 模态，再 `router.back()`；搜索页补齐同类 `back` 处理。

### 2.5 键盘与站点

- `components/SearchKeyboard.tsx`：容器 `maxWidth = panelWidth`、按键 `minWidth:0 / flexShrink:1 / hitSlop`、功能行按权重分配、快捷键最小高度贴近 `minTouchTarget`；
- `public/manifest.json` 与 `app/+html.tsx` 改用相对路径；
- 新增 `.github/workflows/pages.yml`、`scripts/preparePages.js`：构建时临时注入 `expo.experiments.baseUrl = "/ZTV"`，导出后改写资源路径、生成 `404.html` / `.nojekyll`、修正 PWA manifest；仓库文件保持无前缀，鸿蒙离线 PWA zip 不受影响。

## 三、大屏分辨率矩阵（Web 投屏 / 桌面，扣除 200px 侧栏 + 顶栏）

| 分辨率 | 可用内容区 | 左栏宽 | 封面 | 键高 | 正文 | 列数 | 最小点击区 | 分栏 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1024×768（XGA 投影 4:3） | 792×620 | 317 | 165 | 43 | 14 | 2 | 60 | 是 |
| 1280×720（720p） | 1048×572 | 419 | 194 | 43 | 14 | 2 | 60 | 是 |
| 1280×800（WXGA 投影） | 1048×652 | 419 | 218 | 43 | 14 | 2 | 60 | 是 |
| 1366×768 | 1134×620 | 454 | 211 | 43 | 14 | 3 | 60 | 是 |
| 1920×1080（1080p） | 1688×932 | 675 | 300 | 46 | 14 | 4 | 60 | 是 |
| 1920×1200（WUXGA 投影） | 1688×1052 | 675 | 316 | 54 | 14 | 4 | 60 | 是 |
| 2560×1440（QHD） | 2328×1292 | 931 | 400 | 64 | 17 | 4 | 60 | 是 |
| 3840×2160（4K UHD） | 3608×2012 | 1443 | 405 | 64 | 17 | 4 | 60 | 是 |

原生电视 / 机顶盒两类平台同样通过矩阵校验（无侧栏，可用宽度更大）。

## 四、验证结果

| 验证项 | 命令 | 结果 |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | **0 错误** |
| 单元 / 快照测试 | `npx jest --ci --runInBand --silent` | **6 suites / 90 tests / 1 snapshot 通过**（新增 `LargeScreen.test.ts`；`ThemedText` 快照已按关闭字体缩放更新） |
| 既有重构不变式 | `node scripts/verifyRefactor.js` | **51/51**（含三处版本号统一 2.4.0） |
| 大屏分辨率矩阵 | `node scripts/verifyLargeScreenMatrix.js` | **248/248**，8 分辨率 × 3 平台，覆盖分栏宽度、封面高度、键盘总宽、最小点击区、滚动兜底、降级与缩放 |
| 内置音源体检 | `node scripts/verifyAudioSources.js` | **18/18** |
| Web / PWA 静态导出 | `npx expo export --platform web` | 成功，`index.html` / `manifest.json` / `icon.svg` / `_expo` 齐全 |
| Pages 产物 | `node scripts/preparePages.js <dist>` | 资源路径带 `/ZTV`、`404.html`、`.nojekyll`、相对 manifest、注入后的 `EXPO_BASE_URL` 均实测通过 |
| 多视口渲染 | Edge headless 截图（1920×1080 / 1280×720 / 1024×768 / 3840×2160） | 三屏完整显示、无裁剪、控件可达 |

附加不变式（由矩阵脚本静态校验）：三屏均有滚动兜底与 `maxHeight` 约束；系统字体缩放关闭；TV 端不再按屏宽放大行高；窗口 / 分辨率监听齐全；Web 键盘桥接存在；TV 焦点单轨（无 `select/up/down` 全局消费）；键盘功能行不再使用硬下限。

## 五、部署地址

- GitHub 仓库：`https://github.com/zqryv/ZTV`
- GitHub Pages 网站：`https://zqryv.github.io/ZTV/`
- Release 页面：`https://github.com/zqryv/ZTV/releases/tag/v2.4.0`

## 六、说明与限制

- 本版只调整展示层、交互层与部署配置，未改动任何音源、播放、更新、数据接口与业务逻辑；内置电台 / 曲目、三级降级、失焦停止、更新链路全部沿用 v2.3.0。
- 公开音频流受网络环境与地区策略影响，应用内保留多源降级与在线目录兜底。
- 电视 / 投影浏览器的方向键导航依赖 DOM 可聚焦元素；项目控件已统一使用 `TouchableOpacity` / `StyledButton`（RN Web 会渲染 `tabindex` 与 `role`），并补 `hitSlop` 与最小尺寸。
