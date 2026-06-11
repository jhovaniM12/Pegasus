import type { User } from "@pegasus/core";

export type UserDto = {
  id: string;
  personId: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
};

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    personId: user.personId,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null
  };
}
