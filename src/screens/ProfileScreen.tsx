import React from "react";
import { SafeAreaView, ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import ProfileOverviewCard from "../components/ProfileOverviewCard";

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>My Universities</Text>
        <Text style={styles.screenSubtitle}>
          Explore your favorite universities and take actionable steps!
        </Text>

        <ProfileOverviewCard
          name="Sample Student"
          school="Hometown High School"
          title="Future Software Developer"
          bio="I am on a journey to become a full-stack engineer with project-based milestones."
        />

        <View style={styles.cardsRow}>
          <TouchableOpacity style={styles.actionCard} onPress={() => {}}>
            <MaterialIcons name="sports-basketball" size={38} color="#ffffff" />
            <Text style={styles.actionTitle}>My Experiences</Text>
            <Text style={styles.actionSub}>Track your journey</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionCard, styles.passportCard]} onPress={() => {}}>
            <MaterialIcons name="card-travel" size={38} color="#ffffff" />
            <Text style={styles.actionTitle}>Passport</Text>
            <Text style={styles.actionSub}>View your stamps</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EBF2FF",
  },
  content: {
    padding: 16,
    paddingTop: 12,
  },
  screenTitle: {
    fontSize: 26,
    color: "#1B3A72",
    fontWeight: "bold",
    marginBottom: 6,
    textAlign: "center",
  },
  screenSubtitle: {
    fontSize: 14,
    color: "#4A5A78",
    marginBottom: 16,
    textAlign: "center",
  },
  cardsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
  },
  actionCard: {
    flex: 1,
    backgroundColor: "#2E6EE6",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 150,
    marginBottom: 16,
    marginHorizontal: 2,
  },
  passportCard: {
    backgroundColor: "#0D47A1",
  },

  actionTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  actionSub: {
    fontSize: 12,
    color: "#DDDDFF",
    marginTop: 4,
    textAlign: "center",
  },
});
