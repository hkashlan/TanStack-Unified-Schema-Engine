/**
 * Thrown when a member attempts an operation they are not permitted to perform.
 * Corresponds to HTTP 403 Forbidden.
 */
export class AuthorizationError extends Error {
  readonly status = 403;

  constructor(message = "Forbidden") {
    super(message);
    this.name = "AuthorizationError";
    // Maintain proper prototype chain in transpiled environments
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
