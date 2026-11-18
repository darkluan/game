import type { Room } from '@colyseus/sdk';
import type { MatchWelcome, Snapshot } from '@game/core';
import { playCue } from '@/lib/audio';
import { OnlineGame } from '@/lib/onlineGame';
import { colyseus } from './colyseus';

/** Joins a match room and resolves once the first snapshot has arrived and the game can be shown. */
export async function openMatch(
  matchRoomId: string,
  token: string,
): Promise<{ room: Room; game: OnlineGame; welcome: MatchWelcome }> {
  const room = await colyseus.joinById(matchRoomId, { token });
  return new Promise((resolve) => {
    let pending: { game: OnlineGame; welcome: MatchWelcome } | null = null;
    room.onMessage('welcome', (welcome: MatchWelcome) => {
      pending = { game: new OnlineGame(room, welcome, playCue), welcome };
    });
    room.onMessage('s', (snapshot: Snapshot) => {
      pending?.game.receive(snapshot);
      if (pending?.game.ready) resolve({ room, ...pending });
    });
  });
}
