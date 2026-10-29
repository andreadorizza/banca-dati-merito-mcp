import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { BdpContext } from "../bdp/client.ts";
import { BdpError, hintFor } from "../errors.ts";
import { requireSession } from "../session/status.ts";

export const ok = (value: unknown): CallToolResult => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});

/**
 * Turns expected failures into tool errors with a hint the model can act on.
 * Anything else propagates: the SDK reports it as a tool error with the raw message.
 */
export const run = async (task: () => Promise<CallToolResult>): Promise<CallToolResult> => {
  try {
    return await task();
  } catch (error) {
    if (error instanceof BdpError) {
      return { isError: true, content: [{ type: "text", text: `${error.message}\n${hintFor(error.code)}` }] };
    }
    throw error;
  }
};

/** `run` for tools that call BDP: loads the session and carries the request's cancellation signal. */
export const withBdp = (signal: AbortSignal, task: (ctx: BdpContext) => Promise<CallToolResult>): Promise<CallToolResult> =>
  run(async () => task({ session: await requireSession(), signal }));
