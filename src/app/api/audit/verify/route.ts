import { route } from "@/lib/api";
import { verifyAuditChain } from "@/ccms/audit";

export const GET = route({ roles: ["admin", "head_of_ce", "service"] }, async () => verifyAuditChain());
