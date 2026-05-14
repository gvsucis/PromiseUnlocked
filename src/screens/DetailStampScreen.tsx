import React from "react";

import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../types/navigation";

type StampDetailRouteProp = RouteProp<
  RootStackParamList,
  "StampDetail"
>;

export default function StampDetailScreen() {
  const route = useRoute<StampDetailRouteProp>();
  const { stamp, region } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.badgeContainer}>
          <View style={styles.badgeCircle}>
            <MaterialIcons
              name="school"
              size={42}
              color="#2E6EE6"
            />
          </View>

          <Text style={styles.title}>
            {stamp}
          </Text>

          <Text style={styles.subtitle}>
            {region}
          </Text>
        </View>

        <View style={styles.card}>

          <Text style={styles.sectionTitle}>
            Evidence
          </Text>

          <View style={styles.bulletItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Completed introductory module
            </Text>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Submitted project or assignment
            </Text>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Demonstrated applied understanding
            </Text>
          </View>

          <View style={styles.bulletItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Verified by instructor / system check
            </Text>
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