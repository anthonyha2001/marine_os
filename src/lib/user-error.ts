/**
 * An error meant for the person using the app (shown as-is in the form). Thrown inside a
 * transaction to roll it back; the action catches it and returns { error: message }.
 */
export class UserError extends Error {}

/** The message to show for a UserError; anything else is rethrown. */
export function userErrorMessage(e: unknown): string {
  if (e instanceof UserError) return e.message;
  throw e;
}
