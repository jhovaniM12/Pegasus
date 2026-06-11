import type { User } from "@pegasus/core";

export type UserDto = {
  id: string;
  personId: string | null;
  personName: string | null;
  email: string | null;
  role: string;
  roleLabel: string;
  isActive: boolean;
  lastLoginAt: string | null;
};

function formatUserRole(role: string): string {
  const labels: Record<string, string> = {
    ROOT: "Root",
    ADMIN: "Administrador",
    JUDGE: "Juez",
    TECHNICAL_DIRECTOR: "Director técnico",
    VETERINARIAN: "Veterinario autorizado",
    STAFF: "Staff",
    VIEWER: "Visualizador",
  };

  return labels[role] ?? role;
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    personId: user.personId,
    personName: user.person ? `${user.person.name} ${user.person.lastName}`.trim() : null,
    email: user.email,
    role: user.role,
    roleLabel: formatUserRole(user.role),
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null
  };
}
