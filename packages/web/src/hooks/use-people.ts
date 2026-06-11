import { useEffect, useState } from "react";

import { peopleService } from "@/services/people.service";
import type { Person } from "@/types/people";

export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    peopleService
      .listPeople()
      .then((data) => {
        setPeople(data.data || []);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { people, loading };
}

