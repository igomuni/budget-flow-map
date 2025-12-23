import { BudgetFlowMap } from './BudgetFlowMap'
import { InfoPanel } from './InfoPanel/InfoPanel'
import { Tooltip } from './Tooltip'

function App() {
  return (
    <div className="h-screen w-screen flex">
      <InfoPanel />
      <main className="flex-1 relative">
        <BudgetFlowMap />
        <Tooltip />
      </main>
    </div>
  )
}

export default App
