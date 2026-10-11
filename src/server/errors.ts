/**
 * Thrown when the acting user is not allowed to do something. Callers should
 * let it surface as an error page rather than catching it to show details.
 */
export class ForbiddenError extends Error {
  constructor(operation: string) {
    super(`Forbidden: ${operation}`);
    this.name = "ForbiddenError";
  }
}
