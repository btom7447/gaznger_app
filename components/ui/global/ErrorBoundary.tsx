import React from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";

/**
 * Root ErrorBoundary.
 *
 * React Native + Expo Router give you a stark choice when a component
 * tree throws: in dev you get the red box, in production builds the
 * default is a blank white screen with no signal. That's a debugging
 * black hole for testers — they hit a bug and report "the app just
 * shows nothing" with no way for us to know what happened.
 *
 * This boundary mounts at the very root of the tree and catches any
 * render-time error from the entire app. Instead of going white, it
 * shows the error message + component stack on a scrollable screen
 * the tester can screenshot and send. No tooling needed.
 *
 * Keep it MINIMAL — no theme, no imports beyond core RN, no async work
 * — because the dependency that crashed might be the very thing the
 * boundary would try to use.
 */

interface State {
  error: Error | null;
  componentStack: string | null;
}

interface Props {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({
      error,
      componentStack: info.componentStack ?? null,
    });
    // Don't try to ship to Sentry/etc. here — boundary should never
    // throw. If we add telemetry later, do it via a fire-and-forget
    // call wrapped in its own try/catch.
  }

  reset = () => {
    this.setState({ error: null, componentStack: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.root}>
        <View style={styles.banner}>
          <Text style={styles.title}>Something broke 🛠️</Text>
          <Text style={styles.subtitle}>
            Send this screen to the Gaznger team.
          </Text>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.label}>Error:</Text>
          <Text style={styles.message} selectable>
            {this.state.error.message || String(this.state.error)}
          </Text>
          {this.state.error.stack ? (
            <>
              <Text style={styles.label}>Stack:</Text>
              <Text style={styles.code} selectable>
                {this.state.error.stack}
              </Text>
            </>
          ) : null}
          {this.state.componentStack ? (
            <>
              <Text style={styles.label}>Component stack:</Text>
              <Text style={styles.code} selectable>
                {this.state.componentStack}
              </Text>
            </>
          ) : null}
        </ScrollView>
        <Pressable style={styles.retry} onPress={this.reset}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b0b10",
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  banner: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a36",
  },
  title: { color: "#ff6b6b", fontSize: 20, fontWeight: "700" },
  subtitle: { color: "#a0a0b0", fontSize: 13, marginTop: 4 },
  scroll: { flex: 1, marginTop: 16 },
  scrollContent: { paddingBottom: 24 },
  label: {
    color: "#ffd166",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  message: { color: "#fff", fontSize: 14, lineHeight: 20 },
  code: {
    color: "#c8c8d0",
    fontFamily: "monospace",
    fontSize: 11,
    lineHeight: 16,
  },
  retry: {
    backgroundColor: "#ff6b6b",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

export default ErrorBoundary;
