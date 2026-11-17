import type { HeroDef } from '../types.js';
import { seconds } from './balance.js';

const kael: HeroDef = {
  id: 'kael',
  name: 'Kael, Kỵ sĩ lưu vong',
  race: 'human',
  role: 'fighter',
  base: {
    hp: 640,
    hpPerLevel: 85,
    hpRegen: 2,
    mana: 220,
    manaPerLevel: 25,
    manaRegen: 3,
    attack: 58,
    attackPerLevel: 4,
    armor: 28,
    moveSpeed: 6.5,
    attackRange: 2.2,
    attackInterval: seconds(1),
    projectileSpeed: 0,
  },
  resource: 'mana',
  // Shield arm forward: less damage from the front, double from behind.
  passive: { effect: 'frontal_guard', params: { frontMult: 0.65, backMult: 2, arcCos: 0.5 } },
  abilities: {
    Q: {
      id: 'kael_charge',
      name: 'Xung phong',
      cooldownTicks: [seconds(8), seconds(7.5), seconds(7)],
      cost: [40, 45, 50],
      targeting: 'direction',
      range: 7,
      effect: 'kael_charge',
      params: { damage: [70, 110, 150], width: [1.4, 1.4, 1.4], slow: [0.3, 0.35, 0.4], slowTicks: [30, 30, 30] },
    },
    W: {
      id: 'kael_guard',
      name: 'Thế thủ',
      cooldownTicks: [seconds(14), seconds(13), seconds(12)],
      cost: [50, 55, 60],
      targeting: 'self',
      range: 0,
      effect: 'kael_guard',
      params: { shield: [120, 190, 260], durationTicks: [60, 60, 60] },
    },
    E: {
      id: 'kael_bash',
      name: 'Đập khiên',
      cooldownTicks: [seconds(10), seconds(9), seconds(8)],
      cost: [45, 45, 45],
      targeting: 'unit',
      range: 3,
      effect: 'kael_bash',
      params: { damage: [50, 80, 110], stunTicks: [20, 25, 30] },
    },
    R: {
      id: 'kael_verdict',
      name: 'Phán quyết',
      cooldownTicks: [seconds(60), seconds(50), seconds(40)],
      cost: [100, 100, 100],
      targeting: 'point',
      range: 8,
      effect: 'kael_verdict',
      params: { damage: [200, 300, 400], radius: [3.5, 3.5, 3.5], stunTicks: [20, 20, 20] },
    },
  },
};

export const HEROES: Record<string, HeroDef> = { kael };
