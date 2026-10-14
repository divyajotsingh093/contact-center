/**
 * Synthetic POC data built to BSD v1.2 (used until Income's sample set arrives).
 * Idempotent: re-running resets reference data but keeps cases.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const BUS = [
  { code: "CE", name: "Customer Experience" },
  { code: "CLAIMS", name: "Claims" },
  { code: "DIST", name: "Distribution" },
  { code: "LIFE", name: "Life Business" },
  { code: "GI", name: "General Insurance" },
  { code: "HEALTH", name: "Health Business" },
  { code: "COMPLIANCE", name: "Compliance" },
];

const TEAMS: { name: string; bu: string }[] = [
  { name: "CE Complaints", bu: "CE" },
  { name: "CE Significant", bu: "CE" },
  { name: "CE Service", bu: "CE" },
  { name: "Claims Ops", bu: "CLAIMS" },
  { name: "Distribution Support", bu: "DIST" },
  { name: "Life Appeals", bu: "LIFE" },
  { name: "GI Appeals", bu: "GI" },
  { name: "Health Appeals", bu: "HEALTH" },
];

type U = { name: string; email: string; roles: string[]; bu?: string; team?: string; skills?: string[]; leads?: string[] };

const USERS: U[] = [
  { name: "Integration Service (n8n)", email: "n8n@ccms.local", roles: ["service"] },
  { name: "Aisha Rahman", email: "aisha.admin@income.demo", roles: ["admin"], bu: "CE" },
  { name: "Daniel Koh", email: "daniel.front@income.demo", roles: ["frontliner"], bu: "CE" },
  { name: "Priya Nair", email: "priya.cm@income.demo", roles: ["case_manager"], bu: "CE", team: "CE Complaints", skills: ["vulnerable_care"] },
  { name: "Marcus Lim", email: "marcus.cm@income.demo", roles: ["case_manager"], bu: "CE", team: "CE Complaints" },
  { name: "Grace Tan", email: "grace.cm@income.demo", roles: ["case_manager", "ce_team"], bu: "CE", team: "CE Significant", skills: ["senior", "fidrec_trained"] },
  { name: "Ivan Ong", email: "ivan.cm@income.demo", roles: ["case_manager"], bu: "CE", team: "CE Service" },
  { name: "Siti Hassan", email: "siti.cm@income.demo", roles: ["case_manager"], bu: "LIFE", team: "Life Appeals" },
  { name: "Ravi Kumar", email: "ravi.cm@income.demo", roles: ["case_manager"], bu: "HEALTH", team: "Health Appeals" },
  { name: "Wei Jie Chua", email: "weijie.cm@income.demo", roles: ["case_manager"], bu: "GI", team: "GI Appeals" },
  { name: "Melissa Goh", email: "melissa.lead@income.demo", roles: ["team_lead"], bu: "CE", leads: ["CE Complaints", "CE Service"] },
  { name: "Benjamin Yeo", email: "ben.lead@income.demo", roles: ["team_lead", "ce_team"], bu: "CE", leads: ["CE Significant"] },
  { name: "Hui Min Low", email: "huimin.lead@income.demo", roles: ["team_lead"], bu: "LIFE", leads: ["Life Appeals", "Health Appeals", "GI Appeals"] },
  { name: "Kenneth Ang", email: "kenneth.claims@income.demo", roles: ["bu_staff"], bu: "CLAIMS", team: "Claims Ops" },
  { name: "Nurul Aziz", email: "nurul.dist@income.demo", roles: ["bu_staff"], bu: "DIST", team: "Distribution Support" },
  { name: "Chloe Wong", email: "chloe.ce@income.demo", roles: ["ce_team"], bu: "CE" },
  { name: "Dr. Victor Teo", email: "victor.hce@income.demo", roles: ["head_of_ce", "ce_team"], bu: "CE" },
  { name: "Farah Ismail", email: "farah.qa@income.demo", roles: ["qa"], bu: "CE" },
];

const CUSTOMERS = [
  {
    customerNo: "C100001",
    name: "Tan Mei Ling",
    nricMasked: "S****123A",
    email: "meiling.tan@example.com",
    phone: "91234567",
    grade: "Gold",
    policies: [{ policyNo: "LF12345678", lineOfBusiness: "life", product: "Income Gro Living Benefits", agentCode: "AG1234", agentName: "Jason Lee", claimNo: "CL1234567" }],
  },
  {
    customerNo: "C100002",
    name: "Lim Ah Huat",
    nricMasked: "S****456B",
    email: "ahhuat.lim@example.com",
    phone: "98765432",
    grade: "Standard",
    vulnerable: true,
    vulnerableType: "elderly",
    policies: [{ policyNo: "HS20001111", lineOfBusiness: "health", product: "IncomeShield Plan A", claimNo: "CL7654321" }],
  },
  {
    customerNo: "C100003",
    name: "Rachel Chen",
    nricMasked: "S****789C",
    email: "rachel.chen@example.com",
    phone: "87654321",
    grade: "Platinum",
    vip: true,
    policies: [{ policyNo: "MT30002222", lineOfBusiness: "general", product: "Drivo Car Insurance", agentCode: "AG5678", agentName: "Mary Ho" }],
  },
  {
    customerNo: "C100004",
    name: "Muhammad Faizal",
    nricMasked: "S****321D",
    email: "faizal.m@example.com",
    phone: "81112222",
    grade: "Standard",
    policies: [{ policyNo: "LF40003333", lineOfBusiness: "life", product: "Income Star Secure Pro" }],
  },
  {
    customerNo: "C100005",
    name: "Siew Ling Ng",
    nricMasked: "S****654E",
    email: "siewling.ng@example.com",
    phone: "93334444",
    grade: "Gold",
    policies: [{ policyNo: "HS50004444", lineOfBusiness: "health", product: "IncomeShield Plan B", claimNo: "CL5550001" }],
  },
];

const ACK_EMAIL_BODY = `Dear {{name}},

Thank you for contacting Income Insurance. We have received your {{nature}} and logged it as case {{number}}.

Subject: {{subject}}

{{nextStep}}

Please quote {{number}} in any reply.

Yours sincerely,
Customer Experience, Income Insurance`;

const TEMPLATES = [
  {
    key: "ack_complaint_email",
    channel: "email",
    nature: "complaint",
    subject: "We have received your complaint ({{number}})",
    body: ACK_EMAIL_BODY.replace("{{nature}}", "complaint").replace(
      "{{nextStep}}",
      "A case manager is reviewing it and we aim to respond by {{targetDate}}. We will keep you updated.",
    ),
  },
  {
    key: "ack_appeal_email",
    channel: "email",
    nature: "appeal",
    subject: "We have received your appeal ({{number}})",
    body: ACK_EMAIL_BODY.replace("{{nature}}", "appeal").replace("{{nextStep}}", "The business unit will review your appeal and respond by {{targetDate}}."),
  },
  {
    key: "ack_enquiry_email",
    channel: "email",
    nature: "enquiry",
    subject: "We have received your enquiry ({{number}})",
    body: ACK_EMAIL_BODY.replace("{{nature}}", "enquiry").replace("{{nextStep}}", "We will reply by {{targetDate}}."),
  },
  {
    key: "ack_feedback_email",
    channel: "email",
    nature: "feedback",
    subject: "Thank you for your feedback ({{number}})",
    body: ACK_EMAIL_BODY.replace("{{nature}}", "feedback").replace("{{nextStep}}", "Your feedback has been shared with the team concerned."),
  },
  {
    key: "ack_default_sms",
    channel: "sms",
    nature: null,
    subject: null,
    body: "Income: we have received your case {{number}} and will respond by {{targetDate}}. Quote {{number}} when contacting us.",
  },
];

async function main() {
  for (const bu of BUS) await db.businessUnit.upsert({ where: { code: bu.code }, create: bu, update: { name: bu.name } });
  const bus = Object.fromEntries((await db.businessUnit.findMany()).map((b) => [b.code, b.id]));

  for (const t of TEAMS) {
    const existing = await db.team.findFirst({ where: { name: t.name } });
    if (!existing) await db.team.create({ data: { name: t.name, buId: bus[t.bu] } });
  }
  const teams = Object.fromEntries((await db.team.findMany()).map((t) => [t.name, t.id]));

  for (const u of USERS) {
    const data = {
      name: u.name,
      roles: u.roles,
      skills: u.skills ?? [],
      buId: u.bu ? bus[u.bu] : null,
      teamId: u.team ? teams[u.team] : null,
    };
    const user = await db.user.upsert({ where: { email: u.email }, create: { email: u.email, ...data }, update: data });
    for (const t of u.leads ?? []) await db.team.update({ where: { id: teams[t] }, data: { leadId: user.id } });
  }

  for (const c of CUSTOMERS) {
    const { policies, ...cust } = c;
    const customer = await db.customer.upsert({ where: { customerNo: c.customerNo }, create: cust, update: cust });
    for (const p of policies) {
      await db.policy.upsert({ where: { policyNo: p.policyNo }, create: { ...p, customerId: customer.id }, update: { ...p, customerId: customer.id } });
    }
  }

  for (const t of TEMPLATES) await db.template.upsert({ where: { key: t.key }, create: t, update: t });

  console.log(`Seeded ${BUS.length} BUs, ${TEAMS.length} teams, ${USERS.length} users, ${CUSTOMERS.length} customers, ${TEMPLATES.length} templates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
