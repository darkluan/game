import type { SpellHud } from '@/lib/session';

/**
 * The colour of each helper button while it is ready, so the three are told apart at a glance:
 * healing is green, the flash is gold, the way home is blue. Whole class names, for Tailwind to find.
 */
export const SPELL_TONE: Record<SpellHud['id'], { border: string; icon: string }> = {
  heal: { border: 'border-hp', icon: 'text-hp' },
  flash: { border: 'border-gold', icon: 'text-gold' },
  recall: { border: 'border-ally', icon: 'text-ally' },
};
