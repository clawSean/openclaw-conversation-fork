/**
 * Current SDK has no invocation-bound fork/place/return capability for ordinary
 * third-party commands. Deliberately unavailable, not a guessed runtime field.
 * Replace this adapter only after native SDK enablement and integration proof.
 * Tests inject the package-local contract; they do not prove native routing.
 * See docs/host-contract.md.
 */
export function resolveNativeHost(_context) {
  return undefined;
}
