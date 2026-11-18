import { HERO_IDS, type LobbyPlayer, type Team, TEAM_SIZE } from '@game/core';

/** Who is in a lobby, on which team with which hero, and who hosts. Pure bookkeeping, no networking. */
export class LobbyRoster {
  /** In join order: the first player is the host. */
  private players: Omit<LobbyPlayer, 'isHost'>[] = [];

  get size(): number {
    return this.players.length;
  }

  private count(team: Team): number {
    return this.players.filter((p) => p.team === team).length;
  }

  private taken(team: Team, heroId: string, except: string): boolean {
    return this.players.some((p) => p.team === team && p.heroId === heroId && p.playerId !== except);
  }

  /** The first hero nobody else on the team has picked. */
  private freeHero(team: Team, except: string): string {
    return HERO_IDS.find((id) => !this.taken(team, id, except)) ?? HERO_IDS[0];
  }

  has(playerId: string): boolean {
    return this.players.some((p) => p.playerId === playerId);
  }

  isHost(playerId: string): boolean {
    return this.players[0]?.playerId === playerId;
  }

  /** Adds a player to the smaller team. Returns false when both teams are full. Rejoining keeps the seat. */
  add(playerId: string, nickname: string): boolean {
    const existing = this.players.find((p) => p.playerId === playerId);
    if (existing) {
      existing.nickname = nickname;
      return true;
    }
    if (this.players.length >= TEAM_SIZE * 2) return false;
    const team: Team = this.count(0) <= this.count(1) ? 0 : 1;
    this.players.push({ playerId, nickname, team, heroId: this.freeHero(team, playerId), ready: false });
    return true;
  }

  remove(playerId: string): void {
    this.players = this.players.filter((p) => p.playerId !== playerId);
  }

  /** Moves a player to a team if it has room. A hero already taken there is swapped for a free one. */
  setTeam(playerId: string, team: Team): boolean {
    const player = this.players.find((p) => p.playerId === playerId);
    if (!player || (team !== 0 && team !== 1)) return false;
    if (player.team === team) return true;
    if (this.count(team) >= TEAM_SIZE) return false;
    player.team = team;
    if (this.taken(team, player.heroId, playerId)) player.heroId = this.freeHero(team, playerId);
    return true;
  }

  /** Picks a hero. A team cannot have the same hero twice. */
  setHero(playerId: string, heroId: unknown): boolean {
    const player = this.players.find((p) => p.playerId === playerId);
    if (!player || typeof heroId !== 'string' || !HERO_IDS.includes(heroId)) return false;
    if (this.taken(player.team, heroId, playerId)) return false;
    player.heroId = heroId;
    return true;
  }

  /** Marks a player as ready to start, or not. */
  setReady(playerId: string, ready: unknown): boolean {
    const player = this.players.find((p) => p.playerId === playerId);
    if (!player || typeof ready !== 'boolean') return false;
    player.ready = ready;
    return true;
  }

  /** Everyone but the host has said they are ready. The host says so by starting. */
  allReady(): boolean {
    return this.players.every((p, i) => i === 0 || p.ready);
  }

  /** After a match everyone has to say they are ready again. */
  clearReady(): void {
    for (const p of this.players) p.ready = false;
  }

  list(): LobbyPlayer[] {
    return this.players.map((p, i) => ({ ...p, isHost: i === 0, ready: i === 0 || p.ready }));
  }
}
