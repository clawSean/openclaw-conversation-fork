const MAX_ARGUMENT_LENGTH = 2048;
export const MAX_TITLE_CODEPOINTS = 100;
const UNSAFE_CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u;
const OPTIONS = new Map([["--help", "help"], ["--back", "back"], ["--status", "status"]]);

/** Parse arguments only; no session IDs, paths, or transport IDs are inputs. */
export function parseArguments(args) {
  if (args === undefined) return { kind: "fork" };
  if (typeof args !== "string" || args.length > MAX_ARGUMENT_LENGTH || !args.isWellFormed() || UNSAFE_CONTROLS.test(args)) return { kind: "invalid" };
  const value = args.trim().normalize("NFC");
  if (!value) return { kind: "fork" };
  if (OPTIONS.has(value)) return { kind: OPTIONS.get(value) };
  // `-- title` explicitly permits literal titles containing --options.
  const literal = value.startsWith("-- ");
  const title = (literal ? value.slice(3) : value).replace(/\s+/gu, " ").trim();
  if (!title || (!literal && /(^|\s)--/u.test(title))) return { kind: "invalid" };
  if (Array.from(title).length > MAX_TITLE_CODEPOINTS) return { kind: "invalid" };
  return { kind: "fork", title };
}
