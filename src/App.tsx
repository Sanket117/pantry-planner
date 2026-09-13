import { useState } from 'react'
import { DbCheck } from './screens/DbCheck'
import { Placeholder } from './screens/Placeholder'

type Tab = 'today' | 'week' | 'pantry' | 'more'

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'pantry', label: 'Pantry' },
  { id: 'more', label: 'More' },
]

function App() {
  const [tab, setTab] = useState<Tab>('today')

  return (
    <div className="flex min-h-svh flex-col bg-stone-50">
      <main className="flex flex-1 flex-col overflow-y-auto pb-16">
        {tab === 'today' && <Placeholder title="Today" phase="Phase 4" />}
        {tab === 'week' && <Placeholder title="Week" phase="Phase 3" />}
        {tab === 'pantry' && <Placeholder title="Pantry" phase="Phase 2" />}
        {tab === 'more' && <DbCheck />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-stone-200 bg-white">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 py-3 text-sm font-medium ${
              tab === id ? 'text-green-800' : 'text-stone-400'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
