
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink } from '@apollo/client'
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core'
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import Betting from './pages/Betting'
import Rankings from './pages/Rankings'
import Profile from './pages/Profile'
import AppManagement from './pages/AppManagement'
import { Leaderboard } from './pages/Leaderboard'
import { LineraProvider } from './context/LineraContext'

const queryClient = new QueryClient()

const getGraphQLUrl = () => {
  const chainId = import.meta.env.VITE_CHAIN_ID as string
  const appId = import.meta.env.VITE_APP_ID as string
  const host = import.meta.env.VITE_HOST as string
  const port = import.meta.env.VITE_PORT as string
  
  if (!chainId || !appId || !host || !port) {
    return '/invalid-chain'
  }
  
  return `http://${host}:${port}/chains/${chainId}/applications/${appId}`
}

const httpLink = createHttpLink({
  uri: getGraphQLUrl(),
})

const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-first',
    },
  },
})

const dynamicConfig = {
  environmentId: '2a6a2498-e013-4b1b-983a-cb2a53cd7d9d',
  appName: 'Linera Edge',
  initialAuthenticationMode: 'connect-only' as const,
  walletConnectors: [EthereumWalletConnectors],
  settings: {
    autoConnect: false,
    persistUserSession: false,
  },
  events: {
    onAuthSuccess: () => {
    },
    onAuthError: () => {
    },
    onLogout: () => {
      localStorage.removeItem('linera_wallet_connected');
      localStorage.removeItem('linera_wallet_address');
      if (window.sessionStorage) {
        sessionStorage.clear();
      }
    }
  }
}

function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <QueryClientProvider client={queryClient}>
        <DynamicContextProvider settings={dynamicConfig}>
          <LineraProvider>
            <Router>
              <div className="min-h-screen bg-gray-50">
                <Header />
                <main className="container mx-auto px-4">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/betting" element={<Betting />} />
                    <Route path="/rankings" element={<Rankings />} />
                    <Route path="/leaderboard" element={<Leaderboard address={null} />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/app-management" element={<AppManagement />} />
                  </Routes>
                </main>
              </div>
            </Router>
          </LineraProvider>
        </DynamicContextProvider>
      </QueryClientProvider>
    </ApolloProvider>
  )
}

export default App