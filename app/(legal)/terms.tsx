import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import {
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";

/**
 * Terms of Service — customer-facing summary surface (audit B.5).
 *
 * Canonical version lives at gaznger.com/terms; this is the
 * offline-readable copy users sign up against. Mirrors the substance
 * of the canonical doc; not a substitute for one.
 *
 * Last reviewed: 2026-05-09.
 */
export default function TermsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={<ScreenHeader title="Terms of Service" onBack={() => router.back()} />}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.updated}>Last updated: 2026-05-09</Text>

        <Section theme={theme} title="Who we are">
          <P theme={theme}>
            Gaznger is a mobile platform that connects fuel-station vendors,
            independent riders, and customers in Nigeria. We don't operate
            forecourts ourselves; we route orders, take payments, and
            coordinate delivery.
          </P>
        </Section>

        <Section theme={theme} title="Your account">
          <P theme={theme}>
            You sign up with your Nigerian phone number. You're responsible
            for keeping your PIN and any biometric credentials private.
            Don't share your account. If your phone is lost or stolen,
            email support@gaznger.com so we can revoke active sessions.
          </P>
          <P theme={theme}>
            One account per person. We may suspend or terminate accounts
            we believe are fraudulent, abusive, or breaking these terms.
          </P>
        </Section>

        <Section theme={theme} title="Orders + payment">
          <P theme={theme}>
            When you place an order you authorise Gaznger to dispatch a
            rider and (where you've chosen card or wallet) take payment
            through Paystack. Prices shown at order time include fuel +
            delivery fee + any service fee, and are locked when you tap
            Pay. We don't accept cash on delivery.
          </P>
          <P theme={theme}>
            If the rider can't complete delivery for reasons inside
            Gaznger's control, we refund you to your original payment
            method within 7 working days.
          </P>
        </Section>

        <Section theme={theme} title="Cancellations + refunds">
          <P theme={theme}>
            You can cancel a free of charge before a rider is dispatched.
            After dispatch, cancellation may incur the delivery fee
            (rider already en route). After fuel has been loaded into the
            delivery container, the order is non-refundable except in
            cases of fault on the vendor's or rider's part.
          </P>
        </Section>

        <Section theme={theme} title="Liability">
          <P theme={theme}>
            We provide Gaznger "as is". We're not liable for loss caused by
            outages of third-party services (Paystack, mapping, telecom
            networks). For amounts we directly owe under these terms, our
            total liability is capped at the total you paid Gaznger in the
            preceding 12 months.
          </P>
        </Section>

        <Section theme={theme} title="Account deletion">
          <P theme={theme}>
            You can delete your account at any time from Settings → Danger
            zone. We anonymise your personal info immediately; the row
            hard-deletes after 30 days. Order receipts remain on file for
            tax compliance (7 years). See the Privacy Policy for the full
            retention table.
          </P>
        </Section>

        <Section theme={theme} title="Changes">
          <P theme={theme}>
            We may update these terms from time to time. Material changes
            will trigger an in-app banner the next time you launch the
            app. Continued use after the update means you accept the new
            terms.
          </P>
        </Section>

        <Section theme={theme} title="Governing law">
          <P theme={theme}>
            These terms are governed by Nigerian law. Disputes go to the
            courts of Lagos State.
          </P>
        </Section>

        <Section theme={theme} title="Contact">
          <P theme={theme}>support@gaznger.com</P>
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
  });
