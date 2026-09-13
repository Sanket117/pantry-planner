import { useState, type ReactNode } from 'react'
import { DbCheck } from './DbCheck'
import { RecipesScreen } from './recipes/RecipesScreen'
import { ResetScreen } from './reset/ResetScreen'
import { SettingsScreen } from './settings/SettingsScreen'

type SubScreen = 'menu' | 'recipes' | 'reset' | 'settings' | 'debug'

const ITEMS: { id: SubScreen; label: string; hint: string }[] = [
  { id: 'recipes', label: 'Recipes', hint: 'Import, view, activate/deactivate' },
  { id: 'reset', label: 'Weekly reset', hint: 'Reconcile the ledger against the fridge' },
  { id: 'settings', label: 'Settings', hint: 'Prep ceilings, coverage, staple threshold' },
  { id: 'debug', label: 'Database status', hint: 'Row counts, persistence probe' },
]

export function MoreScreen() {
  const [screen, setScreen] = useState<SubScreen>('menu')

  if (screen === 'recipes') return <BackWrapper onBack={() => setScreen('menu')}><RecipesScreen /></BackWrapper>
  if (screen === 'reset') return <BackWrapper onBack={() => setScreen('menu')}><ResetScreen /></BackWrapper>
  if (screen === 'settings') return <BackWrapper onBack={() => setScreen('menu')}><SettingsScreen /></BackWrapper>
  if (screen === 'debug') return <BackWrapper onBack={() => setScreen('menu')}><DbCheck /></BackWrapper>

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-stone-800">More</h1>
      <div className="flex flex-col divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setScreen(item.id)}
            className="flex flex-col items-start px-3 py-3 text-left"
          >
            <span className="text-sm text-stone-800">{item.label}</span>
            <span className="text-xs text-stone-400">{item.hint}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function BackWrapper({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <button type="button" onClick={onBack} className="px-4 pt-4 text-left text-sm text-stone-400">
        ← Back
      </button>
      {children}
    </div>
  )
}
