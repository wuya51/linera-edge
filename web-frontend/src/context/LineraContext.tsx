import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { useDynamicContext, DynamicConnectButton } from '@dynamic-labs/sdk-react-core'
import { useQuery } from '@apollo/client'
import { GET_USER_BALANCE } from '../services/graphql'

interface LineraContextType {
  isConnected: boolean
  account: string | null
  balance: number
  connectWallet: () => void
  disconnectWallet: () => void
  isConnecting: boolean
  error: string | null
  DynamicConnectButton: typeof DynamicConnectButton
  isOwner: boolean
  refetchBalance: () => void
}

const LineraContext = createContext<LineraContextType | undefined>(undefined)

interface LineraProviderProps {
  children: ReactNode
}

export const LineraProvider: React.FC<LineraProviderProps> = ({ children }) => {
  const { primaryWallet, user, handleLogOut } = useDynamicContext()
  const [isConnected, setIsConnected] = useState(false)
  const [account, setAccount] = useState<string | null>(null)
  const [balance, setBalance] = useState(0)

  const formatAccountAddress = (addr: string) => {
    return addr.startsWith('0x') ? addr : `0x${addr}`
  }

  const {
    data: balanceData,
    refetch: refetchBalance
  } = useQuery(GET_USER_BALANCE, {
    variables: {
      owner: account ? formatAccountAddress(account) : null
    },
    skip: !isConnected || !account,
    fetchPolicy: 'network-only'
  })
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    if (primaryWallet && primaryWallet.address) {
      const formattedAddress = primaryWallet.address.startsWith('0x') 
        ? primaryWallet.address 
        : `0x${primaryWallet.address}`
      
      setIsConnected(true)
      setAccount(formattedAddress)
      setError(null)
      setIsConnecting(false)
      
      const ownerAddress = import.meta.env.VITE_OWNER_ID || '0x1234567890123456789012345678901234567890'
      setIsOwner(formattedAddress.toLowerCase() === ownerAddress.toLowerCase())
      
      localStorage.setItem('linera_wallet_connected', 'true')
      localStorage.setItem('linera_wallet_address', formattedAddress)
    } else {
      setIsConnected(false)
      setAccount(null)
      setBalance(0)
      setIsOwner(false)
      
      localStorage.removeItem('linera_wallet_connected')
      localStorage.removeItem('linera_wallet_address')
    }
  }, [primaryWallet])

  useEffect(() => {
    if (balanceData && balanceData.getBalance !== undefined) {
      setBalance(balanceData.getBalance)
    }
  }, [balanceData])

  const connectWallet = () => {
    setIsConnecting(true)
    setError(null)
  }

  const disconnectWallet = async () => {
    try {
      localStorage.removeItem('linera_wallet_connected')
      localStorage.removeItem('linera_wallet_address')
      
      if (user && handleLogOut) {
        await handleLogOut()
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      setIsConnected(false)
      setAccount(null)
      setBalance(0)
      setError(null)
      
      if (window.sessionStorage) {
        sessionStorage.clear()
      }
      
    } catch (error) {
      setError('断开连接失败，请重试')
    }
  }

  const value: LineraContextType = {
    isConnected,
    account,
    balance,
    connectWallet,
    disconnectWallet,
    isConnecting,
    error,
    DynamicConnectButton,
    isOwner,
    refetchBalance,
  }

  return (
    <LineraContext.Provider value={value}>
      {children}
    </LineraContext.Provider>
  )
}

export const useLinera = (): LineraContextType => {
  const context = useContext(LineraContext)
  if (context === undefined) {
    throw new Error('useLinera must be used within a LineraProvider')
  }
  return context
}