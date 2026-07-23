export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND");
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400, "BAD_REQUEST");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403, "FORBIDDEN");
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, 409, code, details);
  }
}

export type RevisionConflictDetails = {
  aggregateId: string;
  expectedRevision: number;
  currentRevision: number;
  currentState: unknown;
  resolution: "RELOAD_REQUIRED" | "CAN_REAPPLY_LOCAL_DRAFT";
};

export class RevisionConflictError extends ConflictError {
  constructor(details: RevisionConflictDetails) {
    super(
      "El registro cambió en el servidor desde la última sincronización.",
      "REVISION_CONFLICT",
      details
    );
  }
}

export class IdempotencyKeyReusedError extends ConflictError {
  constructor(operationId: string) {
    super(
      "El identificador de operación ya fue utilizado con un contenido diferente.",
      "IDEMPOTENCY_KEY_REUSED",
      { operationId }
    );
  }
}

export class FormClosedError extends ConflictError {
  constructor(aggregateId: string) {
    super("El formulario ya está cerrado y no admite cambios.", "FORM_CLOSED", {
      aggregateId,
      resolution: "RELOAD_REQUIRED",
    });
  }
}

export class StageAdvancedError extends ConflictError {
  constructor(stageId: string) {
    super("La etapa avanzó mientras el dispositivo estaba sin conexión.", "STAGE_ADVANCED", {
      stageId,
      resolution: "RELOAD_REQUIRED",
    });
  }
}

export class OfflinePayloadInvalidError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, "OFFLINE_PAYLOAD_INVALID", details);
  }
}
