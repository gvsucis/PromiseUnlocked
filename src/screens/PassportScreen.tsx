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
const HEADER_HEIGHT = 130;

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
              color={colors.text.inverse}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.headerContainer}>
          <View style={styles.headerClip}>
            <View style={styles.headerCircle} />
            <Text style={styles.headerTitle}>My Passport</Text>
          </View>
        </View>

        <View style={styles.radarCard}>
          <Text style={styles.radarTitle}>My Skills</Text>
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
              stroke: colors.accent.coral,
              strokeWidth: 2,
              fill: colors.accent.coralLight,
              showGradient: false,
              opacity: 1,
            }}
            gridConfig={{
              stroke: colors.border.medium,
              strokeWidth: 1,
              showGradient: false,
              fill: colors.background.base,
            }}
            labelConfig={{
              fontSize: 10,
              stroke: colors.text.primary,
              fontWeight: "600",
            }}
          />
        </View>

        <Text style={styles.sectionTitle}>Explore Regions</Text>
        <View style={styles.list}>
          {REGIONS.map((region) => {
            const unlocked = regionUnlocks[region] ?? [];
            const isUnlocked = unlocked.length > 0;
            return (
              <TouchableOpacity
                key={region}
                style={[styles.regionItem, isUnlocked && styles.regionItemUnlocked]}
                onPress={() => {
                  const catId = getCategoryIdFromName(region);
                  navigation.navigate("Stamps", { region, categoryId: catId });
                }}
              >
                <Text style={isUnlocked ? styles.regionTextUnlocked : styles.regionTextLocked}>
                  {region}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand.primary,
  },

  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    backgroundColor: colors.background.subtle,
  },

  backButton: {
    marginBottom: 8,
  },

  headerContainer: {
    marginHorizontal: -16,
    alignItems: "center",
    marginBottom: 18,
  },

  headerClip: {
    width: "100%",
    height: HEADER_HEIGHT,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  headerCircle: {
    width: 900,
    height: 900,
    borderRadius: 450,
    backgroundColor: colors.brand.primary,
    position: "absolute",
    top: -900 + HEADER_HEIGHT,
  },

  headerTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text.inverse,
  },

  radarCard: {
    backgroundColor: colors.background.card,
    borderRadius: 20,
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
    paddingTop: 38,
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
    marginBottom: 10,
    marginTop: 4,
  },

  list: {
    gap: 12,
  },

  regionItem: {
    width: "100%",
    minHeight: 250,
    backgroundColor: colors.background.card,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.medium,
    shadowColor: colors.accent.sky,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  regionItemUnlocked: {
    backgroundColor: colors.accent.skyLighter,
    borderColor: colors.brand.primary,
  },

  regionTextLocked: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.text.secondary,
    textAlign: "center",
  },

  regionTextUnlocked: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.accent.skyDark,
    textAlign: "center",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
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
