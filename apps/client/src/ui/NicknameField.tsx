import { NICKNAME_MAX_LENGTH } from '@game/core';
import { useSettingsStore } from '@/store/settingsStore';

/** The name other players see. Remembered in the browser. */
export function NicknameField() {
  const nickname = useSettingsStore((s) => s.nickname);
  const setNickname = useSettingsStore((s) => s.setNickname);
  return (
    <label className="flex flex-col items-start gap-1 text-sm text-muted-foreground">
      Biệt danh
      <input
        type="text"
        value={nickname}
        maxLength={NICKNAME_MAX_LENGTH}
        autoComplete="nickname"
        placeholder="Nhập biệt danh"
        onChange={(e) => setNickname(e.target.value)}
        className="w-64 rounded-md border border-border bg-background px-3 py-2 text-base text-foreground"
      />
    </label>
  );
}
