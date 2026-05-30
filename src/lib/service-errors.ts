/**
 * Typed, transport-agnostic domain errors thrown by the service layer
 * (src/lib/services/*). Each carries a message constant from @/lib/errors.
 * HTTP routes map these to status codes via @/lib/api-error-response; MCP
 * tools map them to isError results via @/lib/mcp/tool-helpers.
 *
 * MUST NOT import next/server or any transport — services depend on this.
 */
export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    // new.target resolves to the concrete subclass being constructed.
    this.name = new.target.name;
  }
}

/** Invalid input (missing/malformed fields, non-ObjectId id). Maps to 400. */
export class ValidationError extends ServiceError {}

/** Requested document does not exist (or is not visible). Maps to 404. */
export class NotFoundError extends ServiceError {}

/** Authenticated but not permitted to access/mutate this document. Maps to 403. */
export class ForbiddenError extends ServiceError {}

/** A uniqueness/state conflict (e.g. duplicate food item). Maps to 409. */
export class ConflictError extends ServiceError {
  readonly details?: string;
  constructor(message: string, details?: string) {
    super(message);
    this.details = details;
  }
}
