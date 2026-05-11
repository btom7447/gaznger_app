/**
 * 36 Nigerian states + the Federal Capital Territory, alphabetised.
 * Used by the vendor address picker + anywhere else we need a state
 * dropdown. Lowercase code is the canonical key (server treats it
 * case-insensitively but stores the display label as-is).
 */
export interface NigeriaState {
  code: string;
  label: string;
}

export const NIGERIA_STATES: NigeriaState[] = [
  { code: "abia", label: "Abia" },
  { code: "adamawa", label: "Adamawa" },
  { code: "akwa-ibom", label: "Akwa Ibom" },
  { code: "anambra", label: "Anambra" },
  { code: "bauchi", label: "Bauchi" },
  { code: "bayelsa", label: "Bayelsa" },
  { code: "benue", label: "Benue" },
  { code: "borno", label: "Borno" },
  { code: "cross-river", label: "Cross River" },
  { code: "delta", label: "Delta" },
  { code: "ebonyi", label: "Ebonyi" },
  { code: "edo", label: "Edo" },
  { code: "ekiti", label: "Ekiti" },
  { code: "enugu", label: "Enugu" },
  { code: "fct", label: "FCT — Abuja" },
  { code: "gombe", label: "Gombe" },
  { code: "imo", label: "Imo" },
  { code: "jigawa", label: "Jigawa" },
  { code: "kaduna", label: "Kaduna" },
  { code: "kano", label: "Kano" },
  { code: "katsina", label: "Katsina" },
  { code: "kebbi", label: "Kebbi" },
  { code: "kogi", label: "Kogi" },
  { code: "kwara", label: "Kwara" },
  { code: "lagos", label: "Lagos" },
  { code: "nasarawa", label: "Nasarawa" },
  { code: "niger", label: "Niger" },
  { code: "ogun", label: "Ogun" },
  { code: "ondo", label: "Ondo" },
  { code: "osun", label: "Osun" },
  { code: "oyo", label: "Oyo" },
  { code: "plateau", label: "Plateau" },
  { code: "rivers", label: "Rivers" },
  { code: "sokoto", label: "Sokoto" },
  { code: "taraba", label: "Taraba" },
  { code: "yobe", label: "Yobe" },
  { code: "zamfara", label: "Zamfara" },
];

/**
 * Best-effort match of a free-text state name (e.g. from reverse-
 * geocode) to one of our canonical entries. Returns the entry when
 * it can identify one, else null. Used to pre-select the dropdown
 * after a user picks an autocomplete suggestion.
 */
export function matchState(input?: string | null): NigeriaState | null {
  if (!input) return null;
  const norm = input.toLowerCase().replace(/state$/i, "").trim();
  for (const s of NIGERIA_STATES) {
    if (norm === s.code) return s;
    if (norm === s.label.toLowerCase()) return s;
    // Handle "FCT" or "Abuja" both mapping to fct.
    if ((norm === "abuja" || norm === "fct" || norm.includes("federal capital"))
        && s.code === "fct") return s;
  }
  return null;
}
