import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

type ProfileOverviewCardProps = {
  name: string;
  school: string;
  title: string;
  bio?: string;
};

export default function ProfileOverviewCard({
  name,
  school,
  title,
  bio,
}: ProfileOverviewCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.avatarCircle}>
          <MaterialIcons name="person" size={36} color="#ffffff" />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.school}>{school}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>
      <Text style={styles.bio}>{bio || "(Enter your bio for XP)"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  school: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  title: {
    fontSize: 14,
    color: "#2196F3",
    marginTop: 2,
    fontWeight: "600",
  },
  bio: {
    fontSize: 13,
    color: "#555",
    marginTop: 8,
    lineHeight: 18,
  },
});
