/**
 * Record-level access per BSD section 7. Pure functions over the user and case.
 */
import type { Role } from "./constants";

export interface Actor {
  id: string;
  name: string;
  roles: string[];
  buId: string | null;
  teamId: string | null;
  /** Teams this user leads. */
  ledTeamIds: string[];
}

export interface CaseScope {
  caseManagerId: string | null;
  teamId: string | null;
  buId: string | null;
  confidential: boolean;
  vip: boolean;
  vulnerable: boolean;
  /** BU ids holding a sub-ticket on this case. */
  subTicketBuIds?: string[];
}

const has = (a: Actor, ...roles: Role[]) => roles.some((r) => a.roles.includes(r));

export function isAdmin(a: Actor) {
  return has(a, "admin");
}

/** May open the case at all (Case 360 or the query page). */
export function canReadCase(a: Actor, c: CaseScope): boolean {
  if (has(a, "admin", "service", "ce_team", "head_of_ce", "frontliner")) return true;
  if (has(a, "case_manager") && c.caseManagerId === a.id) return true;
  if (has(a, "team_lead") && c.teamId && a.ledTeamIds.includes(c.teamId)) return true;
  if (has(a, "bu_staff") && a.buId && (c.subTicketBuIds ?? []).includes(a.buId)) return true;
  if (has(a, "case_manager", "team_lead")) return !isSensitive(c); // read-only peek at non-sensitive cases
  return false;
}

/** May change case fields, communicate, raise sub-tickets, resolve. */
export function canEditCase(a: Actor, c: CaseScope): boolean {
  if (has(a, "admin", "service")) return true;
  return has(a, "case_manager") && c.caseManagerId === a.id;
}

/** Team leads re-allocate within their teams; CE team re-allocates significant work. */
export function canReallocate(a: Actor, c: CaseScope): boolean {
  if (has(a, "admin", "head_of_ce")) return true;
  return has(a, "team_lead") && Boolean(c.teamId && a.ledTeamIds.includes(c.teamId));
}

export function isSensitive(c: Pick<CaseScope, "confidential" | "vip" | "vulnerable">): boolean {
  return c.confidential || c.vip || c.vulnerable;
}

/** Whether sensitive details are masked for this viewer (query page and lists). */
export function shouldMask(a: Actor, c: CaseScope): boolean {
  if (!isSensitive(c)) return false;
  if (has(a, "admin", "head_of_ce", "service")) return false;
  if (c.caseManagerId === a.id) return false;
  if (has(a, "team_lead") && c.teamId && a.ledTeamIds.includes(c.teamId)) return false;
  return true;
}

export const MASK = "•••••• (restricted)";

/** Masks free text and identifiers on a case-shaped object. */
export function maskCase<T extends Record<string, unknown>>(c: T): T {
  const out: Record<string, unknown> = { ...c };
  for (const k of ["description", "complainantEmail", "complainantPhone", "policyNo", "claimNo", "agentCode", "desiredOutcome"]) {
    if (out[k]) out[k] = MASK;
  }
  if (typeof out.complainantName === "string" && out.complainantName) {
    out.complainantName = out.complainantName.charAt(0) + "•••";
  }
  return out as T;
}

export function canUseQaModule(a: Actor) {
  return has(a, "qa", "admin");
}
export function canApprove(a: Actor, role: string) {
  return isAdmin(a) || a.roles.includes(role);
}
