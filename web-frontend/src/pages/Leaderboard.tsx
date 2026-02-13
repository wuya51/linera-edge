import React, { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import {
  GET_DAILY_LEADERBOARD,
  GET_WEEKLY_LEADERBOARD,
  GET_MONTHLY_LEADERBOARD,
  GET_TOP_APPS
} from '../services/graphql';

import { useTranslation } from 'react-i18next';
import { formatNumber } from '../utils/formatters';

interface LeaderboardProps {
  address: string | null;
}

interface UserRanking {
  user: string;
  earnings: number;
  rank: number;
}

interface LeaderboardData {
  getDailyLeaderboard?: UserRanking[];
  getWeeklyLeaderboard?: UserRanking[];
  getMonthlyLeaderboard?: UserRanking[];
}

export function Leaderboard({ address }: LeaderboardProps): React.ReactNode {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [activeSection, setActiveSection] = useState<'dapp' | 'discord'>('dapp');
  const { t } = useTranslation();

  const { data: dailyData, loading: dailyLoading, refetch: refetchDaily } = useQuery<LeaderboardData>(GET_DAILY_LEADERBOARD, {
    variables: { limit: 10 }
  });

  const { data: weeklyData, loading: weeklyLoading, refetch: refetchWeekly } = useQuery<LeaderboardData>(GET_WEEKLY_LEADERBOARD, {
    variables: { limit: 10 }
  });

  const { data: monthlyData, loading: monthlyLoading, refetch: refetchMonthly } = useQuery<LeaderboardData>(GET_MONTHLY_LEADERBOARD, {
    variables: { limit: 10 }
  });

  const { data: topAppsData, loading: topAppsLoading, refetch: refetchTopApps } = useQuery(GET_TOP_APPS, {
    variables: { limit: 10 }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      refetchDaily();
      refetchWeekly();
      refetchMonthly();
      refetchTopApps();
    }, 30000);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [refetchDaily, refetchWeekly, refetchMonthly, refetchTopApps]);

  const getCurrentData = (): { data: LeaderboardData | null; loading: boolean } => {
    switch (activeTab) {
      case 'daily':
        return { data: dailyData || null, loading: dailyLoading };
      case 'weekly':
        return { data: weeklyData || null, loading: weeklyLoading };
      case 'monthly':
        return { data: monthlyData || null, loading: monthlyLoading };
      default:
        return { data: null, loading: false };
    }
  };

  const { data, loading } = getCurrentData();
  const leaderboardData: UserRanking[] = data?.getDailyLeaderboard || data?.getWeeklyLeaderboard || data?.getMonthlyLeaderboard || [];

  return (
    <div className="leaderboard-container py-4">   
      <div className="mb-6 flex justify-center">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            className={`px-6 py-2 text-sm font-medium ${activeSection === 'dapp' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'} border border-gray-200 rounded-l-lg`}
            onClick={() => setActiveSection('dapp')}
          >
            {t('dappRanking')}
          </button>
          <button
            type="button"
            className={`px-6 py-2 text-sm font-medium ${activeSection === 'discord' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'} border border-gray-200 rounded-r-lg`}
            onClick={() => setActiveSection('discord')}
          >
            {t('leaderboard')}
          </button>
        </div>
      </div>

      {activeSection === 'dapp' ? (
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('rank')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('dappName')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('totalBet')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('supporters')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topAppsLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto" />
                      <p className="mt-2 text-sm text-gray-600">{t('loading')}</p>
                    </td>
                  </tr>
                ) : !topAppsData?.getTopApps || topAppsData.getTopApps.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                      {t('noData')}
                    </td>
                  </tr>
                ) : (
                  topAppsData.getTopApps.map((app: any) => (
                    <tr key={app.appId}>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {app.rank}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {app.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-900">
                          {formatNumber(app.totalBet)} {t('points')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-900">
                          {app.supporters || 0}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-6 flex justify-center">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                className={`px-6 py-2 text-sm font-medium ${activeTab === 'daily' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'} border border-gray-200 rounded-l-lg`}
                onClick={() => setActiveTab('daily')}
              >
                {t('dailyLeaderboard')}
              </button>
              <button
                type="button"
                className={`px-6 py-2 text-sm font-medium ${activeTab === 'weekly' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'} border-t border-b border-gray-200`}
                onClick={() => setActiveTab('weekly')}
              >
                {t('weeklyLeaderboard')}
              </button>
              <button
                type="button"
                className={`px-6 py-2 text-sm font-medium ${activeTab === 'monthly' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'} border border-gray-200 rounded-r-lg`}
                onClick={() => setActiveTab('monthly')}
              >
                {t('monthlyLeaderboard')}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('rank')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('user')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('earnings')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto" />
                      <p className="mt-2 text-sm text-gray-600">{t('loading')}</p>
                    </td>
                  </tr>
                ) : leaderboardData.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                      {t('noData')}
                    </td>
                  </tr>
                ) : (
                  leaderboardData.map((entry: UserRanking) => (
                    <tr
                      key={entry.user}
                      className={address === entry.user ? 'bg-blue-600 bg-opacity-10' : ''}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {entry.rank}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-900">
                          {entry.user}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-900 font-medium">
                          {formatNumber(entry.earnings)}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-gray-800">
              {t('leaderboardDescription')}
            </h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• {t('dailyLeaderboardDesc')}</li>
              <li>• {t('weeklyLeaderboardDesc')}</li>
              <li>• {t('monthlyLeaderboardDesc')}</li>
              <li>• {t('leaderboardForRewards')}</li>
              <li>• {t('earningsCalculation')}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}