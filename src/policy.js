/** Package-local experiment, NOT an OpenClaw SDK export. */
export const HOST_CONTRACT_VERSION = 1;
const METHODS = ["prepare", "execute", "back", "status"];
const FALLBACK_REASONS = new Set(["unsupported", "permission_denied", "creation_failed"]);

export function isCompatibleHost(host) {
  return host?.version === HOST_CONTRACT_VERSION && METHODS.every((key) => typeof host[key] === "function");
}

export function isPrepared(result) {
  return result?.status === "ready"
    && typeof result.ticket === "string" && result.ticket.length > 0 && result.ticket.length <= 512
    && typeof result.child === "boolean" && typeof result.current === "boolean"
    && typeof result.shared === "boolean"
    && (result.source === "tip" || result.source === "reply");
}

export function canFallback(result) {
  // none covers BOTH session and native placement effects, not just routing.
  return result?.status === "not_placed" && result.effect === "none" && FALLBACK_REASONS.has(result.reason);
}

export function destinationUrl(value) {
  if (typeof value !== "string" || value.length > 2048 || !value.isWellFormed() || /[\s<>"\\\u0000-\u001f\u007f-\u009f]/u.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return undefined;
    return url.href.replace(/\(/gu, "%28").replace(/\)/gu, "%29");
  } catch { return undefined; }
}

export function isPlaced(result, plan, placement) {
  return result?.status === "placed" && result.placement === placement && result.returnReady === true
    && result.source === plan.source && result.shared === plan.shared
    && result.replay === (plan.source === "reply" ? "submitted" : "none")
    && (placement !== "child" || Boolean(destinationUrl(result.destinationUrl)));
}

/** Deterministic selection; native owner retains all effects, authority and state. */
export async function forkWithHost(host, title) {
  const plan = await host.prepare(title === undefined ? {} : { title });
  if (!isPrepared(plan)) {
    if (plan?.status === "blocked") return { status: "blocked", reason: plan.reason };
    return { status: plan?.status === "pending" ? "pending" : "unconfirmed" };
  }
  if (!plan.child && !plan.current) return { status: "unsupported" };
  let fallbackReason;
  if (plan.child) {
    const result = await host.execute({ ticket: plan.ticket, placement: "child" });
    if (isPlaced(result, plan, "child")) return result;
    if (result?.status === "blocked") return { status: "blocked", reason: result.reason };
    if (result?.status === "pending") return { status: "pending" };
    if (!canFallback(result)) return { status: "unconfirmed" };
    if (!plan.current) return { status: "unsupported" };
    fallbackReason = result.reason;
  } else { fallbackReason = "unsupported"; }
  const result = await host.execute({ ticket: plan.ticket, placement: "current" });
  if (isPlaced(result, plan, "current")) return { ...result, fallbackReason };
  if (canFallback(result)) return { status: "not_placed", effect: "none", reason: result.reason };
  if (result?.status === "blocked") return { status: "blocked", reason: result.reason };
  return { status: result?.status === "pending" ? "pending" : "unconfirmed" };
}
