import { gql } from '@apollo/client';

export const SUBSCRIBE_BET_EVENTS = gql`
  subscription SubscribeBetEvents {
    notifications
  }
`;

export const GET_USER_BALANCE = gql`
  query GetBalance($owner: AccountOwner) {
    getBalance(owner: $owner)
  }
`;

export const GET_USER_BETS = gql`
  query GetUserBets($owner: AccountOwner) {
    getUserBets(owner: $owner) {
      appId
      amount
      timestamp
    }
  }
`;

export const IS_WHITELISTED = gql`
  query IsWhitelisted($address: AccountOwner!) {
    isWhitelisted(address: $address)
  }
`;

export const GET_APP_TOTAL_BET = gql`
  query GetAppTotalBet($appId: String!) {
    getAppTotalBet(appId: $appId)
  }
`;

export const GET_TOP_APPS = gql`
  query GetTopApps($limit: Int) {
    getTopApps(limit: $limit) {
      appId
      name
      totalBet
      rank
      supporters
    }
  }
`;

export const GET_POOL_AMOUNT = gql`
  query GetPoolAmount {
    getPoolAmount
  }
`;

export const GET_ACTIVE_USERS_COUNT = gql`
  query GetActiveUsersCount {
    getActiveUsersCount
  }
`;

export const GET_OWNER = gql`
  query GetOwner {
    getOwner
  }
`;

export const GET_LAST_SETTLE_TIME = gql`
  query GetLastSettleTime {
    getLastSettleTime
  }
`;

export const DUMMY_MUTATION = gql`
  mutation DummyMutation {
    dummyMutation
  }
`;

export interface UserBet {
  appId: string;
  amount: number;
  timestamp: string;
}

export interface AppRanking {
  appId: string;
  name: string;
  totalBet: number;
  rank: number;
  supporters: number;
}

export interface AppInfo {
  appId: string;
  name: string;
  description: string;
  addedAt: string;
  isActive: boolean;
}

export const GET_ALL_APPS_FOR_BETTING = gql`
  query GetAllAppsForBetting {
    getAllAppsForBetting {
      appId
      name
      totalBet
      rank
      supporters
    }
  }
`;

export const GET_ALL_APPS = gql`
  query GetAllApps {
    getAllApps {
      appId
      name
      description
      addedAt
      isActive
    }
  }
`;

export const GET_APP_INFO = gql`
  query GetAppInfo($appId: String!) {
    getAppInfo(appId: $appId) {
      appId
      name
      description
      addedAt
      isActive
    }
  }
`;

export const ADD_APPLICATION = gql`
  mutation AddApplication($caller: AccountOwner!, $appId: String!, $name: String!, $description: String!) {
    addApplication(caller: $caller, appId: $appId, name: $name, description: $description)
  }
`;

export const REMOVE_APPLICATION = gql`
  mutation RemoveApplication($caller: AccountOwner!, $appId: String!) {
    removeApplication(caller: $caller, appId: $appId)
  }
`;

export const IS_USER_WHITELISTED = gql`
  query IsUserWhitelisted($address: AccountOwner!) {
    isWhitelisted(address: $address)
  }
`;

export const PLACE_BET = gql`
  mutation PlaceBet($caller: AccountOwner!, $appId: String!, $amount: String!) {
    placeBet(caller: $caller, appId: $appId, amount: $amount)
  }
`;

export const REDEEM_BET = gql`
  mutation RedeemBet($caller: AccountOwner!, $appId: String!, $amount: String!) {
    redeemBet(caller: $caller, appId: $appId, amount: $amount)
  }
`;

export const INJECT_POOL = gql`
  mutation InjectPool($caller: AccountOwner!, $amount: String!) {
    injectPool(caller: $caller, amount: $amount)
  }
`;

export interface SettlementStatus {
  lastSettleTime: string;
  nextSettleTime: string;
  totalRewards: number;
}

export interface BetInfo {
  appId: string;
  points: number;
}

export interface RankingInfo {
  appId: string;
  name: string;
  totalPoints: number;
  supporters: number;
  rank: number;
}

export const GET_DAILY_LEADERBOARD = gql`
  query GetDailyLeaderboard($limit: Int) {
    getDailyLeaderboard(limit: $limit) {
      user
      earnings
      rank
    }
  }
`;

export const GET_WEEKLY_LEADERBOARD = gql`
  query GetWeeklyLeaderboard($limit: Int) {
    getWeeklyLeaderboard(limit: $limit) {
      user
      earnings
      rank
    }
  }
`;

export const GET_MONTHLY_LEADERBOARD = gql`
  query GetMonthlyLeaderboard($limit: Int) {
    getMonthlyLeaderboard(limit: $limit) {
      user
      earnings
      rank
    }
  }
`;

export const GET_USER_EARNINGS = gql`
  query GetUserEarnings($user: AccountOwner!) {
    getUserEarnings(user: $user)
  }
`;

export interface UserRanking {
  user: string;
  earnings: number;
  rank: number;
}

export interface UserEarnings {
  daily: number;
  weekly: number;
  monthly: number;
}