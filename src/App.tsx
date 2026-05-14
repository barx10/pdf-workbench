import { useStore } from './store/useStore'
import { LeftSidebar } from './components/LeftSidebar'
import { CenterWorkspace } from './components/CenterWorkspace'
import { RightSidebar } from './components/RightSidebar'

export default function App() {
  const { theme } = useStore()

  return (
    <div className={`app-layout grain-overlay ${theme === 'light' ? 'light-mode' : ''}`}>
      <LeftSidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <CenterWorkspace />
      </main>
      <RightSidebar />
    </div>
  )
}
