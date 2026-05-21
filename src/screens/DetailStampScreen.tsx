import React from "react";

import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MaterialIcons } from "@expo/vector-icons";

import { useNavigation, useRoute } from "@react-navigation/native";

import type { RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../types/navigation";
import { SKILLS_TAXONOMY } from "../config/skillsTaxonomy";

type StampDetailRouteProp = RouteProp<RootStackParamList, "StampDetails">;

type StampDetailNavigationProp = StackNavigationProp<RootStackParamList, "StampDetails">;

export default function StampDetailScreen() {
  const navigation = useNavigation<StampDetailNavigationProp>();
  const route = useRoute<StampDetailRouteProp>();
  const { stamp, region } = route.params;
  const stamps = SKILLS_TAXONOMY[region];
  const currentIndex = stamps.indexOf(stamp);
  const previousStamp = currentIndex > 0 ? stamps[currentIndex - 1] : null;
  const nextStamp = currentIndex < stamps.length - 1 ? stamps[currentIndex + 1] : null;

  function goToPreviousStamp() {
    if (!previousStamp) return;
    navigation.replace("StampDetails", {
      stamp: previousStamp,
      region,
    });
  }

  function goToNextStamp() {
    if (!nextStamp) return;
    navigation.replace("StampDetails", {
      stamp: nextStamp,
      region,
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.arrowContainer}>
            {previousStamp && (
              <TouchableOpacity onPress={goToPreviousStamp}>
                <MaterialIcons name="chevron-left" size={36} color="#1B3A72" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.headerTitle}>Stamp Detail</Text>

          <View style={styles.arrowContainer}>
            {nextStamp && (
              <TouchableOpacity onPress={goToNextStamp}>
                <MaterialIcons name="chevron-right" size={36} color="#1B3A72" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.badgeContainer}>
          <View style={styles.badgeCircle}>
            <MaterialIcons name="school" size={42} color="#2E6EE6" />
          </View>

          <Text style={styles.title}>{stamp}</Text>

          <Text style={styles.subtitle}>{region}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Evidence</Text>

          <View style={styles.bulletItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>Demonstrated skill in chat</Text>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>Provided evidence for skill</Text>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>Shared an experience pertaining to skill</Text>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>Skill verified by instructor</Text>
          </View>
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
    paddingBottom: 40,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  arrowContainer: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",

    fontSize: 20,
    fontWeight: "700",
    color: "#1B3A72",
  },

  badgeContainer: {
    alignItems: "center",
    marginBottom: 24,
  },

  badgeCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#EEF4FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#D6E4FF",
    marginBottom: 12,
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1B3A72",
    textAlign: "center",
  },

  subtitle: {
    fontSize: 14,
    color: "#6B7A99",
    marginTop: 4,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B3A72",
    marginBottom: 12,
  },

  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },

  bullet: {
    fontSize: 18,
    color: "#2E6EE6",
    marginRight: 8,
    lineHeight: 20,
  },

  bulletText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
});
