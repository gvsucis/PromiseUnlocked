import React from "react";
import { Text, ScrollView, type TextStyle } from "react-native";
import { splitQuestion } from "../../utils/splitQuestion";

interface Props {
  text: string;
  textStyle: TextStyle;
  fallbackText?: string;
  scrollable?: boolean;
}

export function SplitQuestionRenderer({
  text,
  textStyle,
  fallbackText,
  scrollable = false,
}: Readonly<Props>) {
  const content = text || fallbackText || "";
  const { compliment, question: qText } = splitQuestion(content);
  const inner = compliment ? (
    <>
      <Text style={textStyle}>{compliment}</Text>
      <Text style={[textStyle, { marginTop: 8 }]}>{qText}</Text>
    </>
  ) : (
    <Text style={textStyle}>{content}</Text>
  );

  if (scrollable) {
    return (
      <ScrollView
        style={{ maxHeight: 200 }}
        contentContainerStyle={{ paddingVertical: 4 }}
        keyboardShouldPersistTaps="handled"
      >
        {inner}
      </ScrollView>
    );
  }

  return inner;
}
