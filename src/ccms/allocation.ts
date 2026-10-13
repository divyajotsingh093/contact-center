/** Workload balancing inside the team Reels allocated the case to. */

export interface Candidate {
  id: string;
  name: string;
  skills: string[];
  openCases: number;
}

/**
 * Prefers members with the required skill; among those, the lightest open
 * workload, then name for a stable tie-break. Falls back to the whole team
 * when nobody has the skill, so a case is never left unassigned.
 */
export function pickCaseManager(candidates: Candidate[], requiredSkill?: string | null): Candidate | null {
  if (!candidates.length) return null;
  const skilled = requiredSkill ? candidates.filter((c) => c.skills.includes(requiredSkill)) : [];
  const pool = skilled.length ? skilled : candidates;
  return [...pool].sort((a, b) => a.openCases - b.openCases || a.name.localeCompare(b.name))[0];
}
