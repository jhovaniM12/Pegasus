import type { DataSource } from "typeorm";
import { In } from "typeorm";
import { User, type UserRole } from "../entities/user.entity.js";

export async function findUserByEmail(
  dataSource: DataSource,
  email: string
): Promise<User | null> {
  return dataSource.getRepository(User).findOne({
    where: { email: email.toLowerCase() },
    relations: { person: true }
  });
}

export async function findUserById(dataSource: DataSource, id: string): Promise<User | null> {
  return dataSource.getRepository(User).findOne({
    where: { id },
    relations: { person: true }
  });
}

export async function findUserByPersonId(
  dataSource: DataSource,
  personId: string
): Promise<User | null> {
  return dataSource.getRepository(User).findOne({
    where: { personId },
    relations: { person: true }
  });
}

export async function findUsersByPersonIds(
  dataSource: DataSource,
  personIds: string[]
): Promise<User[]> {
  if (personIds.length === 0) {
    return [];
  }

  return dataSource.getRepository(User).find({
    where: { personId: In(personIds) },
    select: {
      id: true,
      personId: true,
      role: true,
      accessCode: true,
      accessCodeHash: true,
      isActive: true
    }
  });
}

export async function findUserByAccessCodeHash(
  dataSource: DataSource,
  accessCodeHash: string
): Promise<User | null> {
  return dataSource.getRepository(User).findOne({
    where: { accessCodeHash },
    relations: { person: true }
  });
}

export async function findUserByAccessCode(
  dataSource: DataSource,
  accessCode: string
): Promise<User | null> {
  return dataSource.getRepository(User).findOne({
    where: { accessCode },
    relations: { person: true }
  });
}

export async function findAccessCodesByPrefix(
  dataSource: DataSource,
  prefix: string
): Promise<string[]> {
  const rows = await dataSource
    .getRepository(User)
    .createQueryBuilder("user")
    .select("user.access_code", "accessCode")
    .where("user.access_code IS NOT NULL")
    .andWhere("user.access_code LIKE :pattern", { pattern: `${prefix}%` })
    .getRawMany<{ accessCode: string }>();

  return rows.map((row) => row.accessCode).filter(Boolean);
}

export async function upsertStaffUserAccessCode(
  dataSource: DataSource,
  input: {
    personId: string;
    role: UserRole;
    accessCode: string;
    accessCodeHash: string;
  }
): Promise<User> {
  const userRepo = dataSource.getRepository(User);
  const existingUser = await findUserByPersonId(dataSource, input.personId);

  if (existingUser) {
    existingUser.role = input.role;
    existingUser.accessCode = input.accessCode;
    existingUser.accessCodeHash = input.accessCodeHash;
    existingUser.isActive = true;
    return userRepo.save(existingUser);
  }

  const user = userRepo.create({
    personId: input.personId,
    email: null,
    passwordHash: null,
    role: input.role,
    accessCode: input.accessCode,
    accessCodeHash: input.accessCodeHash,
    isActive: true,
    lastLoginAt: null
  });

  return userRepo.save(user);
}

export async function updateUserLastLogin(
  dataSource: DataSource,
  id: string,
  lastLoginAt: Date
): Promise<void> {
  await dataSource.getRepository(User).update(id, { lastLoginAt });
}
