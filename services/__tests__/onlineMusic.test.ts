/**
 * 在线音源核心流程回归测试：
 * - 中国区 iTunes 商店恒为空时的地区回退（曾导致「搜索无结果」）
 * - 试听地址规范化（避免混合内容 / 非 Apple 域名）
 * - 第二音源「音乐电台」映射（Apple 服务不可达时的兜底）
 */
import {
  getCountryCandidates,
  normalizePreviewUrl,
  mapITunesTrack,
  searchLatestMusic,
  browseMusicByGenre,
  fetchMusicChannels,
} from "@/services/onlineMusic";

const ITUNES_ITEM = {
  trackId: 123456,
  trackName: "七里香",
  artistName: "周杰伦",
  collectionName: "七里香",
  previewUrl: "http://audio-ssl.itunes.apple.com/itunes-assets/demo.m4a",
  artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/demo/100x100bb.jpg",
  releaseDate: "2024-05-01T00:00:00Z",
};

describe("onlineMusic 音源映射", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("中国地区会在 cn 商店之外继续尝试 jp / us", () => {
    expect(getCountryCandidates("中国")).toEqual(["cn", "jp", "us"]);
    expect(getCountryCandidates("全部")).toEqual(["us", "jp", "kr"]);
    expect(getCountryCandidates("未知")).toEqual(["us", "jp"]);
  });

  it("试听地址强制 https 且拒绝非 Apple 域名", () => {
    expect(normalizePreviewUrl(ITUNES_ITEM.previewUrl)).toBe(
      "https://audio-ssl.itunes.apple.com/itunes-assets/demo.m4a"
    );
    expect(normalizePreviewUrl("https://evil.example.com/a.mp3")).toBeNull();
    expect(normalizePreviewUrl(undefined)).toBeNull();
  });

  it("映射 iTunes 条目标注来源并保留封面 / 年份", () => {
    const track = mapITunesTrack(ITUNES_ITEM, 0, "中国");
    expect(track).not.toBeNull();
    expect(track?.title).toBe("七里香");
    expect(track?.source).toBe("iTunes 在线试听");
    expect(track?.country).toBe("中国");
    expect(track?.year).toBe("2024");
    expect(track?.cover).toContain("300x300bb");
    expect(mapITunesTrack({ trackName: "无试听" }, 0, "中国")).toBeNull();
  });

  it("cn 返回 0 结果时自动回退到 jp 商店", async () => {
    const fetchMock = jest.fn(async (url: any) => {
      const country = new URL(String(url)).searchParams.get("country");
      const body =
        country === "cn"
          ? { resultCount: 0, results: [] }
          : { resultCount: 1, results: [ITUNES_ITEM] };
      return { ok: true, status: 200, json: async () => body } as any;
    });
    global.fetch = fetchMock as any;

    const results = await searchLatestMusic("周杰伦", "中国", 10);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("七里香");
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("浏览最新音乐按发行年份倒序", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        resultCount: 2,
        results: [
          { ...ITUNES_ITEM, trackId: 1, releaseDate: "2020-01-01T00:00:00Z" },
          { ...ITUNES_ITEM, trackId: 2, releaseDate: "2025-01-01T00:00:00Z" },
        ],
      }),
    })) as any;

    const results = await browseMusicByGenre("流行", "欧美", 10);
    expect(results).toHaveLength(2);
    expect(results[0].year).toBe("2025");
  });

  it("音乐电台兜底源映射为可播放的直播曲目", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          stationuuid: "unit-test-1",
          name: "Test Jazz Channel",
          url_resolved: "https://stream.example.test/jazz.mp3",
          codec: "MP3",
          tags: "jazz,music",
          favicon: "https://cdn.example.test/icon.jpg",
        },
      ],
    })) as any;

    const results = await fetchMusicChannels("欧美", "爵士", 10);
    expect(results).toHaveLength(1);
    expect(results[0].isLive).toBe(true);
    expect(results[0].url).toBe("https://stream.example.test/jazz.mp3");
    expect(results[0].source).toBe("radio-browser 音乐电台");
  });
});
