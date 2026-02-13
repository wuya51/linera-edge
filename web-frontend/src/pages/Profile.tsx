import React, { useEffect, useState } from 'react'
import { useLinera } from '../context/LineraContext'
import { useQuery } from '@apollo/client'
import { GET_USER_BETS, GET_USER_BALANCE, GET_ALL_APPS, UserBet } from '../services/graphql'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const Profile: React.FC = () => {
  const { isConnected, account, balance } = useLinera()
  const { t } = useTranslation()
  const [userBets, setUserBets] = useState<UserBet[]>([])
  const [notifications, setNotifications] = useState<Array<{id: string, message: string, type: string}>>([])

  const addNotification = (message: string, type: string = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    setNotifications(prev => [
      ...prev,
      { id, message, type }
    ])
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 3000)
  }
  
  const { data: betsData, loading: betsLoading } = useQuery(GET_USER_BETS, {
    variables: { owner: account },
    skip: !isConnected || !account
  })
  
  const { data: balanceData, loading: balanceLoading } = useQuery(GET_USER_BALANCE, {
    variables: { owner: account },
    skip: !isConnected || !account
  })
  
  const { data: allAppsData } = useQuery(GET_ALL_APPS, {
    skip: !isConnected
  })
  
  useEffect(() => {
    if (betsData?.getUserBets) {
      setUserBets(betsData.getUserBets)
    }
  }, [betsData])
  
  const appNameMap: Record<string, string> = {
    '1': 'GMIC IM'
  }

  if (!isConnected) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t('connectWallet')}</h2>
        <p className="text-gray-600">{t('connectWalletMessage')}</p>
      </div>
    )
  }

  const isLoading = betsLoading || balanceLoading
  
  const totalBets = userBets.length
  const totalBetAmount = userBets.reduce((sum, bet) => sum + bet.amount, 0)
  const maxBet = userBets.length > 0 ? Math.max(...userBets.map(bet => bet.amount)) : 0
  const avgBet = userBets.length > 0 ? totalBetAmount / userBets.length : 0
  
  const displayBalance = balanceData?.getBalance || balance || 0

  return (
    <div className="space-y-6">
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(notification => (
          <div 
            key={notification.id}
            className={`px-4 py-3 rounded-lg shadow-lg flex items-center ${notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : notification.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}
          >
            <span className="mr-2">{notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : 'ℹ️'}</span>
            <span>{notification.message}</span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t('profile')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">{t('walletAddress')}</label>
            <div className="flex items-center justify-between border border-gray-200 rounded-lg p-3 bg-gray-50">
              <p className="font-mono text-sm text-gray-900">
                {account?.slice(0, 6)}...{account?.slice(-4)}
              </p>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(account || '')
                  addNotification('Wallet address copied to clipboard!', 'success')
                }}
                className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700 transition-colors"
              >
                {t('copy')}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">{t('balance')}</label>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin inline" />
                ) : (
                  <>
                    {displayBalance} {t('points')} <span className="text-sm text-gray-500 font-normal">({t('availablePoints')})</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{t('bettingStats')}</h3>
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">{t('loading')}</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{totalBets}</div>
              <div className="text-sm text-gray-600">{t('betCount')}</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{totalBetAmount}</div>
              <div className="text-sm text-gray-600">{t('totalBet')}</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{maxBet}</div>
              <div className="text-sm text-gray-600">{t('maxBet')}</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{avgBet.toFixed(1)}</div>
              <div className="text-sm text-gray-600">{t('avgBet')}</div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{t('bettingHistory')}</h3>
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">{t('loading')}</span>
          </div>
        ) : userBets.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">{t('noBettingApps')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {userBets.map((bet, index) => {
              const appIdStr = String(bet.appId);
              let appName = appNameMap[appIdStr];
              if (!appName && allAppsData?.getAllApps) {
                const app = allAppsData.getAllApps.find((a: any) => a.appId === appIdStr);
                appName = app?.name;
              }
              if (!appName) {
                appName = appIdStr;
              }
              
              return (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <div className="font-medium text-gray-900">{appName}</div>
                    <div className="text-sm text-gray-500">
                      {(() => {
                        try {
                          const parsedTimestamp = parseInt(bet.timestamp);
                          if (isNaN(parsedTimestamp)) {
                            return t('unknown');
                          }
                          const milliseconds = parsedTimestamp / 1000;
                          return new Date(milliseconds).toLocaleString();
                        } catch (error) {
                          return t('unknown');
                        }
                      })()}
                    </div>
                  </div>
                  <div className="text-lg font-bold text-blue-600">+{bet.amount} {t('points')}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Profile