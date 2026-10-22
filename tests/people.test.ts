import { describe, expect, it } from 'vitest';
import { groupPeople, type UserRow } from '@/lib/admin/people';

const row = (id: string, nickname: string, studentId: string | null, day: number): UserRow => ({ id, nickname, studentId, userCode: id, createdAt: new Date(Date.UTC(2026, 9, day)) });

describe('groupPeople', () => {
  it('merges rows with the same name and student ID into one person', () => {
    const people = groupPeople([row('a', '이시환', '2311', 1), row('b', '이시환', '2311', 2), row('c', '김하늘', '2405', 3)], new Map());
    expect(people.map((person) => [person.nickname, person.deviceCount])).toEqual([['이시환', 2], ['김하늘', 1]]);
    expect(people[0].ids).toEqual(['a', 'b']);
  });
  it('represents the person with the row that has push devices and sums the devices', () => {
    const [person] = groupPeople([row('a', '이시환', '2311', 1), row('b', '이시환', '2311', 2), row('c', '이시환', '2311', 3)], new Map([['b', 1], ['c', 2]]));
    expect(person.id).toBe('c');
    expect(person.pushDevices).toBe(3);
    expect(person.hasPush).toBe(true);
    expect(person.createdAt).toEqual(new Date(Date.UTC(2026, 9, 1)));
  });
  it('keeps the oldest row as primary when nobody has push', () => {
    const [person] = groupPeople([row('b', '이시환', '2311', 2), row('a', '이시환', '2311', 1)], new Map());
    expect(person.id).toBe('a');
    expect(person.hasPush).toBe(false);
  });
  it('does not merge people who differ in student ID or have none', () => {
    const people = groupPeople([row('a', '박민준', '2218', 1), row('b', '박민준', '2219', 2), row('c', '테스트', null, 3), row('d', '테스트', null, 4)], new Map());
    expect(people).toHaveLength(4);
  });
  it('hides the synthetic demo user', () => {
    expect(groupPeople([row('a', '[데모] 이용 기록', null, 1), row('b', '이시환', '2311', 2)], new Map()).map((person) => person.nickname)).toEqual(['이시환']);
  });
});
