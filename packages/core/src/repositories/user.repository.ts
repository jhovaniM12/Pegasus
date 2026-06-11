import type { DataSource } from "typeorm";
import { User } from "../entities/user.entity.js";

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

export async function updateUserLastLogin(
  dataSource: DataSource,
  id: string,
  lastLoginAt: Date
): Promise<void> {
  await dataSource.getRepository(User).update(id, { lastLoginAt });
}
