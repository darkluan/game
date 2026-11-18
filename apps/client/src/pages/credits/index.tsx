import { Link } from 'react-router';
import { LobbyShell } from '@/components/LobbyShell';
import { GameIcon } from '@/ui/icons/GameIcon';
import { GAME_ICONS } from '@/ui/icons/gameIcons';

/** Artists of the icons in use, each with the icons taken from them. */
const byArtist = Object.entries(GAME_ICONS).reduce<Record<string, string[]>>((groups, [id, icon]) => {
  (groups[icon.artist] ??= []).push(id);
  return groups;
}, {});

const link = 'underline hover:text-foreground';

/** Who made the art in the game. The icons' licence (CC BY) requires this credit. */
export default function CreditsPage() {
  return (
    <LobbyShell>
      <div>
        <p className="animate-rise text-xs font-bold tracking-[0.35em] text-primary uppercase">Tứ Tộc</p>
        <h1 className="animate-rise text-title text-5xl leading-tight font-black tracking-[0.08em] uppercase">
          Ghi công
        </h1>
      </div>

      <section className="glass-panel flex w-full flex-col gap-3 rounded-xl p-4 text-left text-sm">
        <h2 className="font-semibold">Icon chiêu và trang bị</h2>
        <p className="text-muted-foreground">
          Lấy từ{' '}
          <a href="https://game-icons.net" target="_blank" rel="noreferrer" className={link}>
            game-icons.net
          </a>
          , giấy phép{' '}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer" className={link}>
            CC BY 3.0
          </a>
          . Icon được tô lại màu, hình vẽ giữ nguyên.
        </p>
        {Object.entries(byArtist).map(([artist, ids]) => (
          <div key={artist}>
            <p className="font-semibold">
              {artist} <span className="font-normal text-muted-foreground">· {ids.length} icon</span>
            </p>
            <div className="mt-1 flex flex-wrap gap-1 text-primary">
              {ids.map((id) => (
                <span key={id} title={GAME_ICONS[id].name}>
                  <GameIcon id={id} className="size-7 rounded-sm bg-background/70 p-0.5" />
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="glass-panel flex w-full flex-col gap-2 rounded-xl p-4 text-left text-sm">
        <h2 className="font-semibold">Model 3D</h2>
        <p className="text-muted-foreground">
          Nhân vật, lính, trụ, đền, cây và đá: bộ KayKit của{' '}
          <a href="https://www.kaylousberg.com" target="_blank" rel="noreferrer" className={link}>
            Kay Lousberg
          </a>
          . Khủng long và người máy:{' '}
          <a href="https://quaternius.com" target="_blank" rel="noreferrer" className={link}>
            Quaternius
          </a>
          . Cả hai phát hành theo CC0.
        </p>
      </section>

      <Link to="/" className={`text-sm text-muted-foreground ${link}`}>
        Về trang chủ
      </Link>
    </LobbyShell>
  );
}
