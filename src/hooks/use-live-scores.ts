"use client";

import { useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to the pool broadcast channel for score updates.
 * When a `scores_updated` event is received, calls the onUpdate callback
 * so the page can refetch data.
 */
export function useLiveScores(
  poolId: string,
  onUpdate: (updatedSeriesIds: string[]) => void
) {
  const stableOnUpdate = useCallback(onUpdate, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!poolId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`pool:${poolId}`)
      .on("broadcast", { event: "scores_updated" }, (payload) => {
        const ids: string[] = payload.payload?.updatedSeriesIds ?? [];
        stableOnUpdate(ids);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [poolId, stableOnUpdate]);
}
