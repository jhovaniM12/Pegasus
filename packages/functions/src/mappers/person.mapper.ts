import type { Person } from "@pegasus/core";
import { toSyncableDto, type SyncableDto } from "./syncable.mapper.js";
import type { PersonWithAccessRole } from "../services/people.service.js";

export type PersonDto = SyncableDto & {
  name: string;
  lastName: string | null;
  fullName: string;
  address: string | null;
  indicative: string | null;
  telephone: string | null;
  phone: string | null;
  avantelPhone: string | null;
  email: string | null;
  accessRole: string | null;
  accessRoleLabel: string | null;
};

export function toPersonDto(person: Person | PersonWithAccessRole): PersonDto {
  const accessRole = "accessRole" in person ? person.accessRole : null;

  return {
    ...toSyncableDto(person),
    name: person.name,
    lastName: person.lastName,
    fullName: `${person.name} ${person.lastName ?? ""}`.trim(),
    address: person.address,
    indicative: person.indicative,
    telephone: person.telephone,
    phone: person.phone,
    avantelPhone: person.avantelPhone,
    email: person.email,
    accessRole: accessRole?.role ?? null,
    accessRoleLabel: accessRole?.label ?? null
  };
}
