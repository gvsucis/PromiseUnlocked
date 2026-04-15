import React from "react";
import { ScrollView, View, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "@/components/ui/text";

export default function ProfileScreen() {
  return (
    <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <MaterialIcons name="school" size={40} color="#fff" />
          <Text style={styles.title}>My Universities</Text>
          <Text style={styles.subtitle}>
            Explore your favorite universities and take actionable steps!
          </Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarCircle}>
              <MaterialIcons name="person" size={32} color="#ffffff" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.studentName}>Sample Student</Text>
              <Text style={styles.school}>Hometown High School</Text>
              <Text style={styles.role}>Future Software Developer</Text>
            </View>
          </View>

          <Text style={styles.bio}>
            I am on a journey to become a full-stack engineer with project-based milestones.
          </Text>

          <TouchableOpacity style={styles.editButton} onPress={() => {}}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionCardsContainer}>
          <TouchableOpacity style={styles.actionCard}>
            <MaterialIcons name="public" size={36} color="#ffffff" />
            <Text style={styles.actionCardTitle}>My Experiences</Text>
            <Text style={styles.actionCardSubtitle}>Track your journey</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <MaterialIcons name="card-travel" size={36} color="#ffffff" />
            <Text style={styles.actionCardTitle}>Passport</Text>
            <Text style={styles.actionCardSubtitle}>View your stamps</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  headerSection: {
    marginBottom: 24,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 5,
    textAlign: "center",
  },
  profileCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: "row",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
    justifyContent: "center",
  },
  studentName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
  },
  school: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
  },
  role: {
    fontSize: 13,
    fontWeight: "600",
    color: "#667eea",
    marginTop: 4,
  },
  bio: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
    marginBottom: 16,
  },
  editButton: {
    backgroundColor: "#667eea",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  editButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  actionCardsContainer: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: "#667eea",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ffffff",
    marginTop: 12,
    textAlign: "center",
  },
  actionCardSubtitle: {
    fontSize: 12,
    color: "#dbeafe",
    marginTop: 4,
    textAlign: "center",
  },
});
