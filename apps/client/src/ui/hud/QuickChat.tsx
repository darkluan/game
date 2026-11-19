import { tr } from '@/i18n';
import { HEROES, MATCH_CHAT_IDS } from '@game/core';
import { MATCH_CHAT_TEXT } from '@/lib/chatText';
import type { GameSession } from '@/lib/session';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useState } from 'react';
import { useTouchLayout } from '@/hooks/useTouchLayout';
import { ChatInput } from '../ChatInput';

/** What the team has said so far, newest at the bottom and in view. Empty until someone speaks. */
function ChatHistory({ game }: { game: GameSession }) {
  // The log lives in the session, outside React: the HUD state changes every tick, which redraws this.
  useGameStore((s) => s.hud);
  if (game.chatLog.length === 0) return null;
  return (
    <ul
      aria-label={tr('Lịch sử chat')}
      ref={(list) => list?.scrollTo(0, list.scrollHeight)}
      className="flex max-h-24 shrink-0 flex-col gap-0.5 overflow-y-auto rounded-md bg-background/60 px-2 py-1 leading-snug select-text"
    >
      {game.chatLog.map((line) => (
        <li key={line.id} className="break-words">
          {line.text}
        </li>
      ))}
    </ul>
  );
}

/**
 * Team chat: a button that opens what was said so far, a box to type in, the ready-made phrases and who to stop hearing
 * from. Shown only in a match with other people in it.
 * `className` places the button; `panelClassName` places the panel it opens, relative to the button.
 */
export function QuickChat({
  game,
  className,
  panelClassName,
}: {
  game: GameSession;
  className: string;
  panelClassName: string;
}) {
  const open = useGameStore((s) => s.chatOpen);
  const setOpen = useGameStore((s) => s.setChatOpen);
  const typing = useGameStore((s) => s.chatTyping);
  const chatOff = useSettingsStore((s) => s.chatOff);
  const toggleChat = useSettingsStore((s) => s.toggleChat);
  // Muting lives in the session, outside React: this redraws the list after a change.
  const [, redraw] = useState(0);
  const touch = useTouchLayout();
  if (!game.chatEnabled) return null;
  const mates = game.roster().filter((r) => r.team === game.hero.team && r.id !== game.hero.id && r.playerName);
  const option = 'rounded-md border border-border px-2 py-1.5 text-left';

  return (
    <div className={`pointer-events-auto absolute ${className}`}>
      <button
        type="button"
        onPointerDown={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={tr('Chat nhanh')}
        className="touch-none rounded-md hud-panel px-2.5 py-1.5 text-xs"
      >
        {tr('Chat')}
      </button>
      {open && (
        // On a phone the panel is taller than the room under its button: it scrolls rather than run off the screen.
        <div
          className={`absolute z-20 flex max-h-[calc(100dvh-7.75rem)] w-64 flex-col gap-2 overflow-y-auto rounded-lg hud-sheet p-2 text-xs ${panelClassName}`}
        >
          <ChatHistory game={game} />
          <ChatInput
            // Opened with Enter: ready to type. Opened with C or a click: the number keys pick a phrase.
            key={String(typing)}
            autoFocus={!touch && typing}
            onCancel={() => setOpen(false)}
            onSend={(text) => {
              game.sendChat({ k: 'text', text });
              setOpen(false);
            }}
          />
          <div className="grid grid-cols-2 gap-1.5">
            {MATCH_CHAT_IDS.map((id, i) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  game.sendChat({ k: 'quick', id });
                  setOpen(false);
                }}
                className={option}
              >
                <span className="mr-1 text-muted-foreground">{i + 1}</span>
                {MATCH_CHAT_TEXT[id]}
              </button>
            ))}
          </div>
          {mates.map((mate) => (
            <button
              key={mate.id}
              type="button"
              aria-pressed={game.isMuted(mate.id)}
              onClick={() => {
                game.toggleMuted(mate.id);
                redraw((n) => n + 1);
              }}
              className={option}
            >
              {game.isMuted(mate.id)
                ? tr('Đang chặn {name}. Bấm để bỏ chặn', { name: mate.playerName ?? HEROES[mate.defId]?.name ?? '' })
                : tr('Chặn chat của {name}', { name: mate.playerName ?? HEROES[mate.defId]?.name ?? '' })}
            </button>
          ))}
          <button type="button" onClick={toggleChat} aria-pressed={!chatOff} className={option}>
            {chatOff ? tr('Chat của đội: tắt') : tr('Chat của đội: bật')}
          </button>
        </div>
      )}
    </div>
  );
}
