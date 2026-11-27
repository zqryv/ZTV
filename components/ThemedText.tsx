import {Text, type TextProps} from 'react-native';

import {useThemeColor} from '@/hooks/useThemeColor';
import {useTextStyles} from '@/hooks/useTextStyles';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

/**
 * v2.4.0 大屏适配：关闭系统字体缩放。
 * 电视 / 投影仪厂商常把「显示大小」设为 1.2~1.5×，RN Text 默认
 * allowFontScaling=true 会连同 lineHeight 一起放大，导致布局撑破容器、
 * 内容显示不完整。字号统一由 utils/LargeScreen.ts 标尺按分辨率管理。
 */
export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({light: lightColor, dark: darkColor}, 'text');
  const styles = useTextStyles();

  return (
    <Text
      allowFontScaling={false}
      maxFontSizeMultiplier={1}
      style={[
        {color},
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}
