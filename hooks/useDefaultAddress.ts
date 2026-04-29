import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSessionStore } from "@/store/useSessionStore";

interface AddressLite {
  _id: string;
  label: string;
  street?: string;
  city?: string;
  isDefault?: boolean;
}

interface UseDefaultAddressResult {
  /** Display label, e.g. "Home" or "Office". Null while loading or if no default. */
  label: string | null;
  /** Sub-line (street + city), if available. */
  subLabel: string | null;
  loading: boolean;
}

/**
 * Resolves the user's default address from session.user.defaultAddress (an ID)
 * to the actual label. Falls back to fetching the full list and matching by ID
 * or `isDefault`.
 */
export function useDefaultAddress(): UseDefaultAddressResult {
  const defaultId = useSessionStore((s) => s.user?.defaultAddress ?? null);
  const [label, setLabel] = useState<string | null>(null);
  const [subLabel, setSubLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<AddressLite[]>("/api/address-book")
      .then((list) => {
        if (cancelled) return;
        const match =
          (defaultId && list.find((a) => a._id === defaultId)) ||
          list.find((a) => a.isDefault) ||
          list[0];
        if (!match) {
          setLabel(null);
          setSubLabel(null);
        } else {
          setLabel(match.label);
          const sub = [match.street, match.city].filter(Boolean).join(", ");
          setSubLabel(sub || null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLabel(null);
        setSubLabel(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [defaultId]);

  return { label, subLabel, loading };
}
