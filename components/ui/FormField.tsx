import React, { useState } from "react";
import {
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  Text,
  TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";

interface FormFieldProps extends TextInputProps {
  title: string;
  value: string;
  placeholder?: string;
  handleChangeText: (text: string) => void;
  otherStyles?: any;
  secureTextEntry?: boolean;
  toggleSecureEntry?: () => void;
  status?: "default" | "success" | "error";
  iconSize?: number;
}

const iconMapping: Record<string, string> = {
  Email: "mail",
  Password: "lock-closed",
  "Confirm Password": "lock-closed",
  Address: "location",
  Phone: "call",
  Username: "at",
  default: "person",
};

const FormField: React.FC<FormFieldProps> = ({
  title,
  value,
  placeholder,
  handleChangeText,
  otherStyles,
  secureTextEntry,
  toggleSecureEntry,
  status: parentStatus,
  iconSize = 20,
  ...props
}) => {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const isPasswordField = title === "Password" || title === "Confirm Password";
  const showEyeIcon = isPasswordField && toggleSecureEntry;

  // Type cast to fix TS error
  const iconName = (iconMapping[title] || iconMapping.default) as any;

  // Determine colors based on focus & validation state
  const getColors = () => {
    const status = parentStatus || "default";
    switch (status) {
      case "success":
        return {
          border: theme.secondary,
          bg: theme.tertiary, 
          icon: theme.secondary,
          text: theme.text,
        };
      case "error":
        return {
          border: theme.error,
          bg: theme.background,
          icon: theme.error,
          text: theme.error,
        };
      default:
        return isFocused
          ? {
              border: theme.secondary,
              bg: theme.background,
              icon: theme.quaternary,
              text: theme.text,
            }
          : {
              border: theme.primary,
              bg: theme.background,
              icon: theme.primary,
              text: theme.text,
            };
    }
  };

  const colors = getColors();

  return (
    <View style={[styles.wrapper, otherStyles]}>
      <Text style={[styles.label, { color: theme.text, fontWeight: "700", fontSize: 18 }]}>{title}</Text>
      <View
        style={[
          styles.inputContainer,
          {
            borderColor: colors.border,
            backgroundColor: colors.bg,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={colors.icon}
          onChangeText={handleChangeText}
          secureTextEntry={secureTextEntry}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {showEyeIcon && (
          <TouchableOpacity onPress={toggleSecureEntry}>
            <Ionicons
              name={secureTextEntry ? "eye-off" : "eye"}
              size={24}
              color={colors.icon}
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default FormField;

const styles = StyleSheet.create({
  wrapper: { width: "100%", marginVertical: 8 },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  inputContainer: {
    width: "100%",
    height: 55,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
