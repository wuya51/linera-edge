import React, { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Users, Award, Coins, Wallet, Gift, Loader2 } from 'lucide-react'
import { useLinera } from '../context/LineraContext'
import BetOperations from '../services/BetOperations'
import { AppRanking } from '../services/graphql'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '../utils/formatters'

const Dashboard: React.FC = () => {
  const { isConnected, balance, account } = useLinera()
  const { t } = useTranslation()
  const [stats, setStats] = useState([
    { title: 'platformTotalBet', value: '0', icon: Coins, color: 'text-green-600', bgColor: 'bg-green-50' },
    { title: 'activeUsers', value: '0', icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { title: 'appsWithBets', value: '0', icon: Award, color: 'text-purple-600', bgColor: 'bg-purple-50' },
    { title: 'platformPool', value: '0', icon: TrendingUp, color: 'text-orange-600', bgColor: 'bg-orange-50' }
  ])
  const [notifications, setNotifications] = useState<Array<{id: string, message: string, type: string}>>([])

  const addNotification = useCallback((message: string, type: string = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    setNotifications(prev => [
      ...prev,
      { id, message, type }
    ])
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 3000)
  }, [])

  const handleMutationComplete = useCallback((_data: any, mutationType: string) => {
    let successMessage = 'Operation completed successfully!'
    if (mutationType === 'placeBet') {
      successMessage = 'Bet placed successfully!'
    } else if (mutationType === 'redeemBet') {
      successMessage = 'Bet redeemed successfully!'
    } else if (mutationType === 'addApplication') {
      successMessage = 'Application added successfully!'
    } else if (mutationType === 'removeApplication') {
      successMessage = 'Application removed successfully!'
    }
    
    addNotification(successMessage, 'success')
  }, [addNotification])

  const handleMutationError = useCallback((error: any) => {
    const errorMessage = error.message || 'Operation failed'
    addNotification(`Error: ${errorMessage}`, 'error')
  }, [addNotification])

  const betOps = BetOperations({
    currentAccount: account,
    onMutationComplete: handleMutationComplete,
    onMutationError: handleMutationError,
    currentIsConnected: isConnected
  })

  const { 
    topAppsData, 
    poolAmountData,
    activeUsersData,
    userBetsData,
    loading
  } = betOps

  React.useEffect(() => {
    if (topAppsData && poolAmountData) {
      const topApps = topAppsData.getTopApps || []
      const poolAmount = poolAmountData.getPoolAmount || 0
      const activeUsers = activeUsersData?.getActiveUsersCount || 0
      
      const totalBet = topApps.reduce((sum: number, app: any) => sum + Number(app.totalBet || 0), 0)
      
      setStats([
        { 
          title: 'platformTotalBet', 
          value: formatNumber(totalBet), 
          icon: Coins, 
          color: 'text-green-600', 
          bgColor: 'bg-green-50' 
        },
        { 
          title: 'activeUsers', 
          value: activeUsers.toString(), 
          icon: Users, 
          color: 'text-blue-600', 
          bgColor: 'bg-blue-50' 
        },
        {
          title: 'appsWithBets', 
          value: topApps.length.toString(), 
          icon: Award, 
          color: 'text-purple-600', 
          bgColor: 'bg-purple-50' 
        },
        { 
          title: 'platformPool', 
          value: formatNumber(poolAmount), 
          icon: TrendingUp, 
          color: 'text-orange-600', 
          bgColor: 'bg-orange-50' 
        }
      ])
    }
  }, [topAppsData, poolAmountData, activeUsersData])

  const topDApps = topAppsData?.getTopApps || []

  const isLoading = Object.values(loading).some(load => load)

  return (
    <div className="space-y-8">
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t('welcome')}
        </h1>
        <p className="text-gray-600 mb-4">
          {t('welcomeMessage')}
        </p>
        {!isConnected && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-blue-700">
              {t('connectWalletMessage')}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className={`${stat.bgColor} p-6 rounded-lg shadow-sm`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{t(stat.title)}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    ) : (
                      stat.value
                    )}
                  </p>
                </div>
                <Icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </div>
          )
        })}
      </div>

      {isConnected && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-sm p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold flex items-center space-x-4">
                <div className="flex items-center">
                    <Coins className="h-5 w-5 mr-2" />
                    <span className="text-base text-blue-200 mr-1">{t('totalBet')}:</span> <span className="text-xl font-bold">{formatNumber(userBetsData?.getUserBets?.reduce((sum: number, bet: any) => sum + Number(bet.amount), 0) || 0)} {t('points')}</span>
                  </div>
                  <div className="flex items-center">
                    <Wallet className="h-5 w-5 mr-2" />
                    <span className="text-base text-blue-200 mr-1">{t('availablePoints')}:</span> <span className="text-xl font-bold">{formatNumber(balance)} {t('points')}</span>
                  </div>
              </div>
              <div className="flex items-center mt-2">
                <Gift className="h-4 w-4 mr-2 text-blue-200" />
                <p className="text-blue-100">{t('initialPoints')}</p>
              </div>
            </div>
            <Link
              to="/betting"
              className="bg-white text-blue-600 px-6 py-3 rounded-md font-medium hover:bg-blue-50 transition-colors"
            >
              {t('startBetting')}
            </Link>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">{t('dappRanking')}</h2>
          <Link to="/rankings" className="text-blue-600 hover:text-blue-700 font-medium">
            {t('viewAll')}
          </Link>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">{t('loading')}</span>
          </div>
        ) : topDApps.length === 0 ? (
          <div className="text-center py-12">
            <Award className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('noData')}</p>
            {!isConnected && (
              <p className="text-sm text-gray-400 mt-2">{t('connectWallet')}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {topDApps.map((dapp: AppRanking, index: number) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 font-bold rounded-full">
                    {dapp.rank}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{dapp.name || dapp.appId}</h3>
                    <p className="text-sm text-gray-500">{t('totalBet')}: {formatNumber(dapp.totalBet)} {t('points')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${dapp.totalBet > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {dapp.totalBet > 0 ? t('active') : t('inactive')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{t('howToParticipate')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <Coins className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">{t('step1')}</h3>
            <p className="text-gray-600">{t('step1Desc')}</p>
          </div>
          <div className="text-center">
            <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">{t('step2')}</h3>
            <p className="text-gray-600">{t('step2Desc')}</p>
          </div>
          <div className="text-center">
            <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">{t('step3')}</h3>
            <p className="text-gray-600">{t('step3Desc')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard