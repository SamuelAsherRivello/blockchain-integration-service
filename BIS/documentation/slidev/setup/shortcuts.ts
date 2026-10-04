import type { NavOperations, ShortcutOptions } from '@slidev/types'
import { defineShortcutsSetup } from '@slidev/types'

export default defineShortcutsSetup((nav: NavOperations, base: ShortcutOptions[]) => [
  ...base.filter(shortcut => shortcut.name !== 'toggle_dark'),
  {
    name: 'prev_a',
    key: 'a',
    fn: nav.prev,
    autoRepeat: true,
  },
  {
    name: 'next_d',
    key: 'd',
    fn: nav.next,
    autoRepeat: true,
  },
])
