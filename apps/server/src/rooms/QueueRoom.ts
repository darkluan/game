import { randomInt, randomUUID } from 'node:crypto';
import { type Client, matchMaker, Room, ServerError } from 'colyseus';
import { cleanNickname, HERO_IDS, PARTY_MAX_SIZE, type QueueStatus, ROOM_CODE_LENGTH, type Team } from '@game/core';
import { verifyGuest } from '../auth/guest.js';
import { config } from '../config.js';
import { getStore, rankedAvailable } from '../db/index.js';
import { createLogger } from '../logger.js';
import { findMatch, type MatchSettings, type Proposal, rangeOf, type Ticket } from '../matchmaking/matchmaker.js';
import { mmrOf } from '../matchmaking/rating.js';
import { INTERNAL_KEY, type MatchOptions } from './MatchRoom.js';

const logger = createLogger('QueueRoom');
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** Close code for a connection replaced by the same player joining again. */
const CLOSE_REPLACED = 4001;

interface Auth {
  playerId: string;
}

/** A connected player. */
interface Seat {
  playerId: string;
  nickname: string;
  client: Client;
  mmr: number;
  /** Hero the player would like; used as their first pick in the draft. */
  heroId: string;
  partyCode: string | null;
  /** Milliseconds; end of the player's queue ban, 0 when none. */
  penaltyUntil: number;
  /** Shown once with the next status, then cleared. */
  notice?: string;
  /** The match made for this player, until they leave to join it. */
  matchRoomId?: string;
}

interface Party {
  code: string;
  leader: string;
  members: string[];
}

/** A match that was found and is being confirmed (accept), then prepared (draft). */
interface Pending {
  phase: 'accept' | 'draft';
  /** Milliseconds. */
  deadline: number;
  tickets: Ticket[];
  teamOf: Map<string, Team>;
  bots: number;
  accepted: Set<string>;
  picks: Map<string, string>;
  ready: Set<string>;
}

const seconds = (ms: number): number => Math.max(0, Math.ceil(ms / 1000));

/**
 * The matchmaking queue. Every player looking for a ranked match is connected to this one room.
 * It forms parties, scans the queue for fair matches, runs the accept check and the hero draft,
 * then creates the match room and tells the players to join it.
 */
export class QueueRoom extends Room {
  maxClients = 500;
  maxMessagesPerSecond = 20;

  private readonly seats = new Map<string, Seat>();
  private readonly parties = new Map<string, Party>();
  private readonly queue = new Map<string, Ticket>();
  /** Which ticket or pending match each busy player is part of. */
  private readonly ticketOf = new Map<string, Ticket>();
  private readonly pendingOf = new Map<string, Pending>();
  private readonly pendings = new Set<Pending>();
  private timer?: NodeJS.Timeout;
  private readonly settings: MatchSettings = {
    rangeStart: config.matchmaking.rangeStart,
    rangeStep: config.matchmaking.rangeStep,
    rangeStepMs: config.matchmaking.rangeStepSeconds * 1000,
    botFillMs: config.matchmaking.botFillSeconds * 1000,
  };

  onCreate(): void {
    const on = (type: string, handler: (seat: Seat, payload: unknown) => void | Promise<void>) =>
      this.onMessage(type, (client: Client, payload: unknown) => {
        const seat = this.seats.get((client.auth as Auth).playerId);
        if (!seat || seat.client !== client) return;
        Promise.resolve(handler(seat, payload))
          .catch((err: unknown) => logger.error('queue message failed', err, { type }))
          .finally(() => this.sendStatus(seat.playerId));
      });
    on('party:create', (seat) => this.createParty(seat));
    on('party:join', (seat, code) => this.joinParty(seat, code));
    on('party:leave', (seat) => this.leaveParty(seat));
    on('find', (seat, heroId) => this.find(seat, heroId));
    on('cancel', (seat) => this.cancel(seat.playerId, 'Đã hủy tìm trận.'));
    on('accept', (seat) => this.respond(seat, true));
    on('decline', (seat) => this.respond(seat, false));
    on('hero', (seat, heroId) => this.pick(seat, heroId));
    on('ready', (seat) => void this.pendingOf.get(seat.playerId)?.ready.add(seat.playerId));
    this.timer = setInterval(() => this.scan(), config.matchmaking.scanMs);
  }

  onDispose(): void {
    clearInterval(this.timer);
  }

  async onAuth(_client: Client, options: { token?: unknown } | undefined): Promise<Auth> {
    const playerId = verifyGuest(options?.token);
    if (!playerId) throw new ServerError(401, 'invalid_token');
    if (!rankedAvailable()) throw new ServerError(503, 'ranked_unavailable');
    return { playerId };
  }

  async onJoin(client: Client, options: { nickname?: unknown } | undefined, auth: Auth): Promise<void> {
    const store = getStore();
    const nickname = cleanNickname(options?.nickname) || 'Khách';
    const player = await store.ensurePlayer(auth.playerId);
    await store.setNickname(auth.playerId, nickname);
    const penalty = await store.penaltyUntil(auth.playerId, new Date());
    // The same player in a second tab takes over; whatever the first tab was doing is dropped.
    const previous = this.seats.get(auth.playerId);
    if (previous) {
      this.gone(auth.playerId);
      previous.client.leave(CLOSE_REPLACED);
    }
    this.seats.set(auth.playerId, {
      playerId: auth.playerId,
      nickname,
      client,
      mmr: mmrOf(player),
      heroId: HERO_IDS[0],
      partyCode: null,
      penaltyUntil: penalty?.getTime() ?? 0,
    });
    this.sendStatus(auth.playerId);
  }

  onDrop(client: Client): void {
    this.left(client);
  }

  onLeave(client: Client): void {
    this.left(client);
  }

  private left(client: Client): void {
    const { playerId } = client.auth as Auth;
    if (this.seats.get(playerId)?.client !== client) return;
    this.gone(playerId);
    this.seats.delete(playerId);
  }

  /** Undo whatever a departing player was part of. */
  private gone(playerId: string): void {
    const seat = this.seats.get(playerId);
    if (!seat) return;
    this.cancel(playerId, 'Một người trong nhóm đã rời hàng chờ.');
    const pending = this.pendingOf.get(playerId);
    // Leaving during the accept check counts as declining. During the draft the match still starts,
    // and the missing player is treated as a leaver by the match itself.
    if (pending?.phase === 'accept') this.failAccept(pending, [playerId]);
    this.leaveParty(seat);
  }

  // ---- parties ----

  private busy(playerId: string): boolean {
    return this.ticketOf.has(playerId) || this.pendingOf.has(playerId);
  }

  private createParty(seat: Seat): void {
    if (seat.partyCode || this.busy(seat.playerId)) return;
    let code: string;
    do {
      code = Array.from({ length: ROOM_CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    } while (this.parties.has(code));
    this.parties.set(code, { code, leader: seat.playerId, members: [seat.playerId] });
    seat.partyCode = code;
  }

  private joinParty(seat: Seat, code: unknown): void {
    if (seat.partyCode || this.busy(seat.playerId)) return;
    const party = typeof code === 'string' ? this.parties.get(code.toUpperCase()) : undefined;
    if (!party) seat.notice = 'Không tìm thấy nhóm. Kiểm tra lại link mời.';
    else if (party.members.length >= PARTY_MAX_SIZE) seat.notice = 'Nhóm đã đủ 3 người.';
    else if (this.busy(party.leader)) seat.notice = 'Nhóm đang tìm trận. Hãy thử lại sau.';
    else {
      party.members.push(seat.playerId);
      seat.partyCode = party.code;
      for (const id of party.members) this.sendStatus(id);
    }
  }

  private leaveParty(seat: Seat): void {
    const party = seat.partyCode ? this.parties.get(seat.partyCode) : undefined;
    seat.partyCode = null;
    if (!party) return;
    this.cancel(seat.playerId, 'Một người đã rời nhóm.');
    party.members = party.members.filter((id) => id !== seat.playerId);
    if (party.members.length === 0) this.parties.delete(party.code);
    else if (party.leader === seat.playerId) party.leader = party.members[0];
    for (const id of party.members) this.sendStatus(id);
  }

  // ---- searching ----

  private async find(seat: Seat, heroId: unknown): Promise<void> {
    if (this.busy(seat.playerId)) return;
    seat.matchRoomId = undefined;
    if (typeof heroId === 'string' && HERO_IDS.includes(heroId)) seat.heroId = heroId;
    const party = seat.partyCode ? this.parties.get(seat.partyCode) : undefined;
    if (party && party.leader !== seat.playerId) {
      seat.notice = 'Chỉ trưởng nhóm mới bấm Tìm trận được.';
      return;
    }
    const members = (party?.members ?? [seat.playerId]).flatMap((id) => this.seats.get(id) ?? []);
    const store = getStore();
    const now = new Date();
    for (const member of members) {
      // Ratings and bans may have changed since the player connected.
      const [player, penalty] = await Promise.all([
        store.ensurePlayer(member.playerId),
        store.penaltyUntil(member.playerId, now),
      ]);
      member.mmr = mmrOf(player);
      member.penaltyUntil = penalty?.getTime() ?? 0;
    }
    const banned = members.find((m) => m.penaltyUntil > now.getTime());
    if (banned) {
      const minutes = Math.ceil((banned.penaltyUntil - now.getTime()) / 60_000);
      const who = banned === seat ? 'Bạn' : banned.nickname;
      for (const m of members) m.notice = `${who} đang bị khóa tìm trận ${minutes} phút vì đã thoát trận.`;
    } else if (!members.some((m) => this.busy(m.playerId))) {
      const ticket: Ticket = {
        id: randomUUID(),
        joinedAt: Date.now(),
        members: members.map((m) => ({ playerId: m.playerId, mmr: m.mmr })),
      };
      this.queue.set(ticket.id, ticket);
      for (const m of members) this.ticketOf.set(m.playerId, ticket);
    }
    for (const m of members) if (m !== seat) this.sendStatus(m.playerId);
  }

  /** Take a player's whole ticket out of the queue. */
  private cancel(playerId: string, noticeForOthers: string): void {
    const ticket = this.ticketOf.get(playerId);
    if (!ticket) return;
    this.queue.delete(ticket.id);
    for (const m of ticket.members) {
      this.ticketOf.delete(m.playerId);
      const seat = this.seats.get(m.playerId);
      if (seat && m.playerId !== playerId) seat.notice = noticeForOthers;
      this.sendStatus(m.playerId);
    }
  }

  // ---- accept check ----

  private propose(proposal: Proposal): void {
    const tickets = proposal.teams.flat();
    const pending: Pending = {
      phase: 'accept',
      deadline: Date.now() + config.matchmaking.acceptSeconds * 1000,
      tickets,
      teamOf: new Map(),
      bots: proposal.bots[0] + proposal.bots[1],
      accepted: new Set(),
      picks: new Map(),
      ready: new Set(),
    };
    proposal.teams.forEach((team, index) => {
      for (const ticket of team) for (const m of ticket.members) pending.teamOf.set(m.playerId, index as Team);
    });
    for (const ticket of tickets) {
      this.queue.delete(ticket.id);
      for (const m of ticket.members) {
        this.ticketOf.delete(m.playerId);
        this.pendingOf.set(m.playerId, pending);
      }
    }
    this.pendings.add(pending);
    logger.log('match found', { players: pending.teamOf.size, bots: pending.bots, gap: Math.round(proposal.gap) });
  }

  private respond(seat: Seat, accept: boolean): void {
    const pending = this.pendingOf.get(seat.playerId);
    if (pending?.phase !== 'accept') return;
    if (!accept) return this.failAccept(pending, [seat.playerId]);
    pending.accepted.add(seat.playerId);
    if (pending.accepted.size === pending.teamOf.size) this.startDraft(pending);
    else for (const id of pending.teamOf.keys()) this.sendStatus(id);
  }

  /** The match falls through: the tickets of those who declined are dropped, the rest go back to the front. */
  private failAccept(pending: Pending, decliners: string[]): void {
    this.pendings.delete(pending);
    for (const ticket of pending.tickets) {
      const declined = ticket.members.some((m) => decliners.includes(m.playerId));
      if (!declined) this.queue.set(ticket.id, ticket);
      for (const m of ticket.members) {
        this.pendingOf.delete(m.playerId);
        const seat = this.seats.get(m.playerId);
        if (!declined) {
          this.ticketOf.set(m.playerId, ticket);
          if (seat) seat.notice = 'Có người không chấp nhận. Bạn được đưa lại đầu hàng chờ.';
        } else if (seat) {
          seat.notice = decliners.includes(m.playerId)
            ? 'Bạn đã không chấp nhận trận và bị đưa ra khỏi hàng chờ.'
            : 'Một người trong nhóm không chấp nhận trận.';
        }
        this.sendStatus(m.playerId);
      }
    }
  }

  // ---- hero draft ----

  private takenBy(pending: Pending, team: Team, except: string): Set<string> {
    const taken = new Set<string>();
    for (const [id, heroId] of pending.picks) if (id !== except && pending.teamOf.get(id) === team) taken.add(heroId);
    return taken;
  }

  private startDraft(pending: Pending): void {
    pending.phase = 'draft';
    pending.deadline = Date.now() + config.matchmaking.draftSeconds * 1000;
    // Everyone starts on the hero they asked for, or the first one a teammate has not taken.
    for (const [playerId, team] of pending.teamOf) {
      const taken = this.takenBy(pending, team, playerId);
      const wanted = this.seats.get(playerId)?.heroId ?? HERO_IDS[0];
      pending.picks.set(playerId, taken.has(wanted) ? HERO_IDS.find((id) => !taken.has(id))! : wanted);
    }
    for (const id of pending.teamOf.keys()) this.sendStatus(id);
  }

  private pick(seat: Seat, heroId: unknown): void {
    const pending = this.pendingOf.get(seat.playerId);
    if (pending?.phase !== 'draft' || typeof heroId !== 'string' || !HERO_IDS.includes(heroId)) return;
    const team = pending.teamOf.get(seat.playerId)!;
    if (this.takenBy(pending, team, seat.playerId).has(heroId)) return;
    pending.picks.set(seat.playerId, heroId);
    seat.heroId = heroId;
    for (const [id, t] of pending.teamOf) if (t === team) this.sendStatus(id);
  }

  private async startMatch(pending: Pending): Promise<void> {
    this.pendings.delete(pending);
    const options: MatchOptions = {
      internalKey: INTERNAL_KEY,
      mode: 'ranked',
      code: '',
      players: [...pending.teamOf].map(([playerId, team]) => ({
        playerId,
        team,
        nickname: this.seats.get(playerId)?.nickname ?? 'Khách',
        heroId: pending.picks.get(playerId) ?? HERO_IDS[0],
      })),
    };
    let matchRoomId: string | undefined;
    try {
      matchRoomId = (await matchMaker.createRoom('match', options)).roomId;
      logger.log('ranked match started', { matchRoomId, players: options.players.length, bots: pending.bots });
    } catch (err) {
      logger.error('could not start ranked match', err);
    }
    for (const playerId of pending.teamOf.keys()) {
      this.pendingOf.delete(playerId);
      const seat = this.seats.get(playerId);
      if (seat && matchRoomId) seat.matchRoomId = matchRoomId;
      else if (seat) seat.notice = 'Không tạo được trận. Hãy tìm trận lại.';
      this.sendStatus(playerId);
    }
  }

  // ---- the loop ----

  private scan(): void {
    const now = Date.now();
    for (let match = findMatch([...this.queue.values()], now, this.settings); match;) {
      this.propose(match);
      match = findMatch([...this.queue.values()], now, this.settings);
    }
    for (const pending of [...this.pendings]) {
      if (pending.phase === 'accept') {
        if (now >= pending.deadline) {
          this.failAccept(
            pending,
            [...pending.teamOf.keys()].filter((id) => !pending.accepted.has(id)),
          );
        }
      } else if (now >= pending.deadline || pending.ready.size === pending.teamOf.size) {
        void this.startMatch(pending);
      }
    }
    // Waiting times and countdowns move on, so everyone gets a fresh status.
    for (const playerId of this.seats.keys()) this.sendStatus(playerId);
  }

  private sendStatus(playerId: string): void {
    const seat = this.seats.get(playerId);
    if (!seat) return;
    const now = Date.now();
    const party = seat.partyCode ? this.parties.get(seat.partyCode) : undefined;
    const ticket = this.ticketOf.get(playerId);
    const pending = this.pendingOf.get(playerId);
    const status: QueueStatus = {
      state: seat.matchRoomId ? 'starting' : pending ? pending.phase : ticket ? 'searching' : 'idle',
      mmr: seat.mmr,
      party: party
        ? {
            code: party.code,
            isLeader: party.leader === playerId,
            members: party.members.map((id) => ({
              nickname: this.seats.get(id)?.nickname ?? '?',
              isYou: id === playerId,
            })),
          }
        : null,
      matchRoomId: seat.matchRoomId,
      penaltySeconds: seconds(seat.penaltyUntil - now),
      notice: seat.notice,
    };
    if (ticket) {
      status.searching = {
        waitedSeconds: Math.floor((now - ticket.joinedAt) / 1000),
        range: rangeOf(ticket, now, this.settings),
        botFillSeconds: config.matchmaking.botFillSeconds,
      };
    }
    if (pending?.phase === 'accept') {
      status.accept = {
        secondsLeft: seconds(pending.deadline - now),
        accepted: pending.accepted.size,
        total: pending.teamOf.size,
        youAccepted: pending.accepted.has(playerId),
      };
    }
    if (pending?.phase === 'draft') {
      const team = pending.teamOf.get(playerId)!;
      status.draft = {
        secondsLeft: seconds(pending.deadline - now),
        team,
        // Only teammates' picks are shown: the enemy's stay hidden until the match.
        picks: [...pending.teamOf]
          .filter(([, t]) => t === team)
          .map(([id, t]) => ({
            nickname: this.seats.get(id)?.nickname ?? '?',
            heroId: pending.picks.get(id) ?? HERO_IDS[0],
            team: t,
            isYou: id === playerId,
          })),
        bots: pending.bots,
        youReady: pending.ready.has(playerId),
      };
    }
    seat.notice = undefined;
    seat.client.send('queue', status);
  }
}
