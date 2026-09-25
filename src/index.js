import { createCommandHandler } from "./command.js";
import { resolveNativeHost } from "./native-host.js";

export default {
  id: "conversation-fork",
  name: "Conversation Fork",
  description: "Cross-channel conversation forks with child placement and reversible in-place fallback.",
  register(api) {
    const handler = createCommandHandler({ resolveHost: resolveNativeHost });
    for (const name of ["fork", "split"]) {
      api.registerCommand({
        name,
        description: name === "fork" ? "Branch this conversation" : "Alias for /fork",
        acceptsArgs: true,
        requireAuth: true,
        handler,
      });
    }
  },
};
