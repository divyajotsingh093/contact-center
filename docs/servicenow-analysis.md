# How ServiceNow works, and how we copy it

ServiceNow is a hosted SaaS product, so there is no binary or bundle to take apart.
This breakdown comes from its public behaviour: the documented REST APIs, the data
model you can see in any instance (`sys_db_object`, `sys_dictionary`, `task`), and
how its engines act on records. Each section ends with what this repo does in its place.

## 1. Everything is a record in a table

ServiceNow is one big relational database with a metadata layer on top.

- **Tables** are listed in `sys_db_object`, and **fields** in `sys_dictionary`
  (type, label, mandatory, choices, reference target). Forms, lists and the REST API
  are all generated from this metadata, not hand-written per table.
- Every record has a 32-character `sys_id` plus `sys_created_on/by` and
  `sys_updated_on/by`.
- Tables **extend** each other. `task` is the base for `incident`, `problem`,
  `change_request`, and in Customer Service Management (CSM) for `sn_customerservice_case`.
  Every task has a number, state, priority, assignment group, assigned-to and work notes.
- **Reference fields** are foreign keys to other tables. "Dot-walking"
  (`caller_id.company.name`) follows them in queries and scripts.
- **Numbering** (`sys_number`) gives readable IDs like `INC0010001`, `CS0001001`.

**Ours:** `src/platform/dictionary.ts` is the data dictionary. Each table declares
its fields, types, choices, references, list columns and access rules. The Table
API, the generic list/form pages and validation all read from it. Records keep
ServiceNow-style `number`, `createdAt/By` and `updatedAt/By`. `Case` plays the role
of a `task` subclass. Custom fields (`FieldDefinition` plus the `customFields` JSON
column) let admins add fields without a migration, as `sys_dictionary` does.

## 2. Encoded queries

Filters everywhere (list filters, the REST `sysparm_query`, rule conditions, ACLs,
SLA conditions) use one string language:

```
active=true^priority<=2^ORcategory=billing^NQstate=new^ORDERBYDESCopened_at
```

- `^` means AND. `^OR` means OR with the previous term, and binds tighter than AND.
  `^NQ` starts a new query that is OR'd with the rest.
- Operators include `= != < > <= >= IN NOT IN LIKE NOT LIKE STARTSWITH ENDSWITH
  ISEMPTY ISNOTEMPTY`. Rule conditions also get `CHANGES`, `CHANGESTO` and `CHANGESFROM`.
- Terms ending in `ORDERBY<field>` or `ORDERBYDESC<field>` set the sort order.
- `javascript:gs.getUserID()` stands for "the current user".

**Ours:** `src/platform/encoded-query.ts` parses that grammar. It can evaluate a
query against a record in memory (for rules and SLAs) and translate it into a
Prisma `where`/`orderBy` (for lists and the API). `@me` and
`javascript:gs.getUserID()` both mean the current user.

## 3. The record lifecycle (GlideRecord and business rules)

When ServiceNow writes a record, server logic runs in a fixed order:

1. **Before business rules** (sorted by `order`) can change `current` or abort the
   write with `current.setAbortAction(true)`.
2. **Data policies and mandatory fields** are checked.
3. The record is written. Every changed field goes to `sys_audit`, and
   journal fields (work notes, comments) go to `sys_journal_field`.
4. **After business rules** run, then **async** ones.
5. Engines that listen to the write run: assignment rules, the SLA engine,
   notifications, Flow Designer triggers.

Business rules have a table, when they run (before/after), the operations they
fire on (insert/update/delete), a condition (an encoded query, which may use
`CHANGES`), and a script. No-code rules use "Actions": set field values, add a
message, abort.

**Ours:** `src/platform/record-service.ts` runs that pipeline inside a single
database transaction. `src/platform/rules.ts` evaluates `BusinessRule` rows (an
encoded-query condition plus declarative actions: `setFields`, `addWorkNote`,
`abort`) alongside the built-in system rules:

- priority = lookup(impact, urgency), the stock ServiceNow priority matrix
- moving to Resolved requires resolution notes and stamps `resolvedAt`
- Closed and Cancelled are terminal states
- `closedAt` is stamped automatically

Scripted rules (server-side JS) are deliberately left out: running tenant code
safely needs a sandbox, which is a later phase.

## 4. Assignment

Assignment rules (`sysrule_assignment`) match a condition and set an assignment
group and/or user. Advanced Work Assignment (AWA) then pushes work to available
agents in a queue, based on capacity.

**Ours:** `AssignmentRule` has a condition and a target group, plus a strategy:
`group_only`, `round_robin` or `least_loaded`. Least-loaded picks the active group
member with the fewest open cases, which is a simplified AWA.

## 5. SLAs

An SLA definition has a table, a **start**, **pause** and **stop** condition, and a
duration. The engine attaches a `task_sla` row to each matching task and moves it
through *In progress → Paused → Completed/Cancelled*. Time spent paused pushes the
breach time back. A scheduled job flags breaches and fires escalations.

**Ours:** `src/platform/sla.ts` is a pure state machine that takes (definition,
existing TaskSla, record, now) and returns a transition. The record service runs it
on every write. `POST /api/sla/check` is the scheduled job that sets the `breached`
flag. Lists show remaining time and percentage used.

## 6. Access control

ACLs (`sys_security_acl`) are written per table and per field, for each operation
(read, write, create, delete). They are granted by role and may add a condition
or script. `admin` overrides everything.

**Ours:** each table in the dictionary declares the roles allowed per operation.
`src/platform/acl.ts` enforces them in the record service, so the API and UI share
one gate. Roles: `admin`, `agent`, `knowledge_manager`, `viewer`.

## 7. REST Table API

`/api/now/table/{table}` with GET/POST and `/{sys_id}` with GET/PATCH/PUT/DELETE.
Parameters: `sysparm_query`, `sysparm_limit`, `sysparm_offset`, `sysparm_fields`,
`sysparm_display_value`. Responses come wrapped as `{ "result": ... }`.

**Ours:** the same paths and parameters, returning `{ result }`, and going through
the same record service so rules, SLAs, audit and ACLs all still apply.

## 8. Customer Service Management (the contact center app)

CSM sits on the platform. It adds Accounts, Contacts, Cases, channels
(phone/email/chat/web), the Agent Workspace (queues, a case form with a timeline,
SLA timers and suggested knowledge articles) and a Knowledge Base (`kb_knowledge`).

**Ours (MVP):** an Agent Workspace with a dashboard, case queues (My work, My
groups, Unassigned, All), a case form with an activity timeline (work notes,
customer comments and field changes), SLA timers, knowledge suggestions, Accounts,
Contacts, a Knowledge Base, and admin pages for rules, SLAs, groups and custom
fields. All of it is built from the dictionary.

## What ServiceNow has that this MVP doesn't (roadmap)

| ServiceNow feature | Status here |
|---|---|
| Table inheritance (`task` → `case`/`incident`) | Not built; `Case` is a single table. Next step: a shared `Task` base with a per-class extension. |
| Scripted business rules and client scripts | Declarative actions only. Needs a sandboxed JS runtime. |
| Flow Designer (visual workflows) | Not built |
| Notifications (email/SMS) | Not built; would hang off after-rules |
| Omnichannel (telephony/CTI, chat, email ingestion) | `channel` field only |
| Customer self-service portal | Not built |
| Update sets / app scoping / multi-tenancy | Not built |
| Performance Analytics / reporting | Dashboard counts only |
| SSO/OAuth | A development login picker stands in for it |
