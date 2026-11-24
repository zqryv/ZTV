import React, { useState, useEffect, useMemo } from "react";
import { Image, View, StyleSheet } from "react-native";
import { Film } from "lucide-react-native";
import { API } from "@/services/api";
import { Colors } from "@/constants/Colors";

interface PosterImageProps {
  poster: string;
  api: API;
  style?: any;
}

/**
 * 海报图片，带多级回退：
 * 1) 已配置 API 时优先走服务器 image-proxy（豆瓣图床在部分网络下直连很慢/被拦截，
 *    代理由服务器转发，命中率与速度都更高）；
 * 2) 代理失败再尝试外链直连；
 * 3) 都失败则显示占位图。
 * 这样即使未配置 API 或服务器代理不可用，海报也不会是空白。
 */
const PosterImage: React.FC<PosterImageProps> = ({ poster, api, style }) => {
  const candidates = useMemo(() => {
    const raw = (poster || "").trim();
    const list: string[] = [];
    const proxied = api.getImageProxyUrl(raw);
    // 仅在 baseURL 有效时代理地址才是绝对 URL。
    // 已配置 API 时把代理放在首位，避免外链直连超时后才回退造成的慢加载。
    if (api.baseURL && proxied && /^https?:\/\//i.test(proxied)) {
      list.push(proxied);
    }
    if (/^https?:\/\//i.test(raw)) {
      list.push(raw);
    }
    return list.filter((url, i) => url && list.indexOf(url) === i);
  }, [poster, api, api.baseURL]);

  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setIndex(0);
    setFailed(false);
  }, [poster]);

  if (failed || candidates.length === 0) {
    return (
      <View style={[style, styles.placeholder]}>
        <Film size={36} color="#666" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: candidates[index] }}
      style={style}
      resizeMode="cover"
      onError={() => {
        if (index + 1 < candidates.length) {
          setIndex(index + 1);
        } else {
          setFailed(true);
        }
      }}
    />
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default PosterImage;
