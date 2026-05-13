import { send, type Msg, type Reply } from "./messages";

/**
 * Send a message and assert the reply is of an expected kind.
 * Throws a clear error if the SW returned a different kind (e.g. an `error` reply).
 *
 * Removes the boilerplate of:
 *   const reply = await send({ kind: "..." });
 *   if (reply.kind === "...") setX(reply.X);
 *
 * Use:
 *   const settings = (await sendAs("get-settings", "settings")).settings;
 */
export async function sendAs<K extends Reply["kind"]>(
  msg: Msg,
  expected: K,
): Promise<Extract<Reply, { kind: K }>> {
  const reply = await send(msg);
  if (reply.kind !== expected) {
    if (reply.kind === "error") {
      throw new Error(reply.message);
    }
    throw new Error(`expected reply kind "${expected}", got "${reply.kind}"`);
  }
  return reply as Extract<Reply, { kind: K }>;
}
