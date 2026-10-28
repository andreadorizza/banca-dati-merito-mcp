import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BdpError, hintFor } from "../errors.ts";

export const ok = (value: unknown): CallToolResult => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});

/**
 * Turns failures into tool errors the model can act on. Unexpected errors are
 * rethrown: the SDK reports them as protocol errors rather than masking a bug.
 */
export const run = async (task: () => Promise<CallToolResult>): Promise<CallToolResult> => {
  try {
    return await task();
  } catch (error) {
    if (error instanceof BdpError) {
      return { isError: true, content: [{ type: "text", text: `${error.message}\n${hintFor(error.code)}` }] };
    }
    if (error instanceof RangeError) {
      return { isError: true, content: [{ type: "text", text: `${error.message}\n${hintFor("parametri")}` }] };
    }
    throw error;
  }
};
