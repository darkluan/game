import { tr } from '@/i18n';
import { NICKNAME_MAX_LENGTH } from '@game/core';
import { useSettingsStore } from '@/store/settingsStore';

/** The name other players see. Remembered in the browser. */
export function NicknameField() {
  const nickname = useSettingsStore((s) => s.nickname);
  const setNickname = useSettingsStore((s) => s.setNickname);
  return (
    <label className="flex w-full flex-col items-start gap-2 text-xs squat:gap-1 font-semibold tracking-widest text-muted-foreground uppercase">
      {tr('Biệt danh')}
      <input
        type="text"
        value={nickname}
        maxLength={NICKNAME_MAX_LENGTH}
        autoComplete="nickname"
        placeholder={tr('Nhập biệt danh')}
        onChange={(e) => setNickname(e.target.value)}
        className="w-full rounded-md border border-border bg-background/70 px-3 py-2 text-base font-medium squat:px-3 squat:py-1.5 squat:text-base tracking-normal text-foreground normal-case outline-none select-text placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
