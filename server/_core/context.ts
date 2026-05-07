import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import type { Server as SocketIOServer } from "socket.io";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  io: SocketIOServer | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Access the socket.io instance attached to the Express app
  const io = ((opts.req.app as any).io as SocketIOServer) ?? null;

  return {
    req: opts.req,
    res: opts.res,
    user,
    io,
  };
}
