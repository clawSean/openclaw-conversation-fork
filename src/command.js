import { parseArguments } from "./parse.js";
import { canFallback, destinationUrl, forkWithHost, isCompatibleHost } from "./policy.js";

export const HELP = [
  "Conversation Fork",
  "/fork [title] — preserve this history and branch at the current point.",
  "Reply + /fork — branch before that saved user prompt, then replay it once in the destination.",
  "/fork --back — return to the exact previous session for this fork lineage.",
  "/fork --status — inspect this conversation's last fork operation without changing it.",
  "/split is an alias. Use /fork -- title for a title containing --options.",
  "New topics/threads are preferred; safe in-place fallback includes a return path.",
  "The host owns session, placement, replay, and return effects; unsupported surfaces fail closed.",
].join("\n");

export const UNAVAILABLE = "This OpenClaw host does not expose compatible native fork support. No session or conversation binding was changed. See /fork --help.";
export const UNCONFIRMED = "The operation's outcome is unconfirmed. No further fallback or replay was attempted. Use /fork --status before retrying; host reconciliation may be required.";
const BLOCKED = new Map(Object.entries({
  unauthorized: "This operation is not authorized for this conversation. No change was made.",
  active_run: "Wait for the active run to finish before forking or returning. No change was made.",
  policy_disabled: "Session branching or binding is disabled here. No change was made.",
  reply_unavailable: "That reply cannot be mapped to an active saved user prompt in this conversation. No change was made.",
  media_unavailable: "Required media for that prompt is unavailable. No fork or replay was made.",
  unsupported: "This conversation has no supported, authorized placement and return path. No change was made.",
}));

function renderPlaced(result) {
  if (result.returnReady !== true || typeof result.shared !== "boolean" || !["tip", "reply"].includes(result.source)
    || result.replay !== (result.source === "reply" ? "submitted" : "none")) return UNCONFIRMED;
  const replay = result.source === "reply" ? " The selected prompt was submitted once in the new branch." : " No model turn was started.";
  if (result.placement === "child") {
    const url = destinationUrl(result.destinationUrl);
    return `Fork created in a new topic/thread.${url ? ` [Open branch](${url}).` : ""} The original conversation is unchanged.${replay}`;
  }
  if (result.placement !== "current") return UNCONFIRMED;
  const reason = result.fallbackReason === "permission_denied"
    ? "A new topic/thread could not be created with the available permissions. "
    : result.fallbackReason === "creation_failed"
      ? "New topic/thread creation failed without side effects. " : "A new topic/thread is unavailable here. ";
  const shared = result.shared ? " This switches the shared conversation, not just your messages." : "";
  return `${reason}Forked in this conversation; the original history is preserved.${shared}${replay} Return: /fork --back.`;
}

function renderReturned(result) {
  if (result.mode === "navigate") {
    const url = destinationUrl(result.destinationUrl);
    return url ? `Return to the previous conversation: [Open previous branch](${url}). No binding was changed.` : UNCONFIRMED;
  }
  if (result.mode !== "restored" || typeof result.shared !== "boolean") return UNCONFIRMED;
  return `The previous conversation route was restored.${result.shared ? " This restores the shared conversation for everyone using it." : ""} Neither history was deleted.`;
}

export function renderResult(result) {
  switch (result?.status) {
    case "placed": return renderPlaced(result);
    case "returned": return renderReturned(result);
    case "idle": return "No fork operation is recorded for this conversation.";
    case "no_previous": return "No previous fork binding is available here. Nothing was changed.";
    case "conflict": return "The conversation binding changed since this fork. Return was refused rather than replacing someone else's change.";
    case "blocked": return BLOCKED.get(result.reason) ?? "The host refused this operation. No change was made.";
    case "unsupported": return BLOCKED.get("unsupported");
    case "not_placed": return canFallback(result)
      ? "The fork could not be placed. The host confirmed no lasting session, topic, or conversation binding changes. No prompt was submitted."
      : UNCONFIRMED;
    case "pending": return "The host is reconciling this operation. Do not repeat it yet; use /fork --status.";
    default: return UNCONFIRMED;
  }
}

/** Status reports history, not a new action or a fresh routing observation. */
export function renderStatus(result) {
  let summary = renderResult(result);
  if (summary !== UNCONFIRMED && result?.status === "placed") {
    summary = result.placement === "child"
      ? `A fork was placed in a child topic/thread.${destinationUrl(result.destinationUrl) ? ` [Recorded branch](${destinationUrl(result.destinationUrl)}).` : ""}`
      : "A fork was placed in this conversation at the time.";
  } else if (summary !== UNCONFIRMED && result?.status === "returned") {
    summary = result.mode === "navigate"
      ? `A return link was recorded: [Previous branch](${destinationUrl(result.destinationUrl)}).`
      : "The previous selection was restored at the time.";
  }
  return `Read-only status — latest recorded outcome, not a check of the current route.\n${summary}\nThis status request changed nothing.`;
}

/** resolveHost is a package-local test/integration seam, not a plugin config field. */
export function createCommandHandler({ resolveHost }) {
  return async (context) => {
    if (context?.isAuthorizedSender !== true) return { text: "You are not authorized to use this command." };
    const command = parseArguments(context.args);
    if (command.kind === "help") return { text: HELP };
    if (command.kind === "invalid") return { text: "Invalid arguments. Use /fork [title], /fork --back, /fork --status, or /fork --help. Titles must be at most 100 characters." };
    try {
      const host = await resolveHost(context);
      if (!isCompatibleHost(host)) return { text: UNAVAILABLE };
      const result = command.kind === "back" ? await host.back()
        : command.kind === "status" ? await host.status() : await forkWithHost(host, command.title);
      if (command.kind === "back" && !["returned", "no_previous", "conflict", "blocked", "pending"].includes(result?.status)) {
        return { text: UNCONFIRMED };
      }
      return { text: command.kind === "status" ? renderStatus(result) : renderResult(result) };
    } catch {
      // Never send raw exceptions, tickets, identifiers, paths, or secrets to chat.
      return { text: UNCONFIRMED };
    }
  };
}
