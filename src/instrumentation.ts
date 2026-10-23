// Runs once when the Next.js server starts. The scheduler lives in a Node-only file, imported
// under this exact condition so it is left out of the edge build.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
