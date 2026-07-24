import type { FairStaff, Person } from "@pegasus/core";
import { toRoleSummaryDto, type RoleSummaryDto } from "./catalog.mapper.js";
import { toSyncableDto, type SyncableDto } from "./syncable.mapper.js";

export type PersonSummaryDto = SyncableDto & {
  name: string;
  lastName: string | null;
  telephone: string | null;
  phone: string | null;
  email: string | null;
};

export type FairStaffDto = SyncableDto & {
  fairId: string;
  person: PersonSummaryDto;
  role: RoleSummaryDto;
};

function toPersonSummaryDto(person: Person): PersonSummaryDto {
  return {
    ...toSyncableDto(person),
    name: person.name,
    lastName: person.lastName,
    telephone: person.telephone,
    phone: person.phone,
    email: person.email
  };
}

export function toFairStaffDto(staff: FairStaff): FairStaffDto {
  return {
    ...toSyncableDto(staff),
    fairId: staff.fairId,
    person: toPersonSummaryDto(staff.person),
    role: toRoleSummaryDto(staff.role)
  };
}
