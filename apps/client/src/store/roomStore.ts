import { tr } from '@/i18n';
import type { Room } from '@colyseus/sdk';
import type { LobbyChatMessage, LobbyChatSend, LobbyState, Team } from '@game/core';
import { create } from 'zustand';
import { playCue } from '@/lib/audio';
import { CLOSE_REPLACED, colyseus } from '@/net/colyseus';
import { ensureGuest } from '@/net/guest';
import { openMatch } from '@/net/match';
import { useGameStore } from './gameStore';
import { useSettingsStore } from './settingsStore';

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
  setReady: (ready: boolean) => void;
  /** The latest phrases said in the pick room, oldest first. */
  chat: (LobbyChatMessage & { key: number })[];
  /** Says a ready-made phrase, by id, or typed words. */
  sendChat: (message: LobbyChatSend) => void;
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
let nextChatKey = 1;
/** How many pick-room phrases stay on screen. */
const CHAT_LINES = 4;
/** How long a pick-room phrase stays on screen. */
const CHAT_LINE_MS = 7000;

function messageFor(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  const reason = (err as { message?: unknown } | null)?.message;
  if (code === 522) return tr('Không tìm thấy phòng. Kiểm tra lại link, hoặc phòng đã đóng.');
  if (reason === 'lobby_full') return tr('Phòng đã đủ 6 người.');
  return tr('Không kết nối được tới máy chủ. Thử lại sau giây lát.');
}

export const useRoomStore = create<RoomStore>((set, get) => {
  const fail = (error: string) => set({ phase: 'error', error });

  function attachLobby(room: Room, playerId: string): void {
    lobbyRoom = room;
    refusedMatchId = null;
    set({ phase: 'lobby', code: room.roomId, playerId, lobby: null, error: null, matchInProgress: false, chat: [] });
    room.onMessage('lobby', (state: LobbyState) => {
      if (lobbyRoom !== room) return;
      set({ lobby: state, matchInProgress: state.matchRoomId !== null && state.matchRoomId === refusedMatchId });
      if (state.matchRoomId === null) refusedMatchId = null;
      else if (state.matchRoomId !== refusedMatchId) void enterMatch(state.matchRoomId);
    });
    room.onMessage('chat', (message: LobbyChatMessage) => {
      if (lobbyRoom !== room) return;
      const line = { key: nextChatKey++, ...message };
      set({ chat: [...get().chat, line].slice(-CHAT_LINES) });
      window.setTimeout(() => set({ chat: get().chat.filter((c) => c.key !== line.key) }), CHAT_LINE_MS);
    });
    room.onLeave((code) => {
      if (lobbyRoom !== room) return; // we left on purpose
      lobbyRoom = null;
      fail(code === CLOSE_REPLACED ? tr('Bạn đã mở phòng này ở một tab khác.') : tr('Mất kết nối với phòng.'));
    });
  }

  async function connect(
    open: (options: { token: string; nickname: string; heroId: string }) => Promise<Room>,
  ): Promise<boolean> {
    set({ phase: 'connecting', error: null });
    try {
      // The hero picked on the home screen comes along into the room.
      const heroId = useSettingsStore.getState().heroId;
      let guest = await ensureGuest();
      let room: Room;
      try {
        room = await open({ token: guest.token, nickname, heroId });
      } catch (err) {
        // A token the server no longer accepts (its secret changed): get a new identity once.
        if ((err as { code?: unknown } | null)?.code !== 401) throw err;
        guest = await ensureGuest(true);
        room = await open({ token: guest.token, nickname, heroId });
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
      const { room, game } = await openMatch(matchRoomId, token);
      matchRoom = room;
      room.onLeave((code) => {
        if (matchRoom !== room) return; // we left on purpose
        matchRoom = null;
        // The server closes the room a while after the match is decided: keep the result on screen.
        if (useGameStore.getState().hud?.winner != null) return;
        useGameStore.getState().setGame(null);
        fail(code === CLOSE_REPLACED ? tr('Bạn đã mở trận này ở một tab khác.') : tr('Mất kết nối với trận đấu.'));
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
    chat: [],
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
    setReady: (ready) => lobbyRoom?.send('ready', ready),
    sendChat: (message) => lobbyRoom?.send('chat', 'id' in message ? message.id : message),
    backToLobby: async () => {
      const code = get().code;
      closeConnections();
      if (code) await connect((options) => colyseus.joinById(code, options));
    },
    leave: () => {
      closeConnections();
      set({ phase: 'idle', code: null, lobby: null, error: null, matchInProgress: false, chat: [] });
    },
  };
});
