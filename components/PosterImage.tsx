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
 * 1) 豆瓣等返回的完整 http(s) 外链直接加载；
 * 2) 失败后走 API 服务器的 image-proxy；
 * 3) 都失败则显示占位图。
 * 这样即使未配置 API 或服务器代理不可用，海报也不会是空白。
 */
const PosterImage: React.FC<PosterImageProps> = ({ poster, api, style }) => {
  const candidates = useMemo(() => {
    const raw = (poster || "").trim();
    const list: string[] = [];
    if (/^https?:\/\//i.test(raw)) {
      list.push(raw);
    }
    const proxied = api.getImageProxyUrl(raw);
    // 只保留绝对 URL，避免把 "/api/image-proxy?..." 这种相对路径交给 Image 导致无法解析
    if (proxied && /^https?:\/\//i.test(proxied)) {
      list.push(proxied);
    }
    return list.filter((url, i) => url && list.indexOf(url) === i);
  }, [poster, api]);

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
