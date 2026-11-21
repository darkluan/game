import { tr } from '@/i18n';
import { useEffect } from 'react';
import type { Vec2 } from '@game/core';
import type { GameSession, HudState } from '@/lib/session';
import { useSettingsStore } from '@/store/settingsStore';
import { useTutorialStore } from '@/store/tutorialStore';

/** The hero has "moved" once it is this far from where it started. */
const MOVED_DISTANCE = 4;

interface Step {
  title: string;
  /** What to do, with a mouse and keyboard and on a touch screen. */
  desktop: string;
  touch: string;
  /** True once the player has done it. Steps without this wait for the player to tap "Đã hiểu". */
  done?: (hud: HudState, hero: Vec2, origin: Vec2) => boolean;
}

const STEPS: Step[] = [
  {
    title: tr('Di chuyển'),
    desktop: tr('Bấm chuột xuống mặt đất để tướng đi tới đó.'),
    touch: tr('Kéo cần điều khiển ở góc trái để tướng di chuyển.'),
    done: (_hud, hero, origin) => Math.hypot(hero.x - origin.x, hero.z - origin.z) > MOVED_DISTANCE,
  },
  {
    title: tr('Học chiêu'),
    desktop: tr('Bạn có 1 điểm kỹ năng. Bấm dấu + phía trên một chiêu, hoặc Alt + Q, để học.'),
    touch: tr('Bạn có 1 điểm kỹ năng. Bấm dấu + cạnh một nút chiêu để học; giữ dấu + để xem chiêu đó làm gì trước.'),
    done: (hud) => hud.abilities.some((a) => a.level > 0),
  },
  {
    title: tr('Dùng chiêu'),
    desktop: tr(
      'Đưa chuột về hướng muốn đánh rồi bấm phím của chiêu (Q W E R). Chiêu nhắm vào một kẻ địch cần có địch trong tầm.',
    ),
    touch: tr(
      'Bấm nút chiêu: chiêu tự nhắm kẻ địch gần nhất. Giữ nút để đọc chiêu làm gì; kéo ngón tay để tự nhắm, thả ra để ra chiêu, kéo vào ô Hủy để thôi.',
    ),
    done: (hud) => hud.abilities.some((a) => a.cooldownLeft > 0),
  },
  {
    title: tr('Đánh lính lên cấp'),
    desktop: tr(
      'Đi cùng lính ra giữa đường và bấm vào kẻ địch để đánh. Hạ lính ở đòn cuối sẽ được vàng. Lên cấp 2 để tiếp tục.',
    ),
    touch: tr(
      'Đi cùng lính ra giữa đường và bấm nút kiếm để đánh kẻ địch gần nhất. Hạ lính ở đòn cuối sẽ được vàng. Lên cấp 2 để tiếp tục.',
    ),
    done: (hud) => hud.level >= 2,
  },
  {
    title: tr('Phép hỗ trợ'),
    desktop: tr(
      'D hồi máu cho bạn, F lướt nhanh một đoạn về phía con trỏ để đuổi hoặc chạy. T đưa bạn về căn cứ sau 5 giây đứng yên; bị đánh là hỏng.',
    ),
    touch: tr(
      'Nút trái tim hồi máu cho bạn, nút người chạy lướt nhanh một đoạn để đuổi hoặc chạy. Nút vòng xoáy đưa bạn về căn cứ sau 5 giây đứng yên; bị đánh là hỏng.',
    ),
  },
  {
    title: tr('Mua đồ'),
    desktop: tr(
      'Khi có vàng, về ốc đảo ở cuối đường phe mình rồi bấm B để mở cửa hàng: thẻ Gợi ý xếp sẵn đồ hợp với tướng của bạn. Đứng ở ốc đảo cũng hồi máu rất nhanh.',
    ),
    touch: tr(
      'Khi có vàng, về ốc đảo ở cuối đường phe mình rồi bấm Cửa hàng: thẻ Gợi ý xếp sẵn đồ hợp với tướng của bạn. Đứng ở ốc đảo cũng hồi máu rất nhanh.',
    ),
  },
  {
    title: tr('Bản đồ nhỏ'),
    desktop: tr('Bấm vào bản đồ nhỏ để tướng đi tới đó. Giữ chuột trên bản đồ để nhìn nơi đó, thả ra là về lại tướng.'),
    touch: tr(
      'Chạm vào bản đồ nhỏ để tướng đi tới đó. Giữ ngón tay trên bản đồ để nhìn nơi đó, thả ra là về lại tướng.',
    ),
  },
  {
    title: tr('Mục tiêu'),
    desktop: tr(
      'Phá hai trụ rồi phá đền của địch để thắng. Di vật ở rừng dưới và Cổ thú ở rừng trên giúp đội bạn mạnh hơn.',
    ),
    touch: tr(
      'Phá hai trụ rồi phá đền của địch để thắng. Di vật ở rừng dưới và Cổ thú ở rừng trên giúp đội bạn mạnh hơn.',
    ),
  },
];

/**
 * Tips for a first match against bots, one at a time. Most move on by themselves when the player
 * does what they say. Shown until finished or skipped once, then never again.
 */
export function Tutorial({ game, hud, touch }: { game: GameSession; hud: HudState; touch: boolean }) {
  const finished = useSettingsStore((s) => s.tutorialDone);
  const finish = useSettingsStore((s) => s.finishTutorial);
  const step = useTutorialStore((s) => s.step);
  const origin = useTutorialStore((s) => s.origin);
  const next = useTutorialStore((s) => s.next);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  // Checked whenever the HUD state changes, which is once per game tick.
  useEffect(() => {
    if (!finished && origin && current?.done?.(hud, game.hero.pos, origin)) next();
  }, [finished, origin, current, hud, game, next]);

  useEffect(() => {
    if (!finished && step >= STEPS.length) finish();
  }, [finished, step, finish]);

  if (finished || !current || hud.winner !== null) return null;
  return (
    <div
      role="status"
      className={`hud-panel pointer-events-auto absolute rounded-md border-l-2 border-l-primary p-3 ${
        touch ? 'top-24 left-1 w-60 text-xs' : 'top-24 left-3 w-80 text-sm'
      }`}
    >
      <p className="flex items-baseline justify-between gap-2 font-semibold text-primary">
        {current.title}
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          {step + 1} / {STEPS.length}
        </span>
      </p>
      <p className="mt-1 leading-snug">{touch ? current.touch : current.desktop}</p>
      <div className="mt-2 flex justify-between gap-2 text-xs">
        <button type="button" onClick={finish} className="cursor-pointer text-muted-foreground underline">
          {tr('Bỏ qua hướng dẫn')}
        </button>
        <button
          type="button"
          onClick={last ? finish : next}
          className="cursor-pointer rounded-sm border border-primary px-2 py-0.5 font-semibold text-primary"
        >
          {last ? tr('Xong') : current.done ? tr('Bước tiếp') : tr('Đã hiểu')}
        </button>
      </div>
    </div>
  );
}
