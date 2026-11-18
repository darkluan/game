import { tr } from '@/i18n';
import { CHAT_TEXT_MAX } from '@game/core';
import { useState } from 'react';

/** One line to type a chat message into. Enter or the button sends it; Escape, or Enter with nothing typed, gives up. */
export function ChatInput({
  onSend,
  onCancel,
  autoFocus = false,
}: {
  onSend: (text: string) => void;
  onCancel?: () => void;
  /** Put the cursor in the box at once. Not on a phone: that would raise the keyboard uninvited. */
  autoFocus?: boolean;
}) {
  const [text, setText] = useState('');
  return (
    <form
      className="flex gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const line = text.trim();
        // Enter on an empty box means "never mind".
        if (line) onSend(line);
        else onCancel?.();
        setText('');
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel?.();
        }}
        maxLength={CHAT_TEXT_MAX}
        autoFocus={autoFocus}
        enterKeyHint="send"
        autoComplete="off"
        aria-label={tr('Tin nhắn')}
        placeholder={tr('Nhập tin nhắn…')}
        className="min-w-0 flex-1 rounded-md border border-border bg-background/80 px-2 py-1.5 text-foreground outline-none select-text focus:border-primary"
      />
      <button type="submit" className="cursor-pointer rounded-md border border-border px-2.5 py-1.5 font-semibold">
        {tr('Gửi')}
      </button>
    </form>
  );
}
