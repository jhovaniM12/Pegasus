import { useEffect, useState } from "react";

import { peopleService } from "@/services/people.service";
import type { Person } from "@/types/people";

type UsePeopleParams = {
  fairId?: string;
};

export function usePeople(params: UsePeopleParams = {}) {
  const requestKey = params.fairId ?? "all";
  const [people, setPeople] = useState<Person[]>([]);
  const [loadedKey, setLoadedKey] = useState("");

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
  }, [params.fairId, requestKey]);

  return { people, loading: loadedKey !== requestKey };
}
