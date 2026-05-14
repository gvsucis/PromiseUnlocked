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

import {
  useNavigation,
  useRoute,
} from "@react-navigation/native";

import type { RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../types/navigation";
import { SKILLS_TAXONOMY } from "../config/skillsTaxonomy";

type StampRouteProp = RouteProp<
  RootStackParamList,
  "Stamps"
>;

type StampNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Stamps"
>;

export default function StampScreen() {
  const navigation =
    useNavigation<StampNavigationProp>();

  const route = useRoute<StampRouteProp>();
  const { region } = route.params;
  const regions = Object.keys(SKILLS_TAXONOMY);
  const currentIndex = regions.indexOf(region);

  const previousRegion =
    currentIndex > 0
      ? regions[currentIndex - 1]
      : null;

  const nextRegion =
    currentIndex < regions.length - 1
      ? regions[currentIndex + 1]
      : null;

  const stamps = SKILLS_TAXONOMY[region];

  function goToPreviousRegion() {
    if (!previousRegion) return;
    navigation.replace("Stamps", {
      region: previousRegion,
    });
  }
  function goToNextRegion() {
    if (!nextRegion) return;
    navigation.replace("Stamps", {
      region: nextRegion,
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.arrowContainer}>
            {previousRegion && (
              <TouchableOpacity
                onPress={goToPreviousRegion}
              >
                <MaterialIcons
                  name="chevron-left"
                  size={36}
                  color="#1B3A72"
                />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.title}>
            {region}
          </Text>

          <View style={styles.arrowContainer}>
            {nextRegion && (
              <TouchableOpacity
                onPress={goToNextRegion}
              >
                <MaterialIcons
                  name="chevron-right"
                  size={36}
                  color="#1B3A72"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.grid}>
          {stamps.map((stamp) => (
            <TouchableOpacity
              key={stamp}
              style={styles.stampItem}
              onPress={() =>
                navigation.navigate("StampDetail", {
                  stamp,
                  region,
                })
              }
            >
              <View style={styles.stampCircle}>
                <MaterialIcons
                  name="school"
                  size={34}
                  color="#2E6EE6"
                />
              </View>

              <Text style={styles.stampText}>
                {stamp}
              </Text>
            </TouchableOpacity>
          ))}
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
    color: "#1B3A72",
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
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#EEF4FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#D6E4FF",
  },

  stampText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1B3A72",
    textAlign: "center",
    paddingHorizontal: 4,
  },
});