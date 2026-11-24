import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import MobileTabContainer from './MobileTabContainer';
import TabletSidebarNavigator from './TabletSidebarNavigator';

interface ResponsiveNavigationProps {
  children: React.ReactNode;
}

/**
 * 统一导航容器：
 * - 单屏手机 / 折叠态手机 → 底部 Tab（拇指可达）
 * - 二折/三折展开态、平板、桌面 → 侧边栏（大屏信息密度）
 * - 电视 / 机顶盒 → Stack + 遥控器焦点
 */
const ResponsiveNavigation: React.FC<ResponsiveNavigationProps> = ({ children }) => {
  const { deviceType, deviceForm, foldState } = useResponsiveLayout();

  // 折叠屏完全折叠时强制底部 Tab，避免物理宽度抖动导致导航频繁切换
  if (foldState === 'folded') {
    return <MobileTabContainer>{children}</MobileTabContainer>;
  }

  // 机顶盒与电视共享遥控器交互，不套用触摸导航容器
  if (deviceForm === 'setTopBox' || deviceType === 'tv') {
    return <>{children}</>;
  }

  switch (deviceType) {
    case 'mobile':
      return <MobileTabContainer>{children}</MobileTabContainer>;

    case 'tablet':
    case 'desktop':
    default:
      return <TabletSidebarNavigator>{children}</TabletSidebarNavigator>;
  }
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
});

export default ResponsiveNavigation;
