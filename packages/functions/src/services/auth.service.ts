import {
  findUserByEmail,
  findUserById,
  getDataSource,
  updateUserLastLogin,
  verifyPassword,
  type User
} from "@pegasus/core";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { createSessionToken } from "../lib/session.js";

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResult = {
  user: User;
  token: string;
};

function assertRootUser(user: User): void {
  if (!user.isActive) {
    throw new UnauthorizedError("Usuario inactivo.");
  }

  if (user.role !== "ROOT") {
    throw new ForbiddenError("El rol no tiene acceso habilitado en esta fase.");
  }
}

export async function loginRootUser(input: LoginInput): Promise<LoginResult> {
  const dataSource = await getDataSource();
  const user = await findUserByEmail(dataSource, input.email);

  if (!user?.passwordHash) {
    throw new UnauthorizedError("Credenciales inválidas.");
  }

  const isValidPassword = await verifyPassword(input.password, user.passwordHash);

  if (!isValidPassword) {
    throw new UnauthorizedError("Credenciales inválidas.");
  }

  assertRootUser(user);

  const lastLoginAt = new Date();
  await updateUserLastLogin(dataSource, user.id, lastLoginAt);
  user.lastLoginAt = lastLoginAt;

  return {
    user,
    token: createSessionToken(user.id, user.role)
  };
}

export async function getActiveRootUser(userId: string): Promise<User> {
  const dataSource = await getDataSource();
  const user = await findUserById(dataSource, userId);

  if (!user) {
    throw new UnauthorizedError("Sesión inválida.");
  }

  assertRootUser(user);

  return user;
}
