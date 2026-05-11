import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import {
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";

/**
 * Privacy Policy — customer-facing surface for the App Store / Play
 * Store privacy disclosures (audit B.5). The deletion + retention
 * sections are required by Apple's Account Deletion guideline 5.1.1
 * and the soft-delete behaviour we ship in B.1.
 *
 * This is the in-app summary; the canonical full policy lives at
 * gaznger.com/privacy. When the canonical doc updates, mirror the
 * material changes here so users have an offline-readable copy.
 *
 * Last reviewed: 2026-05-09.
 */
export default function PrivacyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={<ScreenHeader title="Privacy Policy" onBack={() => router.back()} />}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.updated}>Last updated: 2026-05-09</Text>

        <Section theme={theme} title="What we collect">
          <P theme={theme}>
            To deliver fuel safely we collect: your phone number (for sign-in
            and OTP delivery), your name (so the rider knows who they're
            meeting), your delivery addresses (with the optional name + icon
            you set), your payment cards via Paystack (we never see the card
            number — Paystack returns a tokenised reference), and your
            device's location while you have an order in flight (so the
            rider can find you).
          </P>
        </Section>

        <Section theme={theme} title="Why we use it">
          <P theme={theme}>
            We use this data to dispatch your orders, route the rider, take
            payment, send you receipts + status updates, and respond to
            support requests. We never sell your data to third parties.
          </P>
        </Section>

        <Section theme={theme} title="Who sees what">
          <P theme={theme}>
            The rider on your order sees your name, phone number, and
            delivery address — only while the order is active. The vendor
            sees your name + the order details. Gaznger admins can see all
            of it for support and dispute resolution. No one outside Gaznger,
            our vendors, and our riders sees any of it.
          </P>
        </Section>

        <Section theme={theme} title="Account deletion">
          <P theme={theme}>
            You can delete your account from Settings → Danger zone → Delete
            my account. When you do:
          </P>
          <Bullet theme={theme}>
            Your name, phone number, email, and profile photo are anonymised
            immediately.
          </Bullet>
          <Bullet theme={theme}>
            All your active sessions are signed out across every device.
          </Bullet>
          <Bullet theme={theme}>
            Your account is recoverable for 30 days. Email
            support@gaznger.com to recover. After 30 days the row is
            permanently removed.
          </Bullet>
          <Bullet theme={theme}>
            Order receipts + payment records remain in our books for 7 years
            (Nigerian tax law requires this). They're linked to an
            anonymised user record, not to your name.
          </Bullet>
          <Bullet theme={theme}>
            If you have a wallet balance at deletion, email
            support@gaznger.com within 14 days to request a refund.
          </Bullet>
        </Section>

        <Section theme={theme} title="Data retention">
          <P theme={theme}>
            Active accounts: data retained for the lifetime of the account.
            Deleted accounts: PII anonymised immediately, full row removed
            after 30 days. Order/payment records: 7 years (legal
            requirement). Server logs containing IP + user-agent: 90 days.
          </P>
        </Section>

        <Section theme={theme} title="Your rights (NDPR)">
          <P theme={theme}>
            Under Nigeria's Data Protection Regulation you have the right
            to access your data, correct it, delete it, and object to
            processing. The first three are available in-app. For
            objections email support@gaznger.com.
          </P>
        </Section>

        <Section theme={theme} title="Contact">
          <P theme={theme}>
            Questions or requests: support@gaznger.com.
          </P>
        </Section>
      </ScrollView>
    </ScreenContainer>
  );
}

function Section({
  theme,
  title,
  children,
}: {
  theme: Theme;
  title: string;
  children: React.ReactNode;
}) {
  const styles = makeStyles(theme);
  return (
    <View style={styles.section}>
      <Text style={styles.h2}>{title}</Text>
      {children}
    </View>
  );
}

function P({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  const styles = makeStyles(theme);
  return <Text style={styles.body}>{children}</Text>;
}

function Bullet({
  theme,
  children,
}: {
  theme: Theme;
  children: React.ReactNode;
}) {
  const styles = makeStyles(theme);
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: theme.space.s4,
      paddingBottom: theme.space.s6,
    },
    updated: {
      ...theme.type.micro,
      color: theme.fgMuted,
      marginTop: theme.space.s2,
      marginBottom: theme.space.s4,
    },
    section: {
      marginBottom: theme.space.s4,
      gap: theme.space.s2,
    },
    h2: {
      ...theme.type.h2,
      color: theme.fg,
      marginBottom: theme.space.s1,
    },
    body: {
      ...theme.type.body,
      color: theme.fg,
      lineHeight: 22,
    },
    bulletRow: {
      flexDirection: "row",
      gap: 8,
      paddingLeft: 4,
    },
    bullet: {
      ...theme.type.body,
      color: theme.fgMuted,
      lineHeight: 22,
    },
    bulletText: {
      flex: 1,
      ...theme.type.body,
      color: theme.fg,
      lineHeight: 22,
    },
  });
