import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useLinera } from '../context/LineraContext'
import { Loader2, Coins, Wallet, Clock } from 'lucide-react'
import BetOperations from '../services/BetOperations'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '../utils/formatters'

const Betting: React.FC = () => {
  const { isConnected, balance, connectWallet, account, refetchBalance } = useLinera()
  const { t } = useTranslation()
  const [bettingStatus, setBettingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [redeemStatus, setRedeemStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [notifications, setNotifications] = useState<Array<{id: string, message: string, type: string}>>([])
  const [showBetModal, setShowBetModal] = useState(false)
  const [showRedeemModal, setShowRedeemModal] = useState(false)
  const [currentBetApp, setCurrentBetApp] = useState<string | null>(null)
  const [currentRedeemApp, setCurrentRedeemApp] = useState<string | null>(null)
  const [currentBetAmount, setCurrentBetAmount] = useState<string>('')
  const [currentRedeemAmount, setCurrentRedeemAmount] = useState<string>('')
  const [activeAppTab, setActiveAppTab] = useState<'apps' | 'betting'>('apps')
  const [loadedAppsCount, setLoadedAppsCount] = useState(20)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [timeUntilSettlement, setTimeUntilSettlement] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const [activeInfoTab, setActiveInfoTab] = useState<'instructions' | 'reward' | 'calculation'>('instructions')
  const appListRef = useRef<HTMLDivElement>(null)

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
      setBettingStatus('success')
      setTimeout(() => setBettingStatus('idle'), 1500)
    } else if (mutationType === 'redeemBet') {
      successMessage = 'Bet redeemed successfully!'
      setRedeemStatus('success')
      setTimeout(() => setRedeemStatus('idle'), 1500)
    }
    
    addNotification(successMessage, 'success')
    
    refetchBalance?.()
  }, [addNotification, refetchBalance])

  const handleMutationError = useCallback((error: any) => {
    const errorMessage = error.message || 'Operation failed'
    addNotification(`Error: ${errorMessage}`, 'error')
    
    setBettingStatus('error')
    setRedeemStatus('error')
    setTimeout(() => {
      setBettingStatus('idle')
      setRedeemStatus('idle')
    }, 3000)
  }, [addNotification])

  const betOps = BetOperations({
    currentAccount: account,
    onMutationComplete: handleMutationComplete,
    onMutationError: handleMutationError,
    currentIsConnected: isConnected
  })

  const { 
    allAppsData, 
    userBetsData,
    loading,
    handlePlaceBet,
    handleRedeemBet
  } = betOps

  const calculateReturnRateDetails = (app: AppData | UserBetWithAppInfo, userBetAmount: number): { rate: string, details: any } => {
    if (!app.totalBet || app.totalBet === 0) {
      return { 
        rate: '0%',
        details: {
          totalBets: 0,
          distributionAmount: 0,
          rankWeight: 0,
          baseReward: 0,
          supporterBonus: 0,
          growthBonus: 0,
          newAppBonus: 0,
          totalBonus: 0,
          totalReward: 0,
          userBetRatio: 0,
          userReward: 0,
          hourlyRate: 0,
          dailyRate: 0,
          finalRate: 0
        }
      };
    }

    // 对于未投注的用户，使用1积分作为模拟投注金额，确保所有用户看到相同的收益率
    const effectiveBetAmount = userBetAmount > 0 ? userBetAmount : 1;

    // 基于所有应用的总投注计算奖励池
    const totalBetsAcrossAllApps = allAppsData?.getAllAppsForBetting?.reduce((sum: number, a: any) => sum + (a.totalBet || 0), 0) || app.totalBet;
    const distributionAmount = (totalBetsAcrossAllApps * 1) / 100;
    
    // 排名权重 - 与后端一致
    const rankWeights = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6];
    const appRank = Math.min(app.rank || 1, 10) - 1;
    const rankWeight = appRank < rankWeights.length ? rankWeights[appRank] : 6;
    
    // 计算所有应用的总权重
    const totalWeight = rankWeights.reduce((sum, weight) => sum + weight, 0);
    
    // 基础奖励 - 考虑总权重分配
    const baseReward = (distributionAmount * rankWeight) / totalWeight;
    
    // 支持者奖励 - 与后端一致
    const supportersCount = app.supporters || 0;
    const supporterBonus = Math.min((supportersCount as number) * 1, 10);
    
    // 中尾部成长奖金 - 与后端一致
    let growthBonus: number = 0;
    if (appRank >= 5) {
      growthBonus = ((10 - (appRank + 1)) * 1) as number;
    }
    
    // 新应用奖励 - 与后端一致
    let newAppBonus: number = 0;
    if (app.addedAt) {
      const now = Date.now();
      const addedAt = new Date(app.addedAt).getTime();
      const daysSinceAdded = (now - addedAt) / (1000 * 60 * 60 * 24);
      if (daysSinceAdded < 7) {
        newAppBonus = 5;
      }
    }
    
    // 总奖励系数
    const totalBonus = supporterBonus + growthBonus + newAppBonus;
    const totalReward = baseReward * (100 + totalBonus) / 100;
    
    // 用户奖励份额
    const userBetRatio = effectiveBetAmount / app.totalBet;
    const userReward = totalReward * userBetRatio;
    
    // 每日收益限制 - 与后端一致，最高为投注金额的1.5倍
    const maxDailyEarnings = effectiveBetAmount * 1.5;
    const actualUserReward = Math.min(userReward, maxDailyEarnings);
    
    // 每小时收益率
    const hourlyRate = (actualUserReward / effectiveBetAmount) * 100;
    
    // 调整收益率计算，考虑用户投注金额的影响
    // 当用户投注占比增加时，收益率应该略有下降，反映竞争加剧
    // 但确保当用户是唯一投注者时，收益率不会过低
    const userBetPercentage = (effectiveBetAmount / app.totalBet) * 100;
    const adjustmentFactor = Math.max(0.8, 1 - (userBetPercentage / 200)); // 最低保持80%的收益率
    const adjustedHourlyRate = hourlyRate * adjustmentFactor;
    
    // 每日收益率
    const dailyRate = adjustedHourlyRate * 24;
    
    // 确保收益率合理
    const finalRate = Math.max(1, dailyRate); // 最低显示1%的收益率，不设置上限
    
    return { 
      rate: `${finalRate.toFixed(1)}%`,
      details: {
        totalBets: totalBetsAcrossAllApps,
        distributionAmount,
        rankWeight,
        totalWeight,
        baseReward,
        supporterBonus,
        growthBonus,
        newAppBonus,
        totalBonus,
        totalReward,
        userBetRatio,
        userReward,
        hourlyRate,
        dailyRate,
        finalRate,
        adjustmentFactor
      }
    };
  };

  const calculateDailyReturnRate = (app: AppData | UserBetWithAppInfo, userBetAmount: number): string => {
    const result = calculateReturnRateDetails(app, userBetAmount);
    return result.rate;
  };



  interface AppData {
    id: string;
    name: string;
    description: string;
    totalBet: number;
    rank: number;
    supporters: number;
    addedAt: string | undefined;
  }

  const dApps: AppData[] = allAppsData?.getAllAppsForBetting?.map((app: any) => ({
    id: String(app.appId),
    name: app.name || `App ${app.appId}`,
    description: app.totalBet > 0 ? `${t('totalBet')}: ${formatNumber(app.totalBet)} ${t('points')}` : t('noBets'),
    totalBet: typeof app.totalBet === 'string' ? Number(app.totalBet) : app.totalBet || 0,
    rank: app.rank || 0,
    supporters: app.supporters || 0,
    addedAt: app.addedAt
  })) || [];

  const userBets = userBetsData?.getUserBets || []
  
  const userBetsByApp = userBets.reduce((acc: Record<string, number>, bet: any) => {
    const appId = String(bet.appId);
    acc[appId] = (acc[appId] || 0) + bet.amount
    return acc
  }, {} as Record<string, number>)
  
  interface UserBetWithAppInfo {
    appId: string;
    name: string;
    amount: number;
    totalBet: number;
    rank: number;
    supporters: number;
    addedAt: string | undefined;
    timestamp: string | undefined;
    isEligible: boolean;
  }

  const userBetsWithAppInfo: UserBetWithAppInfo[] = Object.entries(userBetsByApp).map(([appId, amount]) => {
    const appInfo = dApps.find(app => app.id === appId);
    const userBet = userBets.find((bet: any) => String(bet.appId) === appId);
    const timestamp = userBet?.timestamp;
    
    // 检查是否满足1分钟的收益资格要求
    let isEligible = false;
    if (timestamp) {
      try {
        const betTime = parseInt(timestamp);
        const currentTime = Date.now() * 1000; // 转换为微秒
        const oneMinuteInMicros = 60 * 1000 * 1000;
        isEligible = currentTime - betTime >= oneMinuteInMicros;
      } catch (error) {
        isEligible = false;
      }
    }
    
    return {
      appId,
      name: appInfo?.name || `App ${appId}`,
      amount: Number(amount),
      totalBet: appInfo?.totalBet || 0,
      rank: appInfo?.rank || 0,
      supporters: appInfo?.supporters || 0,
      addedAt: appInfo?.addedAt,
      timestamp,
      isEligible
    };
  });

  const handleBet = async (appId: string, amount: string) => {
    if (!isConnected || !account) {
      connectWallet()
      return
    }
    
    if (!appId || !amount) {
      addNotification(t('invalidAmount'), 'error')
      return
    }
    
    const betAmount = parseInt(amount)
    // 确保balance是数字类型
    const balanceNum = typeof balance === 'string' ? Number(balance) : balance;
    if (balanceNum === 0) {
      addNotification(t('reloadBalance'), 'info')
      refetchBalance()
      return
    }
    if (betAmount < 1 || betAmount > balanceNum) {
      addNotification(t('betRange', { balance: formatNumber(balanceNum) }), 'error')
      return
    }
    
    try {
      setBettingStatus('loading')
      
      await handlePlaceBet(appId, betAmount)
      
      setCurrentBetApp(null)
      setCurrentBetAmount('')
      
    } catch (error) {
      addNotification(t('betError'), 'error')
      setBettingStatus('error')
      setTimeout(() => setBettingStatus('idle'), 3000)
    }
  }

  const handleRedeem = async (appId: string) => {
    if (!isConnected || !account) {
      addNotification(t('connectWallet'), 'error')
      return
    }
    
    setCurrentRedeemApp(appId)
    setCurrentRedeemAmount('')
    setShowRedeemModal(true)
  }

  const handleRedeemConfirm = async () => {
    if (!currentRedeemApp || !currentRedeemAmount) {
      addNotification(t('invalidAmount'), 'error')
      return
    }
    
    const amount = parseInt(currentRedeemAmount)
    if (isNaN(amount) || amount < 1) {
      addNotification(t('invalidAmount'), 'error')
      return
    }
    
    const userBetAmount = userBetsByApp[currentRedeemApp] || 0
    if (amount > userBetAmount) {
      addNotification(t('redeemRange', { amount: userBetAmount }), 'error')
      return
    }
    
    try {
      setRedeemStatus('loading')
      
      await handleRedeemBet(currentRedeemApp, amount)
      
      setShowRedeemModal(false)
      setCurrentRedeemApp(null)
      setCurrentRedeemAmount('')
      
    } catch (error) {
      addNotification(t('redeemError'), 'error')
      setRedeemStatus('error')
      setTimeout(() => setRedeemStatus('idle'), 3000)
    }
  }
  
  const loadMoreApps = () => {
    if (isLoadingMore) return
    
    setIsLoadingMore(true)
    setTimeout(() => {
      setLoadedAppsCount(prev => prev + 10)
      setIsLoadingMore(false)
    }, 1000)
  }
  
  useEffect(() => {
    const handleScroll = () => {
      if (!appListRef.current) return
      
      const { scrollTop, scrollHeight, clientHeight } = appListRef.current
      
      if (scrollHeight - scrollTop - clientHeight < 100 && !isLoadingMore) {
        loadMoreApps()
      }
    }
    
    const appListElement = appListRef.current
    if (appListElement) {
      appListElement.addEventListener('scroll', handleScroll)
    }
    
    return () => {
      if (appListElement) {
        appListElement.removeEventListener('scroll', handleScroll)
      }
    }
  }, [isLoadingMore])

  useEffect(() => {
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000)
      const nextMinute = Math.ceil(now / 60) * 60
      const timeLeft = nextMinute - now
      
      const hours = Math.floor(timeLeft / 3600)
      const minutes = Math.floor((timeLeft % 3600) / 60)
      const seconds = timeLeft % 60
      
      setTimeUntilSettlement({ hours, minutes, seconds })
    }
    
    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    
    return () => clearInterval(interval)
  }, [])

  // 定期更新用户余额，确保结算后余额能及时更新
  useEffect(() => {
    if (isConnected && account) {
      // 初始加载时更新一次余额
      refetchBalance()
      
      // 每5分钟自动更新一次余额
      const balanceUpdateInterval = setInterval(() => {
        refetchBalance()
      }, 5 * 60 * 1000)
      
      return () => clearInterval(balanceUpdateInterval)
    }
  }, [isConnected, account, refetchBalance])

  if (!isConnected) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t('connectWallet')}</h2>
        <p className="text-gray-600 mb-6">{t('connectWalletMessage')}</p>
        <button
          onClick={connectWallet}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          {t('connectWallet')}
        </button>
      </div>
    )
  }

  if (loading.allApps) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">{t('loadingApps')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-xl font-bold flex items-center space-x-4">
              <div className="flex items-center">
                <Coins className="h-5 w-5 mr-2" />
                <span className="text-base text-blue-200 mr-1">{t('totalBet')}:</span> <span className="text-xl font-bold">{formatNumber(userBets.reduce((sum: number, bet: any) => sum + bet.amount, 0))} {t('points')}</span>
              </div>
              <div className="flex items-center">
                <Wallet className="h-5 w-5 mr-2" />
                <span className="text-base text-blue-200 mr-1">{t('availablePoints')}:</span> <span className="text-xl font-bold">{formatNumber(balance)} {t('points')}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold flex items-center justify-end">
              <Clock className="h-5 w-5 mr-2" />
              <span className="text-base text-blue-200 mr-1">{t('timeUntilSettlement')}:</span> <span className="text-xl font-bold">{timeUntilSettlement.hours > 0 ? `${timeUntilSettlement.hours} ${t('hours')} ` : ''}{timeUntilSettlement.minutes > 0 || timeUntilSettlement.hours > 0 ? `${timeUntilSettlement.minutes} ${t('minutes')} ` : ''}{timeUntilSettlement.seconds} {t('seconds')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveAppTab('apps')}
            className={`px-6 py-4 font-medium text-sm transition-colors ${activeAppTab === 'apps' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('appList')}
          </button>
          <button
            onClick={() => setActiveAppTab('betting')}
            className={`px-6 py-4 font-medium text-sm transition-colors ${activeAppTab === 'betting' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('bettingApps')}
          </button>
        </div>
        
        <div className="p-6">
          {activeAppTab === 'apps' && (
            <>
              {dApps.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">{t('noData')}</p>
                </div>
              ) : (
                <div 
                  ref={appListRef}
                  className="max-h-[800px] overflow-y-auto pr-2"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb #f3f4f6' }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                    {dApps.slice(0, loadedAppsCount).map((app: any) => {
                      const userHasBet = Object.keys(userBetsByApp).includes(app.id);
                      
                      return (
                        <div key={app.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-medium text-gray-900 text-lg">{app.name}</h3>
                              {userHasBet && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                                  {t('hasBet')}
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              {(app.rank > 0 || app.totalBet > 0 || userHasBet) && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  {t('ranking', { rank: app.rank > 0 ? app.rank : 1 })}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-col md:flex-row justify-between mb-4">
                            <div className="md:w-1/2 mb-3 md:mb-0">
                              <p className="text-sm text-gray-600">
                                {userHasBet ? (
                                  `${t('bettingAmount')}: ${formatNumber(userBetsByApp[app.id])} ${t('points')}`
                                ) : (
                                  app.description
                                )}
                              </p>
                              {app.totalBet > 0 && (
                                <div className="mt-3">
                                  <div className="text-sm text-gray-500">{t('dailyReturn')}</div>
                                  <div className="text-2xl font-bold text-green-600">
                                    {calculateDailyReturnRate(app, userBetsByApp[app.id] || 0)}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="md:w-1/2 md:pl-4">
                              {app.totalBet > 0 && (
                                <div>
                                  <div className="text-sm text-gray-600">{t('supporters')}: {app.supporters || 0}</div>
                                  <div className="text-sm text-gray-600">{t('totalBet')}: {formatNumber(app.totalBet)}</div>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                              {t('viewMore')}
                            </button>
                            <button
                              onClick={() => {
                                setCurrentBetApp(app.id);
                                setCurrentBetAmount('');
                                setShowBetModal(true);
                              }}
                              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
                            >
                              {t('bet')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    
                    {isLoadingMore && (
                      <div className="flex justify-center items-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                        <span className="text-gray-600">{t('loading')}</span>
                      </div>
                    )}
                    
                    {loadedAppsCount >= dApps.length && (
                      <div className="text-center py-4">
                        <p className="text-gray-500">{t('allAppsLoaded')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          
          {activeAppTab === 'betting' && (
            <>
              {Object.keys(userBetsByApp).length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">{t('noBettingApps')}</p>
                  {isConnected && (
                    <p className="text-sm text-gray-400 mt-2">{t('startBettingMessage')}</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                  {userBetsWithAppInfo.map((bet: UserBetWithAppInfo) => {
                    return (
                      <div key={bet.appId} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-medium text-gray-900 text-lg">{bet.name}</h3>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                              {String(t('hasBet'))}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {String(t('ranking', { rank: bet.rank || 1 }))}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col md:flex-row justify-between mb-4">
                            <div className="md:w-1/2 mb-3 md:mb-0">
                              <div className="text-sm text-gray-600 mb-1">{String(t('bettingAmount'))}: {formatNumber(bet.amount)} {String(t('points'))}</div>
                              {bet.timestamp && (
                                <div className="text-sm text-gray-500 mb-3">
                                  {String(t('betTime'))}: {(() => {
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
                              )}
                              <div className="mt-2">
                                <div className="text-sm text-gray-500">{String(t('dailyReturn'))}</div>
                                <div className="text-2xl font-bold text-green-600">
                                  {calculateDailyReturnRate(bet, bet.amount)}
                                </div>
                              </div>
                            </div>
                            <div className="md:w-1/2 md:pl-4">
                              <div className="text-sm text-gray-600">{String(t('supporters'))}: {bet.supporters}</div>
                              <div className="text-sm text-gray-600">{String(t('totalBet'))}: {formatNumber(bet.totalBet)}</div>
                              <div className="text-sm mt-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bet.isEligible ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                  {bet.isEligible ? t('eligibleForRewards') : t('notEligibleYet')}
                                </span>
                              </div>
                            </div>
                          </div>
                        
                        <div className="flex justify-between items-center">
                          <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                            {String(t('viewMore'))}
                          </button>
                          <button
                            onClick={() => handleRedeem(bet.appId)}
                            disabled={redeemStatus === 'loading'}
                            className="px-4 py-2 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                          >
                            {redeemStatus === 'loading' ? String(t('processing')) : String(t('redeem'))}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex justify-center space-x-8">
            <button 
              onClick={() => setActiveInfoTab('instructions')}
              className={`py-4 px-1 font-medium text-sm transition-colors ${activeInfoTab === 'instructions' ? 'border-b-2 border-blue-600 text-blue-600' : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`} 
            >
              {t('bettingInstructions')}
            </button>
            <button 
              onClick={() => setActiveInfoTab('reward')}
              className={`py-4 px-1 font-medium text-sm transition-colors ${activeInfoTab === 'reward' ? 'border-b-2 border-blue-600 text-blue-600' : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`} 
            >
              {t('rewardMechanism')}
            </button>
            <button 
              onClick={() => setActiveInfoTab('calculation')}
              className={`py-4 px-1 font-medium text-sm transition-colors ${activeInfoTab === 'calculation' ? 'border-b-2 border-blue-600 text-blue-600' : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`} 
            >
              {t('calculationBasis')}
            </button>
          </nav>
        </div>
        <div className="p-6">
          {activeInfoTab === 'instructions' && (
            <div className="space-y-3 text-gray-600">
              <p>• {t('initialPoints')}</p>
              <p>• {t('minimumBet')}</p>
              <p>• {t('maximumBet')}</p>
              <p>• {t('settlementFrequency')}</p>
              <p>• {t('rewardDistribution')}</p>
              <p>• {t('redeemFee')}</p>
            </div>
          )}
          
          {activeInfoTab === 'reward' && (
            <div className="space-y-4 text-gray-600">
              <p><strong>{t('howRewardsWork')}:</strong></p>
              <div className="pl-4 border-l-2 border-blue-100">
                <p className="mb-2">{t('rewardPoolSource')}</p>
                <p className="mb-2">{t('hourlyDistribution')}: {t('hourlyDistributionDesc')}</p>
                <p className="mb-2">{t('rewardCalculation')}:</p>
                <ul className="list-disc list-inside pl-2 space-y-1">
                  <li>{t('rankWeight')}: {t('rankWeightDesc')}</li>
                  <li>{t('supporterBonus')}: {t('supporterBonusDesc')}</li>
                  <li>{t('growthBonus')}: {t('growthBonusDesc')}</li>
                  <li>{t('newAppBonus')}: {t('newAppBonusDesc')}</li>
                </ul>
                <p className="mt-2">{t('rewardDistribution')}: {t('rewardDistributionDesc')}</p>
              </div>
              
              <p><strong>{t('tipsForMaximizingRewards')}:</strong></p>
              <ul className="list-disc list-inside pl-4 space-y-1">
                <li>{t('diversifyBets')}</li>
                <li>{t('discoverNewApps')}</li>
                <li>{t('checkSupporterCount')}</li>
                <li>{t('betEarly')}</li>
              </ul>
              
              <p className="text-sm text-gray-500 italic">{t('rewardNote')}</p>
            </div>
          )}
          
          {activeInfoTab === 'calculation' && (
            <div className="space-y-4 text-gray-600">
              <p><strong>{t('howReturnRateCalculated')}:</strong></p>
              <div className="pl-4 border-l-2 border-green-100">
                <p className="mb-2">{t('calculationSteps')}:</p>
                <ol className="list-decimal list-inside pl-2 space-y-2">
                  <li>{t('step1CalculatePool')}: {t('step1Desc')}</li>
                  <li>{t('step2DetermineDistribution')}: {t('step2Desc')}</li>
                  <li>{t('step3ApplyRankWeight')}: {t('step3Desc')}</li>
                  <li>{t('step4AddBonuses')}: {t('step4Desc')}</li>
                  <li>{t('step5CalculateUserShare')}: {t('step5Desc')}</li>
                  <li>{t('step6ConvertToDailyRate')}: {t('step6Desc')}</li>
                </ol>
              </div>
              
              <p className="text-sm text-gray-500 italic">{t('calculationNote')}</p>
            </div>
          )}
        </div>
      </div>

      {showBetModal && currentBetApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">{t('betConfirm')}</h3>
              <button
                onClick={() => setShowBetModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('betAmount')}</label>
              <input
                type="number"
                value={currentBetAmount}
                onChange={(e) => setCurrentBetAmount(e.target.value)}
                placeholder={t('placeholderBet')}
                min="1"
                max="100"
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">{t('betRangeInfo')}</p>
            </div>
            
            <div className="text-sm text-gray-600">
                              <p>{t('currentBalance')}: {formatNumber(balance)} {t('points')}</p>
                            </div>
            
            <button
              onClick={() => {
                handleBet(currentBetApp, currentBetAmount);
                setShowBetModal(false);
              }}
              disabled={!currentBetAmount || bettingStatus === 'loading'}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {bettingStatus === 'loading' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('processing')}
                </>
              ) : (
                t('confirmBet')
              )}
            </button>
          </div>
          </div>
        </div>
      )}

      {showRedeemModal && currentRedeemApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">{t('redeemConfirm')}</h3>
              <button
                onClick={() => setShowRedeemModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('redeemAmount')}</label>
                <input
                  type="number"
                  value={currentRedeemAmount}
                  onChange={(e) => setCurrentRedeemAmount(e.target.value)}
                  placeholder={t('placeholderRedeem')}
                  min="1"
                  max={userBetsByApp[currentRedeemApp] || 0}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <p className="text-sm text-gray-500 mt-1">{t('redeemRangeInfo')}</p>
              </div>
              
              <div className="text-sm text-gray-600">
                <p>{t('betTotal')}: {formatNumber(userBetsByApp[currentRedeemApp] || 0)} {t('points')}</p>
                <p>{t('currentBalance')}: {formatNumber(balance)} {t('points')}</p>
                <p className="text-orange-500">{t('feeInfo')}</p>
              </div>
              
              <button
                onClick={handleRedeemConfirm}
                disabled={!currentRedeemAmount || redeemStatus === 'loading'}
                className="w-full py-3 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {redeemStatus === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t('processing')}
                  </>
                ) : (
                  t('confirmRedeem')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Betting