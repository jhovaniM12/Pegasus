import {
  findFairStaffByPersonId,
  findFairStaffByPersonIds,
  findPeoplePaginated,
  findPersonById,
  findUserByAccessCodeHash,
  getDataSource,
  upsertStaffUserAccessCode,
  type PaginatedResult,
  type PaginationParams,
  type Person,
  type User,
  type UserRole
} from "@pegasus/core";
import { BadRequestError, NotFoundError } from "../lib/errors.js";
import { hashAccessCode } from "../lib/access-code.js";

export type PersonAccessRole = {
  role: UserRole;
  label: string;
  externalId: string;
};

export type PersonWithAccessRole = Person & {
  accessRole: PersonAccessRole | null;
};

const ACCESS_ROLE_OPTIONS: Array<PersonAccessRole> = [
  { externalId: "3", role: "TECHNICAL_DIRECTOR", label: "Director técnico" },
  { externalId: "Z", role: "VETERINARIAN", label: "Veterinario autorizado" },
  { externalId: "2", role: "JUDGE", label: "Juez" }
];

function resolveAccessRole(staffRoles: string[]): PersonAccessRole | null {
  return ACCESS_ROLE_OPTIONS.find((option) => staffRoles.includes(option.externalId)) ?? null;
}

export async function listPeople(
  params: PaginationParams & { search?: string; fairId?: string }
): Promise<PaginatedResult<PersonWithAccessRole>> {
  const dataSource = await getDataSource();
  const result = await findPeoplePaginated(dataSource, params);
  const staffEntries = await findFairStaffByPersonIds(
    dataSource,
    result.items.map((person) => person.id),
    { fairId: params.fairId }
  );
  const rolesByPersonId = new Map<string, string[]>();

  for (const staff of staffEntries) {
    const roles = rolesByPersonId.get(staff.personId) ?? [];

    if (staff.role.externalId) {
      roles.push(staff.role.externalId);
    }

    rolesByPersonId.set(staff.personId, roles);
  }

  return {
    ...result,
    items: result.items.map((person) =>
      Object.assign(person, {
        accessRole: resolveAccessRole(rolesByPersonId.get(person.id) ?? [])
      })
    )
  };
}

export async function getPersonById(personId: string): Promise<Person> {
  const dataSource = await getDataSource();
  const person = await findPersonById(dataSource, personId);

  if (!person) {
    throw new NotFoundError(`No se encontró la persona con id "${personId}".`);
  }

  return person;
}

function resolveAccessUserRole(staffRoles: string[]): UserRole {
  const accessRole = resolveAccessRole(staffRoles);

  if (accessRole) {
    return accessRole.role;
  }

  throw new BadRequestError("La persona no tiene un rol habilitado para acceso por código.");
}

export async function assignPersonAccessCode(
  personId: string,
  accessCode: string
): Promise<User> {
  const dataSource = await getDataSource();
  const person = await findPersonById(dataSource, personId);

  if (!person) {
    throw new NotFoundError(`No se encontró la persona con id "${personId}".`);
  }

  const staffEntries = await findFairStaffByPersonId(dataSource, personId);
  const staffRoles = staffEntries
    .map((staff) => staff.role.externalId)
    .filter((externalId): externalId is string => Boolean(externalId));
  const role = resolveAccessUserRole(staffRoles);
  const accessCodeHash = hashAccessCode(accessCode);
  const userWithCode = await findUserByAccessCodeHash(dataSource, accessCodeHash);

  if (userWithCode && userWithCode.personId !== personId) {
    throw new BadRequestError("El código de acceso ya está asignado a otra persona.");
  }

  return upsertStaffUserAccessCode(dataSource, {
    personId,
    role,
    accessCodeHash
  });
}
