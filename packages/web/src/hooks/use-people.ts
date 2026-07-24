import { useCallback, useEffect, useState } from "react";

import { peopleService } from "@/services/people.service";
import type { Person } from "@/types/people";

type UsePeopleParams = {
  fairId?: string;
};

export function usePeople(params: UsePeopleParams = {}) {
  const requestKey = params.fairId ?? "all";
  const [people, setPeople] = useState<Person[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    peopleService
      .listPeople({ fairId: params.fairId })
      .then((data) => {
        if (!cancelled) {
          setPeople(data.data || []);
          setLoadedKey(requestKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params.fairId, requestKey, reloadToken]);

  return { people, loading: loadedKey !== requestKey, reload };
}
