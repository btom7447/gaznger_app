// Auth shared components — used across pre-app, signup tail, login,
// recovery, and edge-state screens. Legacy email/password components
// were removed in the v4 auth slice (2026-05-09); replacements are
// `Input` (primitives) for forms and `OtpInput` for OTP entry.

export { default as AuthScreenContainer } from "./AuthScreenContainer";
export { default as TrustStrip } from "./TrustStrip";
export { default as GaznergerMark } from "./GaznergerMark";
export { default as Wordmark } from "./Wordmark";
export { default as OnboardIllo } from "./OnboardIllo";
export type { OnboardKind } from "./OnboardIllo";
export { default as WelcomeTrioIllo } from "./WelcomeTrioIllo";
export { default as RoleSelectCard } from "./RoleSelectCard";
export type { Role } from "./RoleSelectCard";
export { default as VerificationTimeline } from "./VerificationTimeline";
export type { VerificationStep } from "./VerificationTimeline";
export { default as PendingTimeline } from "./PendingTimeline";
export type { PendingTone, PendingRow } from "./PendingTimeline";
export { default as SecurityOptionCard } from "./SecurityOptionCard";
export { default as PermissionRow } from "./PermissionRow";
export { default as BiometricSheet } from "./BiometricSheet";
export { default as EdgeStateScreen } from "./EdgeStateScreen";
export type { EdgeTone } from "./EdgeStateScreen";
export { StepUpAuthHost, requireStepUpAuth, requireStepUpPin } from "./StepUpAuth";
export { default as V7Field } from "./V7Field";
export type { V7FieldProps } from "./V7Field";
