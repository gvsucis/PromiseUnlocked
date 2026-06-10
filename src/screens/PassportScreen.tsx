import React, { useState, useCallback } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../types/navigation";
import { REGIONS } from "../config/stampTaxonomy";
import { RadarChart } from "react-native-gifted-charts";
import {
  getMappedCategories,
  ensureAllMappedCategoriesHaveStamps,
} from "../services/categoryStorageService";

type PassportNavigationProp = StackNavigationProp<RootStackParamList, "Passport">;

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

const radarLabels: string[] = REGIONS.map((region) => radarLabelMap[region] ?? region);

export default function PassportScreen() {
  const navigation = useNavigation<PassportNavigationProp>();

  const [radarData, setRadarData] = useState<number[]>(REGIONS.map(() => 0));
  const [regionUnlocks, setRegionUnlocks] = useState<Record<string, string[]>>({});

  const loadData = useCallback(async () => {
    try {
      await ensureAllMappedCategoriesHaveStamps();
      const mappedCategories = await getMappedCategories();

      const unlocks: Record<string, string[]> = {};
      for (const mc of mappedCategories) {
        if (mc.unlockedStamps?.length) {
          unlocks[mc.category] = mc.unlockedStamps.map((s) => s.name);
        }
      }
      setRegionUnlocks(unlocks);

      setRadarData(REGIONS.map((region) => (unlocks[region]?.length ? 100 : 0)));
    } catch {
      // silently keep zeros
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#1B3A72" />
        </TouchableOpacity>
        <Text style={styles.title}>My Passport</Text>

        <View style={styles.radarCard}>
          <Text style={styles.radarTitle}>Growth Radar</Text>
          <RadarChart
            data={radarData}
            labels={radarLabels}
            maxValue={100}
            chartSize={280}
            labelsPositionOffset={30}
            chartContainerProps={{
              height: 380,
              width: 380,
              shiftX: 50,
              shiftY: 50,
            }}
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
            {REGIONS.map((region) => {
              const unlocked = regionUnlocks[region] ?? [];
              return (
                <TouchableOpacity
                  key={region}
                  style={styles.regionItem}
                  onPress={() => navigation.navigate("Stamps", { region })}
                >
                  <View style={styles.iconContainer}>
                    <MaterialIcons
                      name={unlocked.length > 0 ? "check-circle" : "explore"}
                      size={32}
                      color={unlocked.length > 0 ? "#2E6EE6" : "#9BABCF"}
                    />
                  </View>
                  <Text style={styles.regionText}>{region}</Text>
                  {unlocked.length > 0 && (
                    <View style={styles.chipRow}>
                      {unlocked.slice(0, 2).map((name) => (
                        <View key={name} style={styles.chip}>
                          <Text style={styles.chipText} numberOfLines={1}>
                            {name.length > 18 ? name.slice(0, 16) + "…" : name}
                          </Text>
                        </View>
                      ))}
                      {unlocked.length > 2 && (
                        <Text style={styles.moreChip}>+{unlocked.length - 2}</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
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
    paddingTop: 20,
  },

  backButton: {
    marginBottom: 8,
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
    fontSize: 22,
    fontWeight: "700",
    color: "#1B3A72",
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

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 6,
    gap: 4,
  },

  chip: {
    backgroundColor: "#D6E4FF",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  chipText: {
    fontSize: 10,
    color: "#1B3A72",
    fontWeight: "600",
  },

  moreChip: {
    fontSize: 10,
    color: "#6B7A99",
    fontWeight: "600",
    lineHeight: 20,
  },
});
