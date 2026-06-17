import { useEffect, useState } from "react";

import { awardDistinctivesService } from "@/services/award-distinctives.service";
import type { AwardDistinctive } from "@/types/award-distinctives";

export function useAwardDistinctives() {
  const [distinctives, setDistinctives] = useState<AwardDistinctive[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await awardDistinctivesService.listAwardDistinctives();
        if (!cancelled) {
          setDistinctives(response.data ?? []);
        }
      } catch {
        if (!cancelled) {
          setDistinctives([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { distinctives, loading };
}
