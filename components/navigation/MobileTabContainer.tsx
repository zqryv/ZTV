import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, Search, Heart, Settings, Tv, Music2, Radio } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { DeviceUtils } from '@/utils/DeviceUtils';

interface TabItem {
  key: string;
  label: string;
  icon: React.ComponentType<any>;
  route: string;
}

const tabs: TabItem[] = [
  { key: 'home', label: '首页', icon: Home, route: '/' },
  { key: 'live', label: '直播', icon: Tv, route: '/live' },
  { key: 'music', label: '音乐', icon: Music2, route: '/music' },
  { key: 'radio', label: '收音机', icon: Radio, route: '/radio' },
  { key: 'search', label: '搜索', icon: Search, route: '/search' },
  { key: 'favorites', label: '收藏', icon: Heart, route: '/favorites' },
  { key: 'settings', label: '设置', icon: Settings, route: '/settings' },
];

/** 手机端底部胶囊导航展示的项（其余入口由首页分类与顶部按钮进入） */
const MOBILE_TAB_KEYS = ['home', 'live', 'music', 'search', 'settings'];

interface MobileTabContainerProps {
  children: React.ReactNode;
}

const MobileTabContainer: React.FC<MobileTabContainerProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { spacing, deviceType } = useResponsiveLayout();
  
  // 手机端底部胶囊导航只保留 5 个主项，其余入口走首页分类 / 顶部快捷按钮
  const filteredTabs = tabs.filter(tab =>
    deviceType !== 'mobile' || MOBILE_TAB_KEYS.includes(tab.key)
  );
  
  const handleTabPress = (route: string) => {
    if (route === '/') {
      router.push('/');
    } else {
      router.push(route as any);
    }
  };

  const isTabActive = (route: string) => {
    if (route === '/' && pathname === '/') return true;
    if (route !== '/' && pathname === route) return true;
    return false;
  };

  const dynamicStyles = createStyles(spacing);

  return (
    <View style={dynamicStyles.container}>
      {/* 内容区域 */}
      <View style={dynamicStyles.content}>
        {children}
      </View>
      
      {/* 底部导航栏 */}
      <View style={dynamicStyles.tabBar}>
        {filteredTabs.map((tab) => {
          const isActive = isTabActive(tab.route);
          const IconComponent = tab.icon;
          
          return (
            <TouchableOpacity
              key={tab.key}
              style={[dynamicStyles.tab, isActive && dynamicStyles.activeTab]}
              onPress={() => handleTabPress(tab.route)}
              activeOpacity={0.7}
            >
              <IconComponent
                size={20}
                color={isActive ? Colors.brand.onAccent : Colors.text.tertiary}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <Text style={[
                dynamicStyles.tabLabel,
                isActive && dynamicStyles.activeTabLabel
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (spacing: number) => {
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();
  
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    // 胶囊悬浮底栏：沉浸底色 + 圆角，选中项为青绿实心胶囊
    tabBar: {
      flexDirection: 'row',
      backgroundColor: Colors.surface.raised,
      borderTopWidth: 1,
      borderTopColor: Colors.surface.border,
      paddingTop: spacing / 2,
      paddingBottom: Platform.OS === 'ios' ? spacing * 2 : spacing,
      paddingHorizontal: spacing / 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 12,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: minTouchTarget,
      paddingVertical: spacing / 3,
      marginHorizontal: 2,
      borderRadius: 22,
    },
    activeTab: {
      backgroundColor: Colors.brand.accent,
    },
    tabLabel: {
      fontSize: 11,
      color: Colors.text.tertiary,
      marginTop: 2,
      fontWeight: '500',
    },
    activeTabLabel: {
      color: Colors.brand.onAccent,
      fontWeight: '700',
    },
  });
};

export default MobileTabContainer;