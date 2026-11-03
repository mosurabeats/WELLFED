import { checkAccess } from "@/lib/server/guard";
import { availableProviders } from "@/lib/server/ai";

export async function GET(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  return Response.json({ providers: availableProviders(), accessCodeRequired: !!process.env.APP_ACCESS_CODE });
}
