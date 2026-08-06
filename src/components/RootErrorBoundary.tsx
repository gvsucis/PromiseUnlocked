import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

// Catches render/lifecycle errors so a bad JS bundle degrades to a message
// instead of a native RCTFatal crash. Does not catch native-module failures.
export default class RootErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("RootErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={{ flex: 1, backgroundColor: "#1a1a2e", padding: 24, justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "bold", marginBottom: 12 }}>
          Something went wrong
        </Text>
        <ScrollView style={{ maxHeight: 220, marginBottom: 20 }}>
          <Text style={{ color: "#ff8a80", fontSize: 13 }}>
            {error.message}
            {"\n\n"}
            {error.stack}
          </Text>
        </ScrollView>
        <TouchableOpacity
          onPress={() => this.setState({ error: null })}
          style={{ backgroundColor: "#2196F3", padding: 14, borderRadius: 8, alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontWeight: "bold" }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
