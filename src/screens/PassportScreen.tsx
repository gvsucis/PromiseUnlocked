import React from "react";

import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../types/navigation";
import { SKILLS_TAXONOMY } from "../config/skillsTaxonomy";

type PassportNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Passport"
>;

export default function PassportScreen() {
  const navigation =
    useNavigation<PassportNavigationProp>();

  const regions = Object.keys(SKILLS_TAXONOMY);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <Text style={styles.title}>
          My Passport
        </Text>

        <View style={styles.radarCard}>
          <Text style={styles.radarTitle}>
            Growth Radar
          </Text>
          <Text style={styles.radarPlaceholder}>
            Radar chart will go here
          </Text>
        </View>

        <View style={styles.regionsCard}>
          <Text style={styles.sectionTitle}>
            Explore Regions
          </Text>
          <View style={styles.grid}>
            {regions.map((region) => (
              <TouchableOpacity
                key={region}
                style={styles.regionItem}
                onPress={() =>
                  navigation.navigate("Stamps", {
                    region,
                  })
                }
              >
                <View style={styles.iconContainer}>
                  <MaterialIcons
                    name="explore"
                    size={32}
                    color="#2E6EE6"
                  />
                </View>
                <Text style={styles.regionText}>
                  {region}
                </Text>
              </TouchableOpacity>
            ))}
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

  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1B3A72",
    textAlign: "center",
    marginBottom: 16,
  },

  radarCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    height: 180,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  radarTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B3A72",
    marginBottom: 8,
  },

  radarPlaceholder: {
    fontSize: 13,
    color: "#6B7A99",
  },

  regionsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B3A72",
    marginBottom: 14,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  regionItem: {
    width: "48%",
    backgroundColor: "#F7FAFF",
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 12,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#D6E4FF",
  },

  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: "#EEF4FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },

  regionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1B3A72",
    textAlign: "center",
  },
});