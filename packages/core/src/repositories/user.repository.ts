import type { DataSource } from "typeorm";
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

export async function findUserByAccessCodeHash(
  dataSource: DataSource,
  accessCodeHash: string
): Promise<User | null> {
  return dataSource.getRepository(User).findOne({
    where: { accessCodeHash },
    relations: { person: true }
  });
}

export async function upsertStaffUserAccessCode(
  dataSource: DataSource,
  input: {
    personId: string;
    role: UserRole;
    accessCodeHash: string;
  }
): Promise<User> {
  const userRepo = dataSource.getRepository(User);
  const existingUser = await findUserByPersonId(dataSource, input.personId);

  if (existingUser) {
    existingUser.role = input.role;
    existingUser.accessCodeHash = input.accessCodeHash;
    existingUser.isActive = true;
    return userRepo.save(existingUser);
  }

  const user = userRepo.create({
    personId: input.personId,
    email: null,
    passwordHash: null,
    role: input.role,
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
