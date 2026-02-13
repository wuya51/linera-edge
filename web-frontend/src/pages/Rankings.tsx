import React from 'react'
import { useQuery } from '@apollo/client'
import { GET_TOP_APPS, AppRanking } from '../services/graphql'
import { Loader2 } from 'lucide-react'
import { useLinera } from '../context/LineraContext'
import { useTranslation } from 'react-i18next'

const Rankings: React.FC = () => {
  const { isConnected } = useLinera()
  const { t } = useTranslation()
  
  const { data: topAppsData, loading: rankingsLoading } = useQuery(GET_TOP_APPS, {
    variables: { limit: 50 },
    skip: !isConnected
  })

  const rankings = topAppsData?.getTopApps?.map((app: AppRanking) => ({
    rank: app.rank,
    name: app.name || app.appId,
    totalBet: app.totalBet,
    change: '0'
  })) || []

  if (!isConnected) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t('connectWallet')}</h2>
        <p className="text-gray-600">{t('connectWalletToViewRankings')}</p>
      </div>
    )
  }

  if (rankingsLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">{t('loadingRankings')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{t('dappRanking')}</h2>
        
        {rankings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">{t('noData')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">{t('rank')}</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">{t('dappName')}</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">{t('totalBet')}</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">{t('change')}</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((item: any) => (
                  <tr key={item.rank} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                        item.rank <= 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
                      } font-bold`}>
                        {item.rank}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">
                      {item.totalBet.toLocaleString()} 积分
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${
                        item.change.startsWith('+') ? 'bg-green-100 text-green-800' :
                        item.change.startsWith('-') ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.change}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{t('settlementRules')}</h3>
        <div className="space-y-3 text-gray-600">
          <p>• {t('hourlySettlement')}</p>
          <p>• {t('top10Share')}</p>
          <p>• {t('rewardWeights')}</p>
          <p>• {t('redeemFeeInfo')}</p>
        </div>
      </div>
    </div>
  )
}

export default Rankings