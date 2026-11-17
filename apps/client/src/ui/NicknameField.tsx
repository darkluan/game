import { NICKNAME_MAX_LENGTH } from '@game/core';
import { useSettingsStore } from '@/store/settingsStore';

/** The name other players see. Remembered in the browser. */
export function NicknameField() {
  const nickname = useSettingsStore((s) => s.nickname);
  const setNickname = useSettingsStore((s) => s.setNickname);
  return (
    <label className="flex w-full flex-col items-start gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
      Biệt danh
      <input
        type="text"
        value={nickname}
        maxLength={NICKNAME_MAX_LENGTH}
        autoComplete="nickname"
        placeholder="Nhập biệt danh"
        onChange={(e) => setNickname(e.target.value)}
        className="w-full rounded-md border border-border bg-background/70 px-4 py-3 text-lg font-medium tracking-normal text-foreground normal-case outline-none select-text placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
