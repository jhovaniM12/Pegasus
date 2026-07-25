import { describe, expect, it } from "vitest";
import type { User, UserRole } from "@pegasus/core";
import { assertUserRole } from "./shared.js";

function userWithRole(role: UserRole): User {
  return { role } as User;
}

describe("assertUserRole", () => {
  it("permite el reinicio de categoría solo al Director Técnico", () => {
    expect(() =>
      assertUserRole(userWithRole("TECHNICAL_DIRECTOR"), ["TECHNICAL_DIRECTOR"])
    ).not.toThrow();
  });

  it("bloquea el reinicio a jueces o veterinarios en cualquier entorno", () => {
    expect(() => assertUserRole(userWithRole("JUDGE"), ["TECHNICAL_DIRECTOR"])).toThrow(
      "El rol no puede ejecutar esta accion."
    );
    expect(() =>
      assertUserRole(userWithRole("VETERINARIAN"), ["TECHNICAL_DIRECTOR"])
    ).toThrow("El rol no puede ejecutar esta accion.");
  });
});
