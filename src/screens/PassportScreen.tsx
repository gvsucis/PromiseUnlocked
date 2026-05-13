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
import { SKILLS_TAXONOMY } from "../config/skillsTaxonomy";

export default function PassportScreen({ navigation }) {
  const regions = Object.keys(SKILLS_TAXONOMY);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Title */}
        <Text style={styles.title}>My Passport</Text>

        {/* Radar Placeholder Card */}
        <View style={styles.radarCard}>
          <Text style={styles.radarTitle}>Growth Radar</Text>
          <Text style={styles.radarPlaceholder}>
            Radar chart will go here
          </Text>
        </View>

        {/* Regions Card */}
        <View style={styles.regionsCard}>
          <Text style={styles.sectionTitle}>Explore Regions</Text>

          <View style={styles.grid}>
            {regions.map((region) => (
              <TouchableOpacity
                key={region}
                style={styles.regionItem}
                onPress={() =>
                    navigation.navigate("Stamps", {
                        region: region,
                    })
                }
              >
                <View style={styles.iconCircle}>
                  <MaterialIcons
                    name="explore"
                    size={26}
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

  /* --- Radar Card --- */
  radarCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    height: 180,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,

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
    color: "#6B7A99",
    fontSize: 13,
  },

  /* --- Regions Card --- */
  regionsCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
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
    marginBottom: 12,
  },

  /* Grid */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },

  regionItem: {
    width: "33.33%", // 3 per row
    alignItems: "center",
    marginBottom: 16,
  },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EEF4FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#D6E4FF",
  },

  regionText: {
    fontSize: 11,
    textAlign: "center",
    color: "#1B3A72",
    fontWeight: "500",
  },
});