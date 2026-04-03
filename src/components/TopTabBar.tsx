import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

type TabItem = {
  key: string;
  title: string;
  onPress: () => void;
};

type TopTabBarProps = {
  tabs: TabItem[];
  containerStyle?: object;
};

export default function TopTabBar({ tabs, containerStyle }: TopTabBarProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.rowContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabButton}
            onPress={tab.onPress}
            activeOpacity={0.6}
          >
            <Text style={styles.tabText}>{tab.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 12,
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  rowContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "nowrap",
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
});
