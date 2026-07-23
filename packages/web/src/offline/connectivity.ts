export type ConnectivityState = "ONLINE" | "OFFLINE" | "DEGRADED";

const CONNECTIVITY_URL = "/api/health";
const CONNECTIVITY_TIMEOUT_MS = 3500;

type HealthResponse = {
  success?: unknown;
  status?: unknown;
};

export async function checkPegasusConnectivity(): Promise<boolean> {
  if (!navigator.onLine) {
    return false;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CONNECTIVITY_TIMEOUT_MS);

  try {
    const response = await fetch(`${CONNECTIVITY_URL}?t=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      return false;
    }

    const body = (await response.json()) as HealthResponse;
    return body.success === true && body.status === "healthy";
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
