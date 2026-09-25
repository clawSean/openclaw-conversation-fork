import { createCommandHandler } from "./command.js";
import { resolveNativeHost } from "./native-host.js";

export default {
  id: "conversation-fork",
  name: "Conversation Fork",
  description: "Development preview of cross-channel forks; native host enablement required.",
  register(api) {
    const handler = createCommandHandler({ resolveHost: resolveNativeHost });
    for (const name of ["fork", "split"]) {
      api.registerCommand({
        name,
        description: name === "fork" ? "Branch this conversation (development preview)" : "Alias for /fork (development preview)",
        acceptsArgs: true,
        requireAuth: true,
        handler,
      });
    }
  },
};
