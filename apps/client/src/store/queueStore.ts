import type { Room } from '@colyseus/sdk';
import type { MatchResult, Profile, QueueStatus } from '@game/core';
import { create } from 'zustand';
import { playCue } from '@/lib/audio';
import { fetchProfile, fetchServerConfig, type ServerConfig, signInWithGoogle } from '@/net/account';
import { CLOSE_REPLACED, colyseus } from '@/net/colyseus';
import { ensureGuest, replaceGuest } from '@/net/guest';
import { openMatch } from '@/net/match';
import { useGameStore } from './gameStore';

type Phase = 'idle' | 'connecting' | 'queue' | 'match' | 'error';

interface QueueStore {
  phase: Phase;
  status: QueueStatus | null;
  profile: Profile | null;
  config: ServerConfig | null;
  /** The last thing the server said about a refused request. */
  notice: string | null;
  /** How the player's MMR moved in the match that just ended. */
  result: MatchResult | null;
  error: string | null;
  /** Connect to the queue. `partyCode` joins a friend's party straight away. */
  connect: (nickname: string, partyCode?: string) => Promise<void>;
  find: (heroId: string) => void;
  cancel: () => void;
  accept: () => void;
  decline: () => void;
  pickHero: (heroId: string) => void;
  ready: () => void;
  createParty: () => void;
  leaveParty: () => void;
  /** Sign in with the credential from Google's button, then reconnect as that account. */
  google: (credential: string) => Promise<void>;
  leave: () => void;
}

// Live connections are not state to render from, so they stay out of the store.
let queueRoom: Room | null = null;
let matchRoom: Room | null = null;
let token = '';
let nickname = '';
let entering = false;

function messageFor(err: unknown): string {
  const reason = (err as { message?: unknown } | null)?.message;
  if (reason === 'ranked_unavailable') return 'Máy chủ này chưa bật đấu xếp hạng (chưa có cơ sở dữ liệu).';
  return 'Không kết nối được tới máy chủ. Thử lại sau giây lát.';
}

export const useQueueStore = create<QueueStore>((set, get) => {
  const fail = (error: string) => set({ phase: 'error', error });
  const send = (type: string, payload?: unknown) => queueRoom?.send(type, payload);

  function close(): void {
    const rooms = [queueRoom, matchRoom];
    queueRoom = null;
    matchRoom = null;
    for (const room of rooms) void room?.leave();
    useGameStore.getState().setGame(null);
  }

  async function enterMatch(matchRoomId: string): Promise<void> {
    if (entering || matchRoom) return;
    entering = true;
    try {
      const { room, game } = await openMatch(matchRoomId, token);
      matchRoom = room;
      room.onMessage('result', (result: MatchResult) => set({ result }));
      room.onLeave((code) => {
        if (matchRoom !== room) return; // we left on purpose
        matchRoom = null;
        // The server closes the room a while after the match is decided: keep the result on screen.
        if (useGameStore.getState().hud?.winner != null) return;
        useGameStore.getState().setGame(null);
        fail(code === CLOSE_REPLACED ? 'Bạn đã mở trận này ở một tab khác.' : 'Mất kết nối với trận đấu.');
      });
      // In the match now: the queue connection is no longer needed.
      const queue = queueRoom;
      queueRoom = null;
      void queue?.leave();
      playCue('matchStart');
      useGameStore.getState().setGame(game);
      set({ phase: 'match', status: null });
    } catch (err) {
      fail(messageFor(err));
    } finally {
      entering = false;
    }
  }

  function attach(room: Room, partyCode?: string): void {
    queueRoom = room;
    let previous: QueueStatus['state'] = 'idle';
    room.onMessage('queue', (status: QueueStatus) => {
      if (queueRoom !== room) return;
      if (status.state === 'accept' && previous !== 'accept') playCue('matchStart');
      previous = status.state;
      set({ status, notice: status.notice ?? get().notice });
      if (status.state === 'starting' && status.matchRoomId) void enterMatch(status.matchRoomId);
    });
    room.onLeave((code) => {
      if (queueRoom !== room) return; // we left on purpose
      queueRoom = null;
      fail(code === CLOSE_REPLACED ? 'Bạn đã mở hàng chờ ở một tab khác.' : 'Mất kết nối với hàng chờ.');
    });
    if (partyCode) room.send('party:join', partyCode);
  }

  return {
    phase: 'idle',
    status: null,
    profile: null,
    config: null,
    notice: null,
    result: null,
    error: null,
    connect: async (name, partyCode) => {
      close();
      nickname = name;
      set({ phase: 'connecting', error: null, notice: null, status: null });
      try {
        const config = await fetchServerConfig();
        set({ config });
        if (!config.ranked) return fail(messageFor({ message: 'ranked_unavailable' }));
        let guest = await ensureGuest();
        const open = (t: string) => colyseus.joinOrCreate('queue', { token: t, nickname });
        let room: Room;
        try {
          room = await open(guest.token);
        } catch (err) {
          // A token the server no longer accepts (its secret changed): get a new identity once.
          if ((err as { code?: unknown } | null)?.code !== 401) throw err;
          guest = await ensureGuest(true);
          room = await open(guest.token);
        }
        token = guest.token;
        attach(room, partyCode);
        set({ phase: 'queue', profile: await fetchProfile(token) });
      } catch (err) {
        fail(messageFor(err));
      }
    },
    find: (heroId) => {
      set({ notice: null, result: null });
      send('find', heroId);
    },
    cancel: () => send('cancel'),
    accept: () => send('accept'),
    decline: () => send('decline'),
    pickHero: (heroId) => send('hero', heroId),
    ready: () => send('ready'),
    createParty: () => send('party:create'),
    leaveParty: () => send('party:leave'),
    google: async (credential) => {
      try {
        const signedIn = await signInWithGoogle(token, credential);
        replaceGuest({ playerId: signedIn.profile.playerId, token: signedIn.token });
        await get().connect(signedIn.profile.nickname || nickname);
      } catch {
        set({ notice: 'Đăng nhập Google không thành công. Hãy thử lại.' });
      }
    },
    leave: () => {
      close();
      set({ phase: 'idle', status: null, error: null, notice: null });
    },
  };
});
