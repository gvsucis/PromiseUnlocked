import React, { useState, useCallback } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../types/navigation";
import { REGIONS } from "../config/stampTaxonomy";
import { RadarChart } from "react-native-gifted-charts";
import { fetchMyStamps, getCachedStamps, type StampEntry } from "../services/stampSyncService";
import { listenToPassport, type PassportData } from "../services/passportSyncService";
import { getCategoryIdFromName } from "../services/categoryTaxonomyService";
import { colors } from "../styles/global";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEFAULT_TIER } from "../config/stampConstants";

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
const TIER_TARGET_PER_REGION = 3;
const RADAR_FLOOR = 8;

export default function PassportScreen() {
  const navigation = useNavigation<PassportNavigationProp>();

  const { session } = useAuth();

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => void signOut(auth).then(() => navigation.replace("Welcome")),
      },
    ]);
  };

  const [radarData, setRadarData] = useState<number[]>(REGIONS.map(() => RADAR_FLOOR));
  const [regionUnlocks, setRegionUnlocks] = useState<Record<string, string[]>>({});

  const applyStamps = useCallback((stamps: StampEntry[]) => {
    const byCategory = new Map<string, StampEntry[]>();
    for (const s of stamps) {
      const existing = byCategory.get(s.category);
      if (existing) {
        existing.push(s);
      } else {
        byCategory.set(s.category, [s]);
      }
    }

    const unlocks: Record<string, string[]> = {};
    const tierPoints: Record<string, number> = {};

    for (const [category, stampsInCat] of byCategory) {
      const uniqueNames = [...new Set(stampsInCat.map((s) => s.stampName))];
      const maxTier = stampsInCat.reduce((max, s) => Math.max(max, s.tier ?? DEFAULT_TIER), 0);
      unlocks[category] = uniqueNames;
      tierPoints[category] = maxTier;
    }

    setRegionUnlocks(unlocks);

    setRadarData(
      REGIONS.map((region) => {
        const points = tierPoints[region] ?? 0;
        const pct = Math.min(100, (points / TIER_TARGET_PER_REGION) * 100);
        return Math.max(pct, RADAR_FLOOR);
      })
    );
  }, []);

  const loadData = useCallback(async () => {
    try {
      const stamps = await fetchMyStamps();
      const cached = stamps.length > 0 ? stamps : await getCachedStamps();
      applyStamps(cached);
    } catch {
      // silently keep zeros
    }
  }, [applyStamps]);

  useFocusEffect(
    useCallback(() => {
      loadData();

      if (session.mode !== "authenticated" || !session.uid) return;

      return listenToPassport(session.uid, (data: PassportData) => {
        const categoryNameById = new Map(data.categories.map((c) => [c.categoryId, c.category]));
        const stamps: StampEntry[] = data.stamps.map((s) => ({
          ...s,
          category: s.category || categoryNameById.get(s.categoryId) || "",
        }));
        applyStamps(stamps);
      });
    }, [loadData, applyStamps, session.mode, session.uid])
  );

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.floatingButtons} pointerEvents="box-none">
          <TouchableOpacity onPress={handleLogout} style={styles.floatingButton}>
            <MaterialIcons
              name={session.mode === "authenticated" ? "logout" : "person"}
              size={24}
              color={colors.brand.primary}
            />
          </TouchableOpacity>
        </View>

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
              stroke: colors.accent.sky,
              strokeWidth: 2,
              fill: "rgba(46, 110, 230, 0.18)",
              showGradient: false,
              opacity: 1,
            }}
            gridConfig={{
              stroke: colors.border.accent,
              strokeWidth: 1,
              showGradient: false,
              fill: colors.background.tinted,
            }}
            labelConfig={{
              fontSize: 10,
              stroke: colors.text.primary,
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
                  onPress={() => {
                    const catId = getCategoryIdFromName(region);
                    navigation.navigate("Stamps", { region, categoryId: catId });
                  }}
                >
                  <View style={styles.iconContainer}>
                    <MaterialIcons
                      name={unlocked.length > 0 ? "check-circle" : "explore"}
                      size={32}
                      color={unlocked.length > 0 ? colors.accent.sky : colors.text.muted}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.tinted,
    paddingTop: 52,
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
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 16,
    paddingTop: 60,
  },

  radarCard: {
    backgroundColor: colors.background.card,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 18,
    shadowColor: colors.accent.sky,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  radarTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text.primary,
  },

  regionsCard: {
    backgroundColor: colors.background.card,
    borderRadius: 20,
    padding: 16,
    shadowColor: colors.accent.sky,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 14,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  regionItem: {
    width: "48%",
    backgroundColor: colors.background.base,
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 12,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border.accent,
  },

  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: colors.background.tinted,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },

  regionText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.primary,
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
    backgroundColor: colors.border.accent,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  chipText: {
    fontSize: 10,
    color: colors.accent.skyDark,
    fontWeight: "600",
  },

  moreChip: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: "600",
    lineHeight: 20,
  },
  floatingButtons: {
    position: "absolute",
    top: 0,
    right: 16,
    flexDirection: "row",
    gap: 8,
    zIndex: 10,
  },
  floatingButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
