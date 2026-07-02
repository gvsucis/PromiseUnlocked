import React, { useState, useCallback, useRef } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../types/navigation";
import { computeDerivedSkills, REGIONS } from "../config/stampTaxonomy";
import { DEFAULT_TIER } from "../config/stampConstants";
import StampBadge from "../components/stamps/StampBadge";
import { QuestionInputModal } from "../components/dialogue/QuestionInputModal";
import { GeminiService } from "../services/geminiService";
import {
  getFilteredTaxonomyString,
  getCategoryIdFromName,
} from "../services/categoryTaxonomyService";
import { dialogueBridgeRef } from "./DialogueDashboardScreen";
import ConfettiCannon from "react-native-confetti-cannon";
import { StampUnlockModal } from "../components/dialogue/StampUnlockModal";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getMappedCategories,
  ensureAllMappedCategoriesHaveStamps,
} from "../services/categoryStorageService";

import { colors } from "../styles/global";
const DERIVED_SKILLS = computeDerivedSkills();

function findNearestWithUnlocks(
  list: string[],
  start: number,
  step: number,
  hasUnlocks: Set<string>
): string | null {
  for (let i = start + step; i >= 0 && i < list.length; i += step) {
    if (hasUnlocks.has(list[i])) return list[i];
  }
  return null;
}

type StampRouteProp = RouteProp<RootStackParamList, "Stamps">;
type StampNavigationProp = StackNavigationProp<RootStackParamList, "Stamps">;

export default function StampScreen() {
  const navigation = useNavigation<StampNavigationProp>();

  const route = useRoute<StampRouteProp>();
  const { region, categoryId } = route.params;
  const currentIndex = REGIONS.indexOf(region);

  const [unlockedStamps, setUnlockedStamps] = useState<Set<string>>(new Set());
  const [stampCounts, setStampCounts] = useState<Record<string, number>>({});
  const [stampTiers, setStampTiers] = useState<Record<string, number>>({});
  const [prevRegion, setPrevRegion] = useState<string | null>(null);
  const [nextRegion, setNextRegion] = useState<string | null>(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [generatedQuestion, setGeneratedQuestion] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  // Questions already asked for this region, so the model avoids repeating them.
  const askedQuestionsRef = useRef<string[]>([]);
  const [localStampUnlock, setLocalStampUnlock] = useState<{
    stamp: string;
    category: string;
    tier: number;
  } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const { width } = Dimensions.get("window");

  const loadUnlocked = useCallback(async () => {
    await ensureAllMappedCategoriesHaveStamps();
    const mappedCategories = await getMappedCategories();

    const regionsWithUnlocks = new Set<string>();
    const names = new Set<string>();

    const counts: Record<string, number> = {};
    const tiers: Record<string, number> = {};
    for (const mc of mappedCategories) {
      if (!mc.unlockedStamps?.length) continue;
      regionsWithUnlocks.add(mc.category);
      for (const s of mc.unlockedStamps) {
        const stampCategory = s.category || mc.category;
        if (stampCategory !== region) continue;
        names.add(s.name);
        counts[s.name] = s.timesUnlocked;
        tiers[s.name] = s.tier ?? DEFAULT_TIER;
      }
    }

    setUnlockedStamps(names);
    setStampCounts(counts);
    setStampTiers(tiers);
    setPrevRegion(findNearestWithUnlocks(REGIONS, currentIndex, -1, regionsWithUnlocks));
    setNextRegion(findNearestWithUnlocks(REGIONS, currentIndex, 1, regionsWithUnlocks));
  }, [region, currentIndex]);

  useFocusEffect(
    useCallback(() => {
      loadUnlocked();
    }, [loadUnlocked])
  );

  function goToPreviousRegion() {
    if (!prevRegion) return;
    const prevCategoryId = getCategoryIdFromName(prevRegion);
    navigation.replace("Stamps", { region: prevRegion, categoryId: prevCategoryId });
  }

  function goToNextRegion() {
    if (!nextRegion) return;
    const nextCategoryId = getCategoryIdFromName(nextRegion);
    navigation.replace("Stamps", { region: nextRegion, categoryId: nextCategoryId });
  }

  const handleGenerateQuestion = useCallback(async () => {
    setIsGenerating(true);
    try {
      const filteredTaxonomy = getFilteredTaxonomyString(region);
      const bridge = dialogueBridgeRef.current;
      const interactions = bridge?.interactions ?? [];
      const mappedCategories = bridge?.mappedCategories ?? [];
      const pdfContextText = bridge?.pdfContextText ?? "";
      const question = await GeminiService.synthesizeNextQuestion(
        interactions,
        mappedCategories,
        filteredTaxonomy,
        {
          embeddingHistorySummary: pdfContextText || undefined,
          // Avoid only the last few questions — enough to stop repeats without
          // bloating the prompt over a long session.
          avoidQuestion: askedQuestionsRef.current.slice(-5).join("\n") || undefined,
          exploredStamps: Array.from(unlockedStamps),
        },
        undefined,
        region
      );
      askedQuestionsRef.current = [...askedQuestionsRef.current.slice(-9), question];
      setGeneratedQuestion(question);
      setShowQuestionModal(true);
    } catch (err) {
      console.error("Failed to generate region question:", err);
      Alert.alert(
        "Couldn't generate a question",
        "Something went wrong while exploring this region. Please try again."
      );
    } finally {
      setIsGenerating(false);
    }
  }, [region]);

  const handleRegionSubmit = useCallback(
    async (question: string, answerText: string) => {
      setShowQuestionModal(false);
      setGeneratedQuestion("");
      const bridge = dialogueBridgeRef.current;
      // Save the answer in the background, then refresh the grid to show
      // any newly unlocked stamp.
      if (bridge) {
        bridge
          .handleRegionAnswer(question, answerText, region)
          .then((result) => {
            void loadUnlocked();
            if (result.mapped && result.stampUnlock) {
              setLocalStampUnlock({
                stamp: result.stampUnlock.stamp,
                category: result.stampUnlock.category,
                tier: result.stampUnlock.tier,
              });
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 3000);
            }
          })
          .catch((err) => console.error("Failed to map region answer:", err));
      }
      // Loop: offer the next region question right away.
      await handleGenerateQuestion();
    },
    [region, loadUnlocked, handleGenerateQuestion]
  );

  const allStamps = DERIVED_SKILLS[region] ?? [];
  const unlockedList = allStamps.filter((s) => {
    if (unlockedStamps.has(s)) return true;
    const bare = s.split(": ").pop();
    return bare ? unlockedStamps.has(bare) : false;
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.accent.skyDark} />
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <View style={styles.arrowContainer}>
            {prevRegion && (
              <TouchableOpacity onPress={goToPreviousRegion}>
                <MaterialIcons name="chevron-left" size={36} color={colors.accent.skyDark} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.title}>{region}</Text>

          <View style={styles.arrowContainer}>
            {nextRegion && (
              <TouchableOpacity onPress={goToNextRegion}>
                <MaterialIcons name="chevron-right" size={36} color={colors.accent.skyDark} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {unlockedList.length > 0 ? (
          <View style={styles.grid}>
            {unlockedList.map((stamp) => {
              const count = stampCounts[stamp] ?? 1;
              const tier = stampTiers[stamp] ?? DEFAULT_TIER;
              return (
                <TouchableOpacity
                  key={stamp}
                  style={styles.stampItem}
                  onPress={() => navigation.navigate("StampDetails", { stamp, region, categoryId })}
                >
                  <View style={styles.stampCircle}>
                    <StampBadge stampName={stamp} tier={tier} size="list" />
                    {count > 1 && (
                      <View style={styles.countBadge}>
                        <Text style={styles.countText}>×{count}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.stampText, styles.stampTextUnlocked]}>{stamp}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="lock-outline" size={64} color="#9BABCF" />
            <Text style={styles.emptyTitle}>No stamps unlocked yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete the dialogue to unlock stamps in this region.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerateQuestion}
          disabled={isGenerating}
          activeOpacity={0.8}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="auto-awesome" size={20} color="#fff" />
          )}
          <Text style={styles.generateButtonText}>
            {isGenerating ? "Exploring..." : "Explore region"}
          </Text>
        </TouchableOpacity>

        <QuestionInputModal
          visible={showQuestionModal}
          question={generatedQuestion}
          onSubmitText={(text) => {
            void handleRegionSubmit(generatedQuestion, text);
          }}
          onClose={() => {
            setShowQuestionModal(false);
            setGeneratedQuestion("");
          }}
          onSelectInputType={() => {}}
          onNewQuestion={() => {
            setShowQuestionModal(false);
            setGeneratedQuestion("");
            handleGenerateQuestion();
          }}
        />
      </ScrollView>

      <StampUnlockModal
        visible={!!localStampUnlock}
        stampName={localStampUnlock?.stamp ?? ""}
        tier={localStampUnlock?.tier ?? 1}
        region={localStampUnlock?.category ?? ""}
        onContinue={() => setLocalStampUnlock(null)}
        onViewStamp={() => {
          if (localStampUnlock) {
            setLocalStampUnlock(null);
            navigation.navigate("StampDetails", {
              stamp: localStampUnlock.stamp,
              region: localStampUnlock.category,
              categoryId,
            });
          }
        }}
      />

      {showConfetti && (
        <ConfettiCannon
          count={200}
          origin={{ x: width / 2, y: 0 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={3000}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.subtle,
    paddingTop: 20,
  },

  backButton: {
    marginBottom: 8,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  arrowContainer: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "bold",
    color: colors.text.primary,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },

  stampItem: {
    width: "33.33%",
    alignItems: "center",
    marginBottom: 26,
  },

  stampCircle: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: colors.background.tinted,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },

  stampCircleUnlocked: {
    backgroundColor: "#2E6EE6",
    borderColor: "#1B3A72",
  },

  stampText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.primary,
    textAlign: "center",
    paddingHorizontal: 4,
  },

  stampTextUnlocked: {
    color: colors.text.primary,
    fontWeight: "700",
  },

  countBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },

  countText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },

  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.secondary,
    marginTop: 16,
  },

  emptySubtitle: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
  },

  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent.sky,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 24,
    gap: 10,
  },
  generateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
