/**
 * ServiceNow-style encoded queries, e.g.
 *   active=true^priority<=2^ORcategory=billing^NQstate=new^ORDERBYDESCopenedAt
 *
 * `^` is AND, `^OR` ORs a term with the previous one (binding tighter than AND),
 * `^NQ` starts a new OR'd query, and ORDERBY / ORDERBYDESC terms set the sort.
 */

export const OPERATORS = [
  "ISNOTEMPTY",
  "ISEMPTY",
  "CHANGESFROM",
  "CHANGESTO",
  "CHANGES",
  "STARTSWITH",
  "ENDSWITH",
  "NOT LIKE",
  "NOT IN",
  "LIKE",
  "IN",
  "!=",
  "<=",
  ">=",
  "=",
  "<",
  ">",
] as const;

export type Operator = (typeof OPERATORS)[number];

export interface Term {
  field: string;
  operator: Operator;
  value: string;
}

/** OR of alternatives. */
export type Clause = Term[];

export interface ParsedQuery {
  /** OR of groups; each group is an AND of clauses; each clause an OR of terms. */
  groups: Clause[][];
  orderBy: { field: string; direction: "asc" | "desc" }[];
}

export class QueryParseError extends Error {}

const OP_PATTERN = OPERATORS.map((op) => op.replace(/[.*+?^${}()|[\]\\!<>=]/g, "\\$&")).join("|");
// Lazy field match so a value that happens to look like an operator is not swallowed.
const TERM_RE = new RegExp(`^([A-Za-z_][\\w.]*?)(${OP_PATTERN})(.*)$`, "s");

export function parseTerm(raw: string): Term {
  const m = TERM_RE.exec(raw.trim());
  if (!m) throw new QueryParseError(`Cannot parse query term "${raw}"`);
  return { field: m[1], operator: m[2] as Operator, value: m[3] };
}

export function parseQuery(query: string | null | undefined): ParsedQuery {
  const result: ParsedQuery = { groups: [], orderBy: [] };
  if (!query || !query.trim()) return result;

  for (const groupStr of query.split("^NQ")) {
    const group: Clause[] = [];
    for (const rawPart of groupStr.split("^")) {
      const part = rawPart.trim();
      if (!part || part === "EQ") continue;
      if (part.startsWith("ORDERBYDESC")) {
        result.orderBy.push({ field: part.slice("ORDERBYDESC".length), direction: "desc" });
      } else if (part.startsWith("ORDERBY")) {
        result.orderBy.push({ field: part.slice("ORDERBY".length), direction: "asc" });
      } else if (part.startsWith("OR") && group.length > 0) {
        // Field names start lower-case, so an upper-case "OR" prefix is always the OR marker.
        group[group.length - 1].push(parseTerm(part.slice(2)));
      } else {
        group.push([parseTerm(part)]);
      }
    }
    if (group.length) result.groups.push(group);
  }
  return result;
}

// ---------- In-memory evaluation (business rules, SLAs, assignment) ----------

export interface EvalContext {
  userId?: string | null;
  /** Previous version of the record, for CHANGES / CHANGESTO / CHANGESFROM. */
  previous?: Record<string, unknown> | null;
}

function resolveToken(value: string, ctx: EvalContext): string {
  if (value === "@me" || value === "javascript:gs.getUserID()") return ctx.userId ?? "";
  return value;
}

export function getPath(record: Record<string, unknown> | null | undefined, path: string): unknown {
  let cur: unknown = record;
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    const obj = cur as Record<string, unknown>;
    cur = key in obj ? obj[key] : (obj.customFields as Record<string, unknown> | undefined)?.[key];
  }
  return cur;
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

function asComparable(v: unknown): number | string {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const s = String(v ?? "");
  if (s !== "" && !isNaN(Number(s))) return Number(s);
  const t = Date.parse(s);
  if (/^\d{4}-\d{2}-\d{2}/.test(s) && !isNaN(t)) return t;
  return s.toLowerCase();
}

function looseEquals(actual: unknown, expected: string): boolean {
  if (isEmpty(actual)) return expected === "";
  if (typeof actual === "boolean") return String(actual) === expected.toLowerCase();
  return asComparable(actual) === asComparable(expected);
}

export function evaluateTerm(record: Record<string, unknown>, term: Term, ctx: EvalContext = {}): boolean {
  const actual = getPath(record, term.field);
  const value = resolveToken(term.value, ctx);
  const str = String(actual ?? "").toLowerCase();
  const needle = value.toLowerCase();
  const list = value.split(",").map((s) => s.trim());

  switch (term.operator) {
    case "=":
      return looseEquals(actual, value);
    case "!=":
      return !looseEquals(actual, value);
    case "<":
    case "<=":
    case ">":
    case ">=": {
      if (isEmpty(actual)) return false;
      const a = asComparable(actual);
      const b = asComparable(value);
      if (term.operator === "<") return a < b;
      if (term.operator === "<=") return a <= b;
      if (term.operator === ">") return a > b;
      return a >= b;
    }
    case "IN":
      return list.some((v) => looseEquals(actual, v));
    case "NOT IN":
      return !list.some((v) => looseEquals(actual, v));
    case "LIKE":
      return str.includes(needle);
    case "NOT LIKE":
      return !str.includes(needle);
    case "STARTSWITH":
      return str.startsWith(needle);
    case "ENDSWITH":
      return str.endsWith(needle);
    case "ISEMPTY":
      return isEmpty(actual);
    case "ISNOTEMPTY":
      return !isEmpty(actual);
    case "CHANGES":
    case "CHANGESTO":
    case "CHANGESFROM": {
      if (!ctx.previous) {
        // On insert every populated field counts as changed (from empty).
        if (term.operator === "CHANGESFROM") return value === "";
        if (term.operator === "CHANGESTO") return looseEquals(actual, value);
        return !isEmpty(actual);
      }
      const before = getPath(ctx.previous, term.field);
      const changed = asComparable(before ?? "") !== asComparable(actual ?? "");
      if (!changed) return false;
      if (term.operator === "CHANGESTO") return looseEquals(actual, value);
      if (term.operator === "CHANGESFROM") return looseEquals(before, value);
      return true;
    }
  }
}

/** True when the record matches. An empty query matches everything. */
export function matches(
  record: Record<string, unknown>,
  query: string | ParsedQuery | null | undefined,
  ctx: EvalContext = {},
): boolean {
  const parsed = typeof query === "object" && query !== null ? query : parseQuery(query);
  if (parsed.groups.length === 0) return true;
  return parsed.groups.some((group) =>
    group.every((clause) => clause.some((term) => evaluateTerm(record, term, ctx))),
  );
}

// ---------- Translation to Prisma (lists and the Table API) ----------

export type FieldKind = "string" | "text" | "number" | "boolean" | "datetime" | "choice" | "reference" | "json";

export interface QueryableField {
  kind: FieldKind;
}

type Where = Record<string, unknown>;

function coerce(kind: FieldKind | undefined, raw: string): unknown {
  switch (kind) {
    case "number":
      if (raw === "" || isNaN(Number(raw))) throw new QueryParseError(`"${raw}" is not a number`);
      return Number(raw);
    case "boolean":
      return raw.toLowerCase() === "true";
    case "datetime": {
      const d = new Date(raw);
      if (isNaN(d.getTime())) throw new QueryParseError(`"${raw}" is not a date`);
      return d;
    }
    default:
      return raw;
  }
}

function nest(path: string, condition: unknown): Where {
  // "account.name" -> { account: { name: condition } }
  const parts = path.split(".");
  let out: unknown = condition;
  for (let i = parts.length - 1; i >= 0; i--) out = { [parts[i]]: out };
  return out as Where;
}

function termToWhere(term: Term, fields: Record<string, QueryableField>, ctx: EvalContext): Where {
  const rootField = term.field.split(".")[0];
  const field = fields[term.field] ?? (term.field.includes(".") ? { kind: "string" as const } : undefined);
  if (!field && !fields[rootField]) throw new QueryParseError(`Unknown field "${term.field}"`);
  const kind = field?.kind;
  const raw = resolveToken(term.value, ctx);
  const text = kind === "string" || kind === "text" || kind === "choice" || kind === "reference" || !kind;

  switch (term.operator) {
    case "=":
      return nest(term.field, raw === "" ? null : coerce(kind, raw));
    case "!=":
      return raw === ""
        ? nest(term.field, { not: null })
        : { OR: [nest(term.field, { not: coerce(kind, raw) }), nest(term.field, null)] };
    case "<":
      return nest(term.field, { lt: coerce(kind, raw) });
    case "<=":
      return nest(term.field, { lte: coerce(kind, raw) });
    case ">":
      return nest(term.field, { gt: coerce(kind, raw) });
    case ">=":
      return nest(term.field, { gte: coerce(kind, raw) });
    case "IN":
      return nest(term.field, { in: raw.split(",").map((v) => coerce(kind, v.trim())) });
    case "NOT IN":
      return nest(term.field, { notIn: raw.split(",").map((v) => coerce(kind, v.trim())) });
    case "LIKE":
    case "NOT LIKE":
    case "STARTSWITH":
    case "ENDSWITH": {
      if (!text) throw new QueryParseError(`${term.operator} needs a text field, "${term.field}" is ${kind}`);
      const op =
        term.operator === "STARTSWITH" ? "startsWith" : term.operator === "ENDSWITH" ? "endsWith" : "contains";
      const cond = { [op]: raw, mode: "insensitive" };
      return term.operator === "NOT LIKE" ? { NOT: nest(term.field, cond) } : nest(term.field, cond);
    }
    case "ISEMPTY":
      return text
        ? { OR: [nest(term.field, null), nest(term.field, "")] }
        : nest(term.field, null);
    case "ISNOTEMPTY":
      return text
        ? { AND: [nest(term.field, { not: null }), nest(term.field, { not: "" })] }
        : nest(term.field, { not: null });
    default:
      throw new QueryParseError(`${term.operator} only works in rule conditions, not list filters`);
  }
}

export function toPrismaQuery(
  query: string | null | undefined,
  fields: Record<string, QueryableField>,
  ctx: EvalContext = {},
): { where: Where; orderBy: Record<string, "asc" | "desc">[] } {
  const parsed = parseQuery(query);
  const groups = parsed.groups.map((group) => ({
    AND: group.map((clause) =>
      clause.length === 1 ? termToWhere(clause[0], fields, ctx) : { OR: clause.map((t) => termToWhere(t, fields, ctx)) },
    ),
  }));
  const where = groups.length === 0 ? {} : groups.length === 1 ? groups[0] : { OR: groups };
  const orderBy = parsed.orderBy.map((o) => {
    if (!fields[o.field]) throw new QueryParseError(`Unknown sort field "${o.field}"`);
    return { [o.field]: o.direction };
  });
  return { where, orderBy };
}
