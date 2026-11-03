export type HealthStatus = {
  success: true;
  service: string;
  status: "healthy";
};

export function getHealthStatus(): HealthStatus {
  return {
    success: true,
    service: process.env.SERVICE_NAME ?? "pegaso-api",
    status: "healthy"
  };
}
