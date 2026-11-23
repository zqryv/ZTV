import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, Heart, Search, Settings, Tv, Music2, Radio } from 'lucide-react-native';
import { ThemedText } from '@/components/ThemedText';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { DeviceUtils } from '@/utils/DeviceUtils';
import { Colors } from '@/constants/Colors';

interface NavigationItem {
  name: string;
  label: string;
  icon: any;
  route: string;
}

const navigationItems: NavigationItem[] = [
  { name: 'home', label: '首页', icon: Home, route: '/' },
  { name: 'live', label: '直播', icon: Tv, route: '/live' },
  { name: 'music', label: '音乐', icon: Music2, route: '/music' },
  { name: 'radio', label: '收音机', icon: Radio, route: '/radio' },
  { name: 'search', label: '搜索', icon: Search, route: '/search' },
  { name: 'favorites', label: '收藏', icon: Heart, route: '/favorites' },
  { name: 'settings', label: '设置', icon: Settings, route: '/settings' },
];


interface MobileBottomNavigationProps {
  colorScheme?: 'light' | 'dark';
}

export const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({
  colorScheme = 'dark',
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const responsiveConfig = useResponsiveLayout();

  // Only show on mobile devices
  if (responsiveConfig.deviceType !== 'mobile') {
    return null;
  }

  // 手机端底部胶囊导航只保留 5 个主项
  const MOBILE_KEYS = ['home', 'live', 'music', 'search', 'settings'];
  const filteredNavigationItems = navigationItems.filter(item =>
    responsiveConfig.deviceType !== 'mobile' || MOBILE_KEYS.includes(item.name)
  );

  const handleNavigation = (route: string) => {
    if (route === '/') {
      router.push('/');
    } else {
      router.push(route as any);
    }
  };

  const isActiveRoute = (route: string) => {
    if (route === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(route);
  };

  // 统一使用设计系统令牌：青绿主色 + 沉浸底色
  const activeColor = Colors.brand.onAccent;
  const inactiveColor = Colors.text.tertiary;
  const backgroundColor = Colors.surface.raised;

  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor,
      borderTopColor: Colors.surface.border,
    },
  });

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      {filteredNavigationItems.map((item) => {
        const isActive = isActiveRoute(item.route);
        const IconComponent = item.icon;

        return (
          <TouchableOpacity
            key={item.name}
            style={[styles.tabItem, isActive && styles.tabItemActive]}
            onPress={() => handleNavigation(item.route)}
            activeOpacity={0.7}
          >
            <IconComponent
              size={22}
              color={isActive ? activeColor : inactiveColor}
            />
            <ThemedText
              style={[
                styles.tabLabel,
                { color: isActive ? activeColor : inactiveColor },
              ]}
            >
              {item.label}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 84, // 49 + 35 for safe area
    paddingBottom: 35, // Safe area padding
    paddingTop: 8,
    paddingHorizontal: 8,
    borderTopWidth: 0.5,
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginHorizontal: 2,
    borderRadius: 22,
    minHeight: DeviceUtils.getMinTouchTargetSize(),
  },
  tabItemActive: {
    backgroundColor: Colors.brand.accent,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default MobileBottomNavigation;