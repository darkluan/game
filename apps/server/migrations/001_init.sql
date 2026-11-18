-- Players, match history and queue penalties.

CREATE TABLE players (
  id           uuid PRIMARY KEY,
  -- Google account id ("sub"), set once the player signs in with Google.
  google_id    text UNIQUE,
  nickname     text NOT NULL DEFAULT '',
  -- OpenSkill rating.
  mu           double precision NOT NULL,
  sigma        double precision NOT NULL,
  games_played integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE matches (
  id          uuid PRIMARY KEY,
  mode        text NOT NULL CHECK (mode IN ('private', 'ranked')),
  started_at  timestamptz NOT NULL,
  duration_s  integer NOT NULL,
  winner_team smallint NOT NULL CHECK (winner_team IN (0, 1)),
  had_bots    boolean NOT NULL
);

CREATE TABLE match_players (
  match_id   uuid NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  player_id  uuid NOT NULL REFERENCES players (id),
  team       smallint NOT NULL CHECK (team IN (0, 1)),
  hero_id    text NOT NULL,
  kills      integer NOT NULL,
  deaths     integer NOT NULL,
  assists    integer NOT NULL,
  mu_before  double precision NOT NULL,
  mu_after   double precision NOT NULL,
  left_early boolean NOT NULL,
  PRIMARY KEY (match_id, player_id)
);
CREATE INDEX match_players_by_player ON match_players (player_id, match_id);

CREATE TABLE penalties (
  id         bigserial PRIMARY KEY,
  player_id  uuid NOT NULL REFERENCES players (id),
  reason     text NOT NULL,
  until      timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX penalties_by_player ON penalties (player_id, created_at);
