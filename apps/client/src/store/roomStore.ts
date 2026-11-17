import type { Room } from '@colyseus/sdk';
import type { LobbyState, MatchWelcome, Snapshot, Team } from '@game/core';
import { create } from 'zustand';
import { playCue } from '@/lib/audio';
import { OnlineGame } from '@/lib/onlineGame';
import { CLOSE_REPLACED, colyseus } from '@/net/colyseus';
import { ensureGuest } from '@/net/guest';
import { useGameStore } from './gameStore';

type Phase = 'idle' | 'connecting' | 'lobby' | 'match' | 'error';

interface RoomStore {
  phase: Phase;
  code: string | null;
  lobby: LobbyState | null;
  playerId: string | null;
  /** Shown to the player when phase is 'error'. */
  error: string | null;
  /** A match from this lobby is running and this player is not in it. */
  matchInProgress: boolean;
  /** Creates a room; resolves to its code, or null when it failed (see `error`). */
  createRoom: (nickname: string) => Promise<string | null>;
  joinRoom: (code: string, nickname: string) => Promise<void>;
  setTeam: (team: Team) => void;
  setHero: (heroId: string) => void;
  startMatch: () => void;
  /** After a match: leave it and go back to the lobby it started from. */
  backToLobby: () => Promise<void>;
  leave: () => void;
}

// Live connections are not state to render from, so they stay out of the store.
let lobbyRoom: Room | null = null;
let matchRoom: Room | null = null;
let token = '';
let nickname = '';
let enteringMatch = false;
/** A match that refused this player; do not retry it on every lobby update. */
let refusedMatchId: string | null = null;

function messageFor(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  const reason = (err as { message?: unknown } | null)?.message;
  if (code === 522) return 'Không tìm thấy phòng. Kiểm tra lại link, hoặc phòng đã đóng.';
  if (reason === 'lobby_full') return 'Phòng đã đủ 6 người.';
  return 'Không kết nối được tới máy chủ. Thử lại sau giây lát.';
}

export const useRoomStore = create<RoomStore>((set, get) => {
  const fail = (error: string) => set({ phase: 'error', error });

  function attachLobby(room: Room, playerId: string): void {
    lobbyRoom = room;
    refusedMatchId = null;
    set({ phase: 'lobby', code: room.roomId, playerId, lobby: null, error: null, matchInProgress: false });
    room.onMessage('lobby', (state: LobbyState) => {
      if (lobbyRoom !== room) return;
      set({ lobby: state, matchInProgress: state.matchRoomId !== null && state.matchRoomId === refusedMatchId });
      if (state.matchRoomId === null) refusedMatchId = null;
      else if (state.matchRoomId !== refusedMatchId) void enterMatch(state.matchRoomId);
    });
    room.onLeave((code) => {
      if (lobbyRoom !== room) return; // we left on purpose
      lobbyRoom = null;
      fail(code === CLOSE_REPLACED ? 'Bạn đã mở phòng này ở một tab khác.' : 'Mất kết nối với phòng.');
    });
  }

  async function connect(open: (options: { token: string; nickname: string }) => Promise<Room>): Promise<boolean> {
    set({ phase: 'connecting', error: null });
    try {
      let guest = await ensureGuest();
      let room: Room;
      try {
        room = await open({ token: guest.token, nickname });
      } catch (err) {
        // A token the server no longer accepts (its secret changed): get a new identity once.
        if ((err as { code?: unknown } | null)?.code !== 401) throw err;
        guest = await ensureGuest(true);
        room = await open({ token: guest.token, nickname });
      }
      token = guest.token;
      attachLobby(room, guest.playerId);
      return true;
    } catch (err) {
      fail(messageFor(err));
      return false;
    }
  }

  async function enterMatch(matchRoomId: string): Promise<void> {
    if (enteringMatch || matchRoom) return;
    enteringMatch = true;
    try {
      const room = await colyseus.joinById(matchRoomId, { token });
      const game = await new Promise<OnlineGame>((resolve) => {
        let pending: OnlineGame | null = null;
        room.onMessage('welcome', (welcome: MatchWelcome) => {
          pending = new OnlineGame(room, welcome, playCue);
        });
        room.onMessage('s', (snapshot: Snapshot) => {
          pending?.receive(snapshot);
          if (pending?.ready) resolve(pending);
        });
      });
      matchRoom = room;
      room.onLeave((code) => {
        if (matchRoom !== room) return; // we left on purpose
        matchRoom = null;
        // The server closes the room a while after the match is decided: keep the result on screen.
        if (useGameStore.getState().hud?.winner != null) return;
        useGameStore.getState().setGame(null);
        fail(code === CLOSE_REPLACED ? 'Bạn đã mở trận này ở một tab khác.' : 'Mất kết nối với trận đấu.');
      });
      // In the match now: the lobby connection is no longer needed.
      const lobby = lobbyRoom;
      lobbyRoom = null;
      void lobby?.leave();
      playCue('matchStart');
      useGameStore.getState().setGame(game);
      set({ phase: 'match', matchInProgress: false });
    } catch (err) {
      if ((err as { code?: unknown } | null)?.code === 403) {
        // Not one of this match's players: wait in the lobby until it ends.
        refusedMatchId = matchRoomId;
        set({ matchInProgress: true });
      } else {
        fail(messageFor(err));
      }
    } finally {
      enteringMatch = false;
    }
  }

  function closeConnections(): void {
    const rooms = [lobbyRoom, matchRoom];
    lobbyRoom = null;
    matchRoom = null;
    for (const room of rooms) void room?.leave();
    useGameStore.getState().setGame(null);
  }

  return {
    phase: 'idle',
    code: null,
    lobby: null,
    playerId: null,
    error: null,
    matchInProgress: false,
    createRoom: async (name) => {
      closeConnections();
      nickname = name;
      const ok = await connect((options) => colyseus.create('lobby', options));
      return ok ? get().code : null;
    },
    joinRoom: async (code, name) => {
      closeConnections();
      nickname = name;
      set({ code });
      await connect((options) => colyseus.joinById(code, options));
    },
    setTeam: (team) => lobbyRoom?.send('team', team),
    setHero: (heroId) => lobbyRoom?.send('hero', heroId),
    startMatch: () => lobbyRoom?.send('start'),
    backToLobby: async () => {
      const code = get().code;
      closeConnections();
      if (code) await connect((options) => colyseus.joinById(code, options));
    },
    leave: () => {
      closeConnections();
      set({ phase: 'idle', code: null, lobby: null, error: null, matchInProgress: false });
    },
  };
});
