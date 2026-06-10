import React from "react";
import { View, StyleSheet, TouchableOpacity, Text, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import DialogueDashboardScreen from "../screens/DialogueDashboardScreen";
import ProfileScreen from "../screens/ProfileScreen";
import HelpScreen from "../screens/HelpScreen";

function ChatScreen() {
  return (
    <View style={placeholderStyles.container}>
      <MaterialIcons name="chat-bubble-outline" size={48} color="#c7c2d8" />
      <Text style={placeholderStyles.title}>This will be a modal, not a screen.</Text>
    </View>
  );
}

//Placeholder for Typescript
function SocialScreen() {
  return (
    <View style={placeholderStyles.container}>
      <MaterialIcons name="people-outline" size={48} color="#c7c2d8" />
      <Text style={placeholderStyles.title}>Social</Text>
    </View>
  );
}

const Tab = createBottomTabNavigator();

const TAB_CONFIG = [
  {
    name: "Dashboard",
    component: DialogueDashboardScreen,
    icon: "explore",
    label: "Dashboard",
    size: 32,
    enabled: true,
  },
  {
    name: "Profile",
    component: ProfileScreen,
    icon: "person-outline",
    label: "Profile",
    size: 32,
    enabled: true,
  },
  {
    name: "Chat",
    component: ChatScreen,
    icon: "add-circle-outline",
    label: "Chat",
    size: 48,
    enabled: true,
  },
  {
    name: "Social",
    component: SocialScreen,
    icon: "people-outline",
    label: "Social",
    size: 32,
    enabled: false,
  },
  {
    name: "Help",
    component: HelpScreen,
    icon: "error-outline",
    label: "Help",
    size: 32,
    enabled: true,
  },
] as const;

function CustomTabBar({ state, descriptors, navigation }: any) {
  return (
    <View style={styles.tabBar}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const config = TAB_CONFIG[index];
        const isFocused = state.index === index;
        const isDisabled = !config.enabled;

        const onPress = () => {
          if (isDisabled) return;
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            activeOpacity={isDisabled ? 1 : 0.7}
            style={styles.tabItem}
          >
            <View style={[styles.iconWrap]}>
              <MaterialIcons
                name={config.icon as any}
                size={config.size ?? 32}
                color={isDisabled ? "#d1cde8" : isFocused ? "#6d5efc" : "#8e89a8"}
              />
              {isDisabled && (
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>Soon</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {TAB_CONFIG.map((tab) => (
        <Tab.Screen key={tab.name} name={tab.name} component={tab.component} />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#f0eef8",
    height: 110,
    paddingHorizontal: 4,
    shadowColor: "#6d5efc",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 14,
  },
  iconWrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    position: "relative",
  },
  comingSoonBadge: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: "#ede9fe",
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  comingSoonText: {
    fontSize: 8,
    color: "#8b7fd4",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

const placeholderStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#faf9ff",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#3d3558",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#a89ec4",
  },
});
