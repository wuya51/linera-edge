import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Trophy, Coins, User, Home, Settings } from 'lucide-react'
import { useLinera } from '../context/LineraContext'
import { useQuery } from '@apollo/client'
import { IS_WHITELISTED } from '../services/graphql'
import { DynamicConnectButton } from '@dynamic-labs/sdk-react-core'
import LanguageSwitcher from './LanguageSwitcher'
import { useTranslation } from 'react-i18next'


const Header: React.FC = () => {
  const { isConnected, account, disconnectWallet } = useLinera()
  const location = useLocation()
  const { t } = useTranslation()

  const formatAccountOwner = (address: string | null) => {
    if (!address) return ''
    const cleanAddress = address.trim().toLowerCase()
    if (cleanAddress.startsWith('0x')) {
      return cleanAddress
    }
    return `0x${cleanAddress}`
  }

  const { data: whitelistData } = useQuery(IS_WHITELISTED, {
    variables: { address: formatAccountOwner(account) },
    skip: !isConnected || !account,
    fetchPolicy: 'network-only'
  })

  const isWhitelisted = whitelistData?.isWhitelisted || false





  const baseNavItems = [
    { path: '/', label: 'home', icon: Home },
    { path: '/betting', label: 'betting', icon: Coins },
    { path: '/leaderboard', label: 'communityLeaderboard', icon: Trophy },
    { path: '/profile', label: 'profile', icon: User },
  ]

  const navItems = isWhitelisted ? [...baseNavItems, { path: '/app-management', label: 'appList', icon: Settings }] : baseNavItems



  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <Trophy className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">Linera Edge</span>
          </Link>

          <nav className="flex space-x-4 md:space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{t(item.label)}</span>
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            {isConnected ? (
              <>
                <div className="text-sm text-gray-600">
                  {account?.slice(0, 6)}...{account?.slice(-4)}
                </div>
                <button
                  onClick={disconnectWallet}
                  className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 rounded-md hover:bg-red-50 transition-colors whitespace-nowrap"
                >
                  <span className="hidden sm:inline">{t('disconnect')}</span>
                  <span className="sm:hidden">{t('disconnect').substring(0, 2)}</span>
                </button>
              </>
            ) : (
              <DynamicConnectButton
                buttonClassName="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm text-sm"
              >
                <span>{t('connectWallet')}</span>
              </DynamicConnectButton>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header