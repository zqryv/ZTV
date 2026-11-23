import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import MobileTabContainer from './MobileTabContainer';
import TabletSidebarNavigator from './TabletSidebarNavigator';

interface ResponsiveNavigationProps {
  children: React.ReactNode;
}

const ResponsiveNavigation: React.FC<ResponsiveNavigationProps> = ({ children }) => {
  const { deviceType } = useResponsiveLayout();

  switch (deviceType) {
    case 'mobile':
      // 手机端（iOS / Android 手机）使用底部 Tab 容器
      return <MobileTabContainer>{children}</MobileTabContainer>;

    case 'tablet':
      // 平板端（iPad / Android 平板）使用可折叠侧边栏
      return (
        <TabletSidebarNavigator>
          {children}
        </TabletSidebarNavigator>
      );

    case 'desktop':
      // 桌面端（Windows / Ubuntu / macOS）同样使用侧边栏，
      // 桌面宽度更大、以鼠标/键盘为主，侧边栏默认展开获得最高信息密度
      return (
        <TabletSidebarNavigator>
          {children}
        </TabletSidebarNavigator>
      );

    case 'tv':
    default:
      // TV 端（Apple TV / Android TV）保持 Stack 导航 + 遥控器焦点，无需额外容器
      return <>{children}</>;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});

export default ResponsiveNavigation;