import { createHmac } from "node:crypto";

export function normalizeAccessCode(accessCode: string): string {
  return accessCode.trim().toUpperCase();
}

export function hashAccessCode(accessCode: string): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET no está configurado.");
  }

  const normalizedCode = normalizeAccessCode(accessCode);
  const digest = createHmac("sha256", secret).update(normalizedCode).digest("hex");

  return `hmac-sha256:${digest}`;
}
