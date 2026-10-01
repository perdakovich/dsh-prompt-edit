/* Hand-written Typert host face for dsh-prompt-edit.
 * Registered automatically by `@deepseek-ai/dsh-typert-loader` because this
 * package exports `./typert`. Keep this in sync with the service method in
 * `lib/index.js` and the client descriptors in `lib/client.js`. */
import { z } from "zod";
import { strictCodec } from "./compat.host.js";

const resolveResultSchema = z.union([
  z.object({ ok: z.literal(true), mode: z.literal("fork"), childId: z.string(), oldSessionId: z.string() }),
  z.object({ ok: z.literal(true), mode: z.literal("fresh"), childId: z.string(), oldSessionId: z.string() }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

const detachResultSchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

export const TYPERT = {
  package: "dsh-prompt-edit",
  face: "host",
  schemas: [],
  invocations: [
    {
      id: "dsh-prompt-edit#promptEdit/resolve",
      service: "promptEdit",
      namespace: "promptEdit",
      method: "resolve",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "sessionId",
          wire: "sessionId",
          source: "json",
          codec: strictCodec("string", () => z.string()),
        },
        {
          name: "seq",
          wire: "seq",
          source: "json",
          codec: strictCodec("number", () => z.number()),
        },
        {
          name: "text",
          wire: "text",
          source: "json",
          codec: strictCodec("string", () => z.string()),
        },
      ],
      result: strictCodec("dsh-prompt-edit#promptEdit/resolve:result", () => resolveResultSchema),
      sourceLocation: { file: "lib/index.js", line: 1, column: 1 },
    },
    {
      id: "dsh-prompt-edit#promptEdit/detach",
      service: "promptEdit",
      namespace: "promptEdit",
      method: "detach",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "sessionId",
          wire: "sessionId",
          source: "json",
          codec: strictCodec("string", () => z.string()),
        },
      ],
      result: strictCodec("dsh-prompt-edit#promptEdit/detach:result", () => detachResultSchema),
      sourceLocation: { file: "lib/index.js", line: 1, column: 1 },
    },
  ],
  model: { services: [], events: [], objects: [] },
};
