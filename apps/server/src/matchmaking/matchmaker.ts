import { TEAM_SIZE } from '@game/core';

/** One entry in the queue: a solo player or a party that must stay on the same team. */
export interface Ticket {
  id: string;
  members: { playerId: string; mmr: number }[];
  /** Milliseconds; when the ticket started waiting. */
  joinedAt: number;
}

export interface MatchSettings {
  rangeStart: number;
  rangeStep: number;
  rangeStepMs: number;
  /** Waiting longer than this fills the empty seats with bots. */
  botFillMs: number;
}

/** A party plays better than its members' ratings suggest, so it is treated as stronger. By party size. */
const PARTY_BONUS = [0, 0, 30, 60];

export interface Proposal {
  /** Tickets on each team. */
  teams: [Ticket[], Ticket[]];
  /** Bots added to each team to reach full size. */
  bots: [number, number];
  /** Difference between the two teams' average MMR. */
  gap: number;
}

const sizeOf = (tickets: Ticket[]): number => tickets.reduce((n, t) => n + t.members.length, 0);

/** The rating a ticket is matched by: its members' average, plus the party bonus. */
export function ticketMmr(t: Ticket): number {
  const average = t.members.reduce((sum, m) => sum + m.mmr, 0) / t.members.length;
  return average + (PARTY_BONUS[t.members.length] ?? 0);
}

/** How far from its own MMR a ticket accepts opponents: wider the longer it has waited. */
export function rangeOf(t: Ticket, now: number, s: MatchSettings): number {
  return s.rangeStart + s.rangeStep * Math.floor(Math.max(0, now - t.joinedAt) / s.rangeStepMs);
}

/**
 * The fairest way to put these tickets on two teams of at most TEAM_SIZE, keeping every party
 * together. Empty seats become bots. Returns null when the parties cannot fit.
 */
export function splitTeams(tickets: Ticket[]): Proposal | null {
  const everyone = tickets.flatMap((t) => t.members);
  if (everyone.length === 0 || everyone.length > TEAM_SIZE * 2) return null;
  // A bot is assumed to play like the average human of this match.
  const botMmr = everyone.reduce((sum, m) => sum + m.mmr, 0) / everyone.length;
  let best: (Proposal & { uneven: number }) | null = null;
  for (let mask = 0; mask < 1 << tickets.length; mask++) {
    const teams: [Ticket[], Ticket[]] = [[], []];
    tickets.forEach((t, i) => teams[(mask >> i) & 1].push(t));
    const sizes = [sizeOf(teams[0]), sizeOf(teams[1])];
    if (sizes[0] > TEAM_SIZE || sizes[1] > TEAM_SIZE) continue;
    const average = (team: Ticket[], size: number) =>
      (team.reduce((sum, t) => sum + ticketMmr(t) * t.members.length, 0) + botMmr * (TEAM_SIZE - size)) / TEAM_SIZE;
    const gap = Math.abs(average(teams[0], sizes[0]) - average(teams[1], sizes[1]));
    const uneven = Math.abs(sizes[0] - sizes[1]);
    // Humans are spread evenly first (a bot is no substitute for a teammate); then the closest averages win.
    if (!best || uneven < best.uneven || (uneven === best.uneven && gap < best.gap - 1e-9)) {
      best = { teams, bots: [TEAM_SIZE - sizes[0], TEAM_SIZE - sizes[1]], gap, uneven };
    }
  }
  return best && { teams: best.teams, bots: best.bots, gap: best.gap };
}

/** The first group of candidates, in waiting order, that fills both teams exactly and can be split. */
function fullGroup(anchor: Ticket, candidates: Ticket[]): Ticket[] | null {
  const need = TEAM_SIZE * 2;
  const search = (from: number, group: Ticket[], size: number): Ticket[] | null => {
    if (size === need) return splitTeams(group) ? group : null;
    for (let i = from; i < candidates.length; i++) {
      const next = candidates[i];
      if (size + next.members.length > need) continue;
      const found = search(i + 1, [...group, next], size + next.members.length);
      if (found) return found;
    }
    return null;
  };
  return search(0, [anchor], anchor.members.length);
}

/** As many candidates as fit, in waiting order, for a match that bots will complete. */
function partialGroup(anchor: Ticket, candidates: Ticket[]): Ticket[] {
  let group = [anchor];
  for (const next of candidates) {
    if (sizeOf(group) + next.members.length <= TEAM_SIZE * 2 && splitTeams([...group, next])) group = [...group, next];
  }
  return group;
}

/**
 * Looks for a match in the queue. The longest-waiting ticket goes first: it is matched with tickets
 * inside its (growing) MMR range. Six players make a full match; a ticket that has waited past the
 * bot-fill time gets a match with whoever is in range plus bots.
 */
export function findMatch(queue: Ticket[], now: number, s: MatchSettings): Proposal | null {
  const waiting = [...queue].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
  for (const anchor of waiting) {
    const range = rangeOf(anchor, now, s);
    const mmr = ticketMmr(anchor);
    const candidates = waiting.filter((t) => t !== anchor && Math.abs(ticketMmr(t) - mmr) <= range);
    const full = fullGroup(anchor, candidates);
    if (full) return splitTeams(full);
    if (now - anchor.joinedAt >= s.botFillMs) return splitTeams(partialGroup(anchor, candidates));
  }
  return null;
}
