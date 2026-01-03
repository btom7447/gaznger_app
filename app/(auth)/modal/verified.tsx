import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/constants/theme";
import { useEffect } from "react";

export default function CompleteModal() {
  const theme = useTheme();


  const handleDone = () => {
    router.replace("/(tabs)/(home)");
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
        <Ionicons name="checkmark-circle" size={90} color={theme.secondary} />

        <Text style={[styles.title, { color: theme.text }]}>
          OTP verified succesfully!
        </Text>
        <Text style={[styles.description, { color: theme.text }]}>
          Verification complete, you're being logged in
        </Text>

        <Pressable
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleDone}
        >
          <Text style={styles.buttonText}>Place an order</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    width: "100%",
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 20,
  },
  title: {
    fontWeight: "600",
    fontSize: 28,
  },
  description: {
    width: "100%",
    fontSize: 18,
    textAlign: "center",
    lineHeight: 22,
  },
  button: {
    marginTop: 10,
    width: "100%",
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    elevation: 10,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
});
