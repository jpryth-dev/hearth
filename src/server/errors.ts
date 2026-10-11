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

/**
 * Thrown when a resource doesn't exist or the actor may not see it. The two
 * cases are deliberately indistinguishable so ids can't be probed. Pages turn
 * it into a 404.
 */
export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`Not found: ${resource}`);
    this.name = "NotFoundError";
  }
}
