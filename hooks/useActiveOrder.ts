import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";

export function useActiveOrder() {
  const [hasActiveOrder, setHasActiveOrder] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = async () => {
    try {
      const res = await api.get<{ data: any[]; total: number }>(
        "/api/orders?status=pending&page=1&limit=1"
      );
      setHasActiveOrder((res.data?.length ?? 0) > 0 || res.total > 0);
    } catch {
      // keep last known state
    }
  };

  useEffect(() => {
    check();
    intervalRef.current = setInterval(check, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { hasActiveOrder };
}
