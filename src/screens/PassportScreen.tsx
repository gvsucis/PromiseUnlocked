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
import { RadarChart } from "react-native-gifted-charts";

type PassportNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Passport"
>;

export default function PassportScreen() {
  const navigation = useNavigation<PassportNavigationProp>();

  const regions = Object.keys(SKILLS_TAXONOMY);

  const radarLabelMap: Record<string, string> = {
  "Human Skills (Durable)": "Human Skills",
  "Creative Expression & Communication": "Creative",
  "Problem-Solving & Systems Thinking": "Problem-Solving",
  "Work & Entrepreneurial Experience": "Work & Entrepreneurship",
  "Future Self & Directionality": "Future Self",
  "Meta-Learning & Self-Awareness": "Meta-Learning",
  "Maker & Builder Skills": "Maker & Builder",
  "Civic & Community Impact": "Civic & Community",
  "Digital & Tech Fluency": "Tech Fluency",
  "Wellbeing & Personal Resilience": "Wellbeing",
  "Faith, Culture & Identity": "Faith & Culture",
};

const radarLabels: string[] = regions.map(
  (region) => radarLabelMap[region] ?? region
);

  // data must be number[] — swap 0s for real scores (0–100) when ready
  const radarData: number[] = regions.map(() => 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <Text style={styles.title}>My Passport</Text>

        <View style={styles.radarCard}>
          <Text style={styles.radarTitle}>Growth Radar</Text>
          <RadarChart
            data={radarData}
            labels={radarLabels}
            maxValue={100}
            chartSize={280}
            labelsPositionOffset={20}
            polygonConfig={{
              stroke: "#2E6EE6",
              strokeWidth: 2,
              fill: "rgba(46, 110, 230, 0.18)",
              showGradient: false,
              opacity: 1,
            }}
            gridConfig={{
              stroke: "#D6E4FF",
              strokeWidth: 1,
              showGradient: false,
              fill: "#F0F5FF",
            }}
            labelConfig={{
              fontSize: 10,
              stroke: "#1B3A72",
              fontWeight: "600",
            }}
          />
        </View>

        <View style={styles.regionsCard}>
          <Text style={styles.sectionTitle}>Explore Regions</Text>
          <View style={styles.grid}>
            {regions.map((region) => (
              <TouchableOpacity
                key={region}
                style={styles.regionItem}
                onPress={() => navigation.navigate("Stamps", { region })}
              >
                <View style={styles.iconContainer}>
                  <MaterialIcons name="explore" size={32} color="#2E6EE6" />
                </View>
                <Text style={styles.regionText}>{region}</Text>
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
    marginBottom: 12,
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