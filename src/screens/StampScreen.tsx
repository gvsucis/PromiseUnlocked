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

export default function StampScreen({ route }){
    const { region } = route.params;
    const stamps = SKILLS_TAXONOMY[region];
    return(
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>
                    {region}
                </Text>
                <View>
                    {stamps.map((stamp) => (
                        <TouchableOpacity
                            key={stamp}
                            style={styles.card}
                        >
                            <View style={styles.iconCircle}>
                            <MaterialIcons
                                name="school"
                                size={28}
                                color="#2E6EE6"
                            />
                            </View>

                            <Text style={styles.cardTitle}>
                            {stamp}
                            </Text>

                            <Text style={styles.cardDescription}>
                            Skill Stamp
                            </Text>
                        </TouchableOpacity>
                        ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    )
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
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EEF4FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1B3A72",
    marginBottom: 4,
  },

  cardDescription: {
    fontSize: 14,
    color: "#6B7A99",
  },

})