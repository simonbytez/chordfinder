import { connection, type NextRequest } from "next/server";
import { handleDrumScrollApi } from "@ds/server/api";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ route?: string[] }> };

async function dispatch(req: NextRequest, ctx: RouteContext) {
  await connection();
  const { route = [] } = await ctx.params;
  return handleDrumScrollApi(req, route);
}

export const GET = dispatch;
export const POST = dispatch;
export const PATCH = dispatch;
