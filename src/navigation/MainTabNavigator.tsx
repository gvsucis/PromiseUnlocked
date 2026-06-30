import React from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import DialogueDashboardScreen, { dialogueBridgeRef } from "../screens/DialogueDashboardScreen";
import ProfileScreen from "../screens/ProfileScreen";
import PassportScreen from "../screens/PassportScreen";
import HelpScreen from "../screens/HelpScreen";
import { colors } from "../styles/global";
function ChatScreen() {
  return (
    <View style={placeholderStyles.container}>
      <MaterialIcons name="chat-bubble-outline" size={48} color="#c7c2d8" />
      <Text style={placeholderStyles.title}>This will be a modal, not a screen.</Text>
    </View>
  );
}

const Tab = createBottomTabNavigator();

const TAB_CONFIG = [
  {
    name: "Dashboard",
    component: DialogueDashboardScreen,
    icon: "dashboard",
    label: "Dashboard",
    size: 32,
  },
  {
    name: "Profile",
    component: ProfileScreen,
    icon: "person-outline",
    label: "Profile",
    size: 32,
  },
  {
    name: "Chat",
    component: ChatScreen,
    icon: "add-circle-outline",
    label: "Chat",
    size: 48,
  },
  {
    name: "Passport",
    component: PassportScreen,
    icon: "explore",
    label: "Passport",
    size: 32,
  },
  {
    name: "Help",
    component: HelpScreen,
    icon: "error-outline",
    label: "Help",
    size: 32,
  },
] as const;

function CustomTabBar({ state, descriptors, navigation }: any) {
  return (
    <View style={styles.tabBar}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const config = TAB_CONFIG[index];
        const isFocused = state.index === index;

        const onPress = () => {
          if (config.name === "Chat") {
            navigation.getParent()?.navigate("MainTabs", { screen: "Dashboard" });
            setTimeout(() => dialogueBridgeRef.current?.handleForceNewQuestion(), 300);
            return;
          }
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
            activeOpacity={0.7}
            style={styles.tabItem}
          >
            <View style={styles.iconWrap}>
              <MaterialIcons
                name={config.icon as any}
                size={config.size ?? 32}
                color={isFocused ? colors.accent.sky : colors.text.muted}
              />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function MainTabNavigator() {
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        {TAB_CONFIG.map((tab) => (
          <Tab.Screen key={tab.name} name={tab.name} component={tab.component} />
        ))}
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.background.base,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    height: 110,
    paddingHorizontal: 4,
    shadowColor: colors.accent.sky,
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
  // FIXME: POC floating buttons — remove when proper header/context solution is in place
  floatingButtons: {
    position: "absolute",
    top: 52,
    right: 16,
    flexDirection: "row",
    gap: 8,
  },
  floatingButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
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
