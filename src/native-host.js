/** Resolve only the documented invocation-bound host capability. */
export function resolveNativeHost(context) {
  return context?.runtimeContext?.conversationFork;
}
