import {
  findUserByAccessCodeHash,
  findUserByEmail,
  findUserById,
  getDataSource,
  updateUserLastLogin,
  verifyPassword,
  type User
} from "@pegasus/core";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { hashAccessCode } from "../lib/access-code.js";
import { createSessionToken } from "../lib/session.js";

// ─── User cache ───────────────────────────────────────────────────────────────
// Evita un SELECT a la BD en cada request protegido. TTL corto para que
// cambios de estado (isActive) se propaguen rápidamente.
const USER_CACHE_TTL_MS = 30_000;
const userCache = new Map<string, { user: User; expiresAt: number }>();

function getCachedUser(userId: string): User | null {
  const entry = userCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    userCache.delete(userId);
    return null;
  }
  return entry.user;
}

function setCachedUser(user: User): void {
  userCache.set(user.id, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
}

export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
}

export type LoginInput = {
  email: string;
  password: string;
};

export type AccessCodeLoginInput = {
  accessCode: string;
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
  invalidateUserCache(user.id);

  return {
    user,
    token: createSessionToken(user.id, user.role)
  };
}

export async function loginByAccessCode(input: AccessCodeLoginInput): Promise<LoginResult> {
  const dataSource = await getDataSource();
  const accessCodeHash = hashAccessCode(input.accessCode);
  const user = await findUserByAccessCodeHash(dataSource, accessCodeHash);

  if (!user) {
    throw new UnauthorizedError("Código de acceso inválido.");
  }

  if (!user.isActive) {
    throw new UnauthorizedError("Usuario inactivo.");
  }

  if (!["JUDGE", "TECHNICAL_DIRECTOR", "VETERINARIAN"].includes(user.role)) {
    throw new ForbiddenError("El rol no tiene acceso por código habilitado.");
  }

  const lastLoginAt = new Date();
  await updateUserLastLogin(dataSource, user.id, lastLoginAt);
  user.lastLoginAt = lastLoginAt;
  invalidateUserCache(user.id);

  return {
    user,
    token: createSessionToken(user.id, user.role)
  };
}

export async function getActiveUser(userId: string): Promise<User> {
  const cached = getCachedUser(userId);
  if (cached) return cached;

  const dataSource = await getDataSource();
  const user = await findUserById(dataSource, userId);

  if (!user) {
    throw new UnauthorizedError("Sesión inválida.");
  }

  if (!user.isActive) {
    throw new UnauthorizedError("Usuario inactivo.");
  }

  setCachedUser(user);
  return user;
}

export async function getActiveStaffUser(userId: string): Promise<User> {
  const user = await getActiveUser(userId);

  if (!["ROOT", "JUDGE", "TECHNICAL_DIRECTOR", "VETERINARIAN"].includes(user.role)) {
    throw new ForbiddenError("El rol no tiene acceso a este dashboard.");
  }

  if (user.role !== "ROOT" && !user.personId) {
    throw new ForbiddenError("El usuario no está asociado a una persona.");
  }

  return user;
}

export async function getActiveRootUser(userId: string): Promise<User> {
  const user = await getActiveUser(userId);
  assertRootUser(user);

  return user;
}
