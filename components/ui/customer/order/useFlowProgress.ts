import { useMemo } from "react";
import { useOrderStore } from "@/store/useOrderStore";

export type FlowScreen =
  | "order"
  | "cylinder"
  | "photo"
  | "schedule"
  | "delivery"
  | "stations"
  | "payment";

/**
 * Compute the (step, total) pair to feed `<ProgressDots>` based on the
 * current draft. Two flows:
 *   - Liquid + LPG-Refill: order → delivery → stations → payment (4 steps)
 *   - LPG-Swap: order → cylinder → photo → schedule → delivery → stations → payment (7 steps)
 */
export function useFlowProgress(current: FlowScreen): {
  step: number;
  total: number;
} {
  const product = useOrderStore((s) => s.order.product);
  const serviceType = useOrderStore((s) => s.order.serviceType);

  return useMemo(() => {
    const isSwap = product === "lpg" && serviceType === "swap";
    // Swap flow: Order → Cylinder → Photo → Delivery (rider arrives) →
    //            Schedule (return swap) → Stations → Payment
    // Refill / liquid: Order → Delivery → Stations → Payment
    const flow: FlowScreen[] = isSwap
      ? ["order", "cylinder", "photo", "delivery", "schedule", "stations", "payment"]
      : ["order", "delivery", "stations", "payment"];

    const idx = flow.indexOf(current);
    return {
      step: idx === -1 ? 0 : idx,
      total: flow.length,
    };
  }, [product, serviceType, current]);
}
