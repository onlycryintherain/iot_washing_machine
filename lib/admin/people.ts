export const DEMO_NICKNAME_PREFIX = '[데모]';

export type UserRow = { id: string; nickname: string; studentId: string | null; userCode: string; createdAt: Date };
export type Person = UserRow & { ids: string[]; hasPush: boolean; pushDevices: number; deviceCount: number };

// A person can own several user rows (one per browser, reinstall or logout). Rows sharing a name and student ID are one person,
// the same rule equivalentUserIds uses for washer ownership and push delivery; rows without a student ID stay separate.
export function groupPeople(rows: UserRow[], pushByUser: Map<string, number>): Person[] {
  const groups = new Map<string, UserRow[]>();
  for (const row of rows) {
    if (row.nickname.startsWith(DEMO_NICKNAME_PREFIX)) continue;
    const key = row.studentId ? `${row.nickname}\u0000${row.studentId}` : row.id;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map((members) => {
    // The row with the most push devices represents the person; ties go to the oldest.
    const primary = [...members].sort((a, b) => (pushByUser.get(b.id) ?? 0) - (pushByUser.get(a.id) ?? 0) || a.createdAt.getTime() - b.createdAt.getTime())[0];
    const pushDevices = members.reduce((sum, member) => sum + (pushByUser.get(member.id) ?? 0), 0);
    return {
      ...primary,
      ids: members.map((member) => member.id),
      createdAt: new Date(Math.min(...members.map((member) => member.createdAt.getTime()))),
      hasPush: pushDevices > 0,
      pushDevices,
      deviceCount: members.length,
    };
  }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
