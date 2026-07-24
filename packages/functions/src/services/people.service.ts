import {
  findAccessCodesByPrefix,
  findFairStaffByPersonId,
  findFairStaffByPersonIds,
  findPeoplePaginated,
  findPersonById,
  findUserByAccessCode,
  findUserByAccessCodeHash,
  findUsersByPersonIds,
  getDataSource,
  upsertStaffUserAccessCode,
  type PaginatedResult,
  type PaginationParams,
  type Person,
  type User,
  type UserRole
} from "@pegasus/core";
import { BadRequestError, NotFoundError } from "../lib/errors.js";
import { hashAccessCode, normalizeAccessCode } from "../lib/access-code.js";

export type PersonAccessRole = {
  role: UserRole;
  label: string;
  externalId: string;
  codePrefix: string;
};

export type PersonWithAccessRole = Person & {
  accessRole: PersonAccessRole | null;
  accessCode: string | null;
};

const ACCESS_ROLE_OPTIONS: Array<PersonAccessRole> = [
  { externalId: "3", role: "TECHNICAL_DIRECTOR", label: "Director técnico", codePrefix: "DTF" },
  { externalId: "Z", role: "VETERINARIAN", label: "Veterinario autorizado", codePrefix: "VTF" },
  { externalId: "2", role: "JUDGE", label: "Juez", codePrefix: "JFQ" }
];

function resolveAccessRole(staffRoles: string[]): PersonAccessRole | null {
  return ACCESS_ROLE_OPTIONS.find((option) => staffRoles.includes(option.externalId)) ?? null;
}

function resolveAccessRoleForPerson(staffRoles: string[]): PersonAccessRole {
  const accessRole = resolveAccessRole(staffRoles);

  if (accessRole) {
    return accessRole;
  }

  throw new BadRequestError("La persona no tiene un rol habilitado para acceso por código.");
}

async function staffRolesForPerson(personId: string, fairId?: string): Promise<string[]> {
  const dataSource = await getDataSource();
  const staffEntries = fairId
    ? await findFairStaffByPersonIds(dataSource, [personId], { fairId })
    : await findFairStaffByPersonId(dataSource, personId);

  return staffEntries
    .map((staff) => staff.role.externalId)
    .filter((externalId): externalId is string => Boolean(externalId));
}

export async function listPeople(
  params: PaginationParams & { search?: string; fairId?: string }
): Promise<PaginatedResult<PersonWithAccessRole>> {
  const dataSource = await getDataSource();
  const result = await findPeoplePaginated(dataSource, params);
  const personIds = result.items.map((person) => person.id);
  const staffEntries = await findFairStaffByPersonIds(dataSource, personIds, {
    fairId: params.fairId
  });
  const users = await findUsersByPersonIds(dataSource, personIds);
  const rolesByPersonId = new Map<string, string[]>();
  const accessCodeByPersonId = new Map<string, string | null>();

  for (const staff of staffEntries) {
    const roles = rolesByPersonId.get(staff.personId) ?? [];

    if (staff.role.externalId) {
      roles.push(staff.role.externalId);
    }

    rolesByPersonId.set(staff.personId, roles);
  }

  for (const user of users) {
    if (user.personId) {
      accessCodeByPersonId.set(user.personId, user.accessCode);
    }
  }

  return {
    ...result,
    items: result.items.map((person) =>
      Object.assign(person, {
        accessRole: resolveAccessRole(rolesByPersonId.get(person.id) ?? []),
        accessCode: accessCodeByPersonId.get(person.id) ?? null
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

export type AccessCodeAvailability = {
  accessCode: string;
  available: boolean;
  message: string;
};

export async function checkAccessCodeAvailability(
  accessCode: string,
  personId?: string
): Promise<AccessCodeAvailability> {
  const normalized = normalizeAccessCode(accessCode);
  const dataSource = await getDataSource();
  const existing =
    (await findUserByAccessCode(dataSource, normalized)) ??
    (await findUserByAccessCodeHash(dataSource, hashAccessCode(normalized)));

  if (existing && existing.personId !== personId) {
    return {
      accessCode: normalized,
      available: false,
      message: "El código de acceso ya está asignado a otra persona."
    };
  }

  return {
    accessCode: normalized,
    available: true,
    message: "Código disponible."
  };
}

async function assertAccessCodeAvailable(
  accessCode: string,
  personId: string
): Promise<string> {
  const availability = await checkAccessCodeAvailability(accessCode, personId);

  if (!availability.available) {
    throw new BadRequestError(availability.message);
  }

  return availability.accessCode;
}

function nextSequentialCode(prefix: string, existingCodes: string[]): string {
  const pattern = new RegExp(`^${prefix}(\\d{3})$`);
  let maxSequence = 0;

  for (const code of existingCodes) {
    const match = pattern.exec(code);

    if (!match) {
      continue;
    }

    maxSequence = Math.max(maxSequence, Number(match[1]));
  }

  const nextSequence = maxSequence + 1;

  if (nextSequence > 999) {
    throw new BadRequestError(`Se agotó la secuencia de códigos ${prefix}.`);
  }

  return `${prefix}${String(nextSequence).padStart(3, "0")}`;
}

export async function generatePersonAccessCode(personId: string): Promise<User> {
  const dataSource = await getDataSource();
  const person = await findPersonById(dataSource, personId);

  if (!person) {
    throw new NotFoundError(`No se encontró la persona con id "${personId}".`);
  }

  const accessRole = resolveAccessRoleForPerson(await staffRolesForPerson(personId));
  const existingCodes = await findAccessCodesByPrefix(dataSource, accessRole.codePrefix);
  let accessCode = nextSequentialCode(accessRole.codePrefix, existingCodes);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const availability = await checkAccessCodeAvailability(accessCode, personId);

    if (availability.available) {
      return upsertStaffUserAccessCode(dataSource, {
        personId,
        role: accessRole.role,
        accessCode,
        accessCodeHash: hashAccessCode(accessCode)
      });
    }

    accessCode = nextSequentialCode(accessRole.codePrefix, [...existingCodes, accessCode]);
  }

  throw new BadRequestError("No se pudo generar un código de acceso único.");
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

  const accessRole = resolveAccessRoleForPerson(await staffRolesForPerson(personId));
  const normalized = await assertAccessCodeAvailable(accessCode, personId);

  return upsertStaffUserAccessCode(dataSource, {
    personId,
    role: accessRole.role,
    accessCode: normalized,
    accessCodeHash: hashAccessCode(normalized)
  });
}
