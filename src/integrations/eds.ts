/**
 * EDS / CRM / policy lookup, mocked for the POC. Returns the 8 EDS attributes
 * from the seeded Customer and Policy rows (or an empty result).
 */
import { db } from "@/lib/db";

export interface EdsAttributes {
  customerNo: string | null;
  customerName: string | null;
  vulnerable: boolean;
  vulnerableType: string | null;
  customerGrade: string | null;
  vip: boolean;
  policyNo: string | null;
  claimNo: string | null;
  agentCode: string | null;
  lineOfBusiness: string | null;
  product: string | null;
  source: "eds_mock";
}

export async function lookupEds(query: {
  email?: string | null;
  phone?: string | null;
  policyNo?: string | null;
}): Promise<{ customerId: string | null; attributes: EdsAttributes }> {
  const policy = query.policyNo
    ? await db.policy.findUnique({ where: { policyNo: query.policyNo }, include: { customer: true } })
    : null;
  const customer =
    policy?.customer ??
    (query.email || query.phone
      ? await db.customer.findFirst({
          where: {
            OR: [
              ...(query.email ? [{ email: { equals: query.email, mode: "insensitive" as const } }] : []),
              ...(query.phone ? [{ phone: query.phone.replace(/\s|-/g, "") }] : []),
            ],
          },
        })
      : null);
  const pol =
    policy ?? (customer ? await db.policy.findFirst({ where: { customerId: customer.id }, orderBy: { createdAt: "asc" } }) : null);

  return {
    customerId: customer?.id ?? null,
    attributes: {
      customerNo: customer?.customerNo ?? null,
      customerName: customer?.name ?? null,
      vulnerable: customer?.vulnerable ?? false,
      vulnerableType: customer?.vulnerableType ?? null,
      customerGrade: customer?.grade ?? null,
      vip: customer?.vip ?? false,
      policyNo: pol?.policyNo ?? null,
      claimNo: pol?.claimNo ?? null,
      agentCode: pol?.agentCode ?? null,
      lineOfBusiness: pol?.lineOfBusiness ?? null,
      product: pol?.product ?? null,
      source: "eds_mock",
    },
  };
}
