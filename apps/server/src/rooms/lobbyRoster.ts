import { type LobbyPlayer, type Team, TEAM_SIZE } from '@game/core';

/** Who is in a lobby, on which team, and who hosts. Pure bookkeeping, no networking. */
export class LobbyRoster {
  /** In join order: the first player is the host. */
  private players: Omit<LobbyPlayer, 'isHost'>[] = [];

  get size(): number {
    return this.players.length;
  }

  private count(team: Team): number {
    return this.players.filter((p) => p.team === team).length;
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
    this.players.push({ playerId, nickname, team });
    return true;
  }

  remove(playerId: string): void {
    this.players = this.players.filter((p) => p.playerId !== playerId);
  }

  /** Moves a player to a team if it has room. */
  setTeam(playerId: string, team: Team): boolean {
    const player = this.players.find((p) => p.playerId === playerId);
    if (!player || (team !== 0 && team !== 1)) return false;
    if (player.team === team) return true;
    if (this.count(team) >= TEAM_SIZE) return false;
    player.team = team;
    return true;
  }

  list(): LobbyPlayer[] {
    return this.players.map((p, i) => ({ ...p, isHost: i === 0 }));
  }
}
