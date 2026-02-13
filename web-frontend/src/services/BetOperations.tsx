import { useCallback, useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import {
  GET_USER_BALANCE,
  GET_USER_BETS,
  IS_WHITELISTED,
  GET_TOP_APPS,
  GET_POOL_AMOUNT,
  GET_ACTIVE_USERS_COUNT,
  GET_LAST_SETTLE_TIME,
  GET_ALL_APPS_FOR_BETTING,
  PLACE_BET,
  REDEEM_BET,
  ADD_APPLICATION,
  REMOVE_APPLICATION,
  INJECT_POOL,
  SUBSCRIBE_BET_EVENTS
} from './graphql';

const isValidAccountOwner = (owner: string | null | undefined): boolean => {
  if (!owner) return false;
  const cleanAddress = owner.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(cleanAddress) || /^0x[a-fA-F0-9]{64}$/.test(cleanAddress)) {
    return true;
  }
  if (/^[a-fA-F0-9]{40}$/.test(cleanAddress) || /^[a-fA-F0-9]{64}$/.test(cleanAddress)) {
    return true;
  }
  return false;
};

const formatAccountOwner = (address: string | null | undefined): string => {
  if (!address) return '';
  const cleanAddress = address.trim();
  if (cleanAddress.startsWith('0x')) {
    return cleanAddress.toLowerCase();
  }
  return `0x${cleanAddress.toLowerCase()}`;
};

const useBetOperations = ({
  currentAccount,
  onMutationComplete,
  onMutationError,
  currentIsConnected
}: {
  currentAccount: string | null;
  onMutationComplete: (data: any, mutationType: string) => void;
  onMutationError: (error: any) => void;
  currentIsConnected: boolean;
}) => {
  const [subscriptionData, setSubscriptionData] = useState({
    betEvents: [] as Array<{
      blockHeight: any;
      blockHash: any;
      timestamp: number;
      type: string;
    }>
  });

  const [subscriptionStatus, setSubscriptionStatus] = useState({
    betEvents: { active: false, lastUpdate: null as string | null, error: null as string | null }
  });

  const [processedEventIds, setProcessedEventIds] = useState(new Set<string>());

  const processedMutationsRef = useRef(new Set<string>());

  const { error: betEventsError } = useSubscription(
    SUBSCRIBE_BET_EVENTS,
    {
      skip: !currentIsConnected,
      shouldResubscribe: false,
      onData: ({ data }) => {
        if (data) {
          setSubscriptionStatus(prev => ({
            ...prev,
            betEvents: {
              active: true,
              lastUpdate: new Date().toISOString(),
              error: null
            }
          }));

          try {
            const notificationData = data?.data;
            if (!notificationData) {
              return;
            }
            const blockHeight = Date.now();
            const blockHash = Math.random().toString(36).substring(2, 18);
            if (!blockHeight || !blockHash) {
              return;
            }

            const eventId = `block-${blockHeight}-${blockHash.substring(0, 16)}`;
            if (processedEventIds.has(eventId)) {
              return;
            }

            setProcessedEventIds(prev => {
              const newSet = new Set([...prev, eventId]);
              if (newSet.size > 100) {
                const array = Array.from(newSet);
                return new Set(array.slice(-50));
              }
              return newSet;
            });

            setSubscriptionData(prev => ({
              ...prev,
              betEvents: [...prev.betEvents, {
                blockHeight,
                blockHash,
                timestamp: Date.now(),
                type: 'new_block'
              }]
            }));

            if (refetchUserBets) refetchUserBets({ fetchPolicy: 'network-only' });
            if (refetchTopApps) refetchTopApps({ fetchPolicy: 'network-only' });
            if (refetchPoolAmount) refetchPoolAmount({ fetchPolicy: 'network-only' });
            if (refetchUserBalance) refetchUserBalance({ fetchPolicy: 'network-only' });
            if (refetchAllApps) refetchAllApps({ fetchPolicy: 'network-only' });

            } catch (error) {
            }
        }
      }
    }
  );

  useEffect(() => {
    if (betEventsError) {
      setSubscriptionStatus(prev => ({
        ...prev,
        betEvents: {
          ...prev.betEvents,
          error: betEventsError.message
        }
      }));
    }
  }, [betEventsError]);

  const { data: userBalanceData, loading: userBalanceLoading, error: userBalanceError, refetch: refetchUserBalance } = useQuery(
    GET_USER_BALANCE,
    {
      variables: { owner: currentAccount ? formatAccountOwner(currentAccount) : null },
      skip: !currentIsConnected || !currentAccount,
      fetchPolicy: 'cache-first'
    }
  );

  const { data: userBetsData, loading: userBetsLoading, error: userBetsError, refetch: refetchUserBets } = useQuery(
    GET_USER_BETS,
    {
      variables: { owner: currentAccount ? formatAccountOwner(currentAccount) : null },
      skip: !currentIsConnected || !currentAccount,
      fetchPolicy: 'cache-first'
    }
  );

  const { data: whitelistData, loading: whitelistLoading, error: whitelistError, refetch: refetchWhitelist } = useQuery(
    IS_WHITELISTED,
    {
      variables: { address: currentAccount ? formatAccountOwner(currentAccount) : null },
      skip: !currentIsConnected || !currentAccount,
      fetchPolicy: 'cache-first'
    }
  );

  const { data: topAppsData, loading: topAppsLoading, error: topAppsError, refetch: refetchTopApps } = useQuery(
    GET_TOP_APPS,
    {
      variables: { limit: 10 },
      fetchPolicy: 'cache-first'
    }
  );

  const { data: poolAmountData, loading: poolAmountLoading, error: poolAmountError, refetch: refetchPoolAmount } = useQuery(
    GET_POOL_AMOUNT,
    {
      fetchPolicy: 'cache-first'
    }
  );

  const { data: activeUsersData, loading: activeUsersLoading, error: activeUsersError, refetch: refetchActiveUsers } = useQuery(
    GET_ACTIVE_USERS_COUNT,
    {
      fetchPolicy: 'cache-first'
    }
  );

  const { data: lastSettleTimeData, loading: lastSettleTimeLoading, error: lastSettleTimeError, refetch: refetchLastSettleTime } = useQuery(
    GET_LAST_SETTLE_TIME,
    {
      fetchPolicy: 'cache-first'
    }
  );

  const { data: allAppsData, loading: allAppsLoading, error: allAppsError, refetch: refetchAllApps } = useQuery(
    GET_ALL_APPS_FOR_BETTING,
    {
      fetchPolicy: 'network-only'
    }
  );

  const refetchAllData = useCallback(() => {
    if (refetchUserBets) refetchUserBets({ fetchPolicy: 'network-only' });
    if (refetchAllApps) refetchAllApps({ fetchPolicy: 'network-only' });
    if (refetchUserBalance) refetchUserBalance({ fetchPolicy: 'network-only' });
    if (refetchTopApps) refetchTopApps({ fetchPolicy: 'network-only' });
    if (refetchPoolAmount) refetchPoolAmount({ fetchPolicy: 'network-only' });
    if (refetchActiveUsers) refetchActiveUsers({ fetchPolicy: 'network-only' });
    if (refetchLastSettleTime) refetchLastSettleTime({ fetchPolicy: 'network-only' });
  }, [refetchUserBets, refetchAllApps, refetchUserBalance, refetchTopApps, refetchPoolAmount, refetchActiveUsers, refetchLastSettleTime]);

  const [placeBet, { data: placeBetData, error: placeBetError, loading: placeBetLoading }] = useMutation(
    PLACE_BET,
    {
      update: () => {},
      errorPolicy: 'ignore'
    }
  );

  const [redeemBet, { data: redeemBetData, error: redeemBetError, loading: redeemBetLoading }] = useMutation(
    REDEEM_BET,
    {
      update: () => {},
      errorPolicy: 'ignore'
    }
  );

  const [addApplication, { data: addApplicationData, error: addApplicationError, loading: addApplicationLoading }] = useMutation(
    ADD_APPLICATION,
    {
      update: () => {},
      errorPolicy: 'ignore'
    }
  );

  const [removeApplication, { data: removeApplicationData, error: removeApplicationError, loading: removeApplicationLoading }] = useMutation(
    REMOVE_APPLICATION,
    {
      update: () => {},
      errorPolicy: 'ignore'
    }
  );

  const [injectPool, { data: injectPoolData, error: injectPoolError, loading: injectPoolLoading }] = useMutation(
    INJECT_POOL,
    {
      update: () => {},
      errorPolicy: 'ignore'
    }
  );

  useEffect(() => {
    if (placeBetData) {
      onMutationComplete(placeBetData, 'placeBet');
      refetchAllData();
    }
  }, [placeBetData, onMutationComplete, refetchAllData]);

  useEffect(() => {
    if (placeBetError) {
      onMutationError(placeBetError);
    }
  }, [placeBetError, onMutationError]);

  useEffect(() => {
    if (redeemBetData) {
      onMutationComplete(redeemBetData, 'redeemBet');
      refetchAllData();
    }
  }, [redeemBetData, onMutationComplete, refetchAllData]);

  useEffect(() => {
    if (redeemBetError) {
      onMutationError(redeemBetError);
    }
  }, [redeemBetError, onMutationError]);

  useEffect(() => {
    if (addApplicationData) {
      onMutationComplete(addApplicationData, 'addApplication');
      refetchAllApps();
    }
  }, [addApplicationData, onMutationComplete, refetchAllApps]);

  useEffect(() => {
    if (addApplicationError) {
      onMutationError(addApplicationError);
    }
  }, [addApplicationError, onMutationError]);

  useEffect(() => {
    if (removeApplicationData) {
      onMutationComplete(removeApplicationData, 'removeApplication');
      refetchAllApps();
    }
  }, [removeApplicationData, onMutationComplete, refetchAllApps]);

  useEffect(() => {
    if (removeApplicationError) {
      onMutationError(removeApplicationError);
    }
  }, [removeApplicationError, onMutationError]);

  useEffect(() => {
    if (injectPoolData) {
      const mutationId = `injectPool-${JSON.stringify(injectPoolData)}`;
      if (!processedMutationsRef.current.has(mutationId)) {
        processedMutationsRef.current.add(mutationId);
        onMutationComplete(injectPoolData, 'injectPool');
        setTimeout(() => {
          refetchPoolAmount();
          processedMutationsRef.current.delete(mutationId);
        }, 1000);
      }
    }
  }, [injectPoolData, onMutationComplete, refetchPoolAmount]);

  useEffect(() => {
    if (injectPoolError) {
      onMutationError(injectPoolError);
    }
  }, [injectPoolError, onMutationError]);

  const handlePlaceBet = useCallback(async (appId: string, amount: number) => {
    if (!isValidAccountOwner(currentAccount)) {
      onMutationError(new Error('Invalid wallet account'));
      return;
    }

    try {
      await placeBet({
        variables: {
          caller: formatAccountOwner(currentAccount),
          appId,
          amount
        }
      });
    } catch (error) {
      onMutationError(error);
    }
  }, [currentAccount, placeBet, onMutationError]);

  const handleRedeemBet = useCallback(async (appId: string, amount: number) => {
    if (!isValidAccountOwner(currentAccount)) {
      onMutationError(new Error('Invalid wallet account'));
      return;
    }

    try {
      await redeemBet({
        variables: {
          caller: formatAccountOwner(currentAccount),
          appId,
          amount
        }
      });
    } catch (error) {
      onMutationError(error);
    }
  }, [currentAccount, redeemBet, onMutationError]);

  const handleAddApplication = useCallback(async (appId: string, name: string, description: string) => {
    if (!isValidAccountOwner(currentAccount)) {
      onMutationError(new Error('Invalid wallet account'));
      return;
    }

    try {
      await addApplication({
        variables: {
          caller: formatAccountOwner(currentAccount),
          appId,
          name,
          description
        }
      });
    } catch (error) {
      onMutationError(error);
    }
  }, [currentAccount, addApplication, onMutationError]);

  const handleRemoveApplication = useCallback(async (appId: string) => {
    if (!isValidAccountOwner(currentAccount)) {
      onMutationError(new Error('Invalid wallet account'));
      return;
    }

    try {
      await removeApplication({
        variables: {
          caller: formatAccountOwner(currentAccount),
          appId
        }
      });
    } catch (error) {
      onMutationError(error);
    }
  }, [currentAccount, removeApplication, onMutationError]);

  const handleInjectPool = useCallback(async (amount: number) => {
    if (!isValidAccountOwner(currentAccount)) {
      onMutationError(new Error('Invalid wallet account'));
      return;
    }

    try {
      await injectPool({
        variables: {
          caller: formatAccountOwner(currentAccount),
          amount
        }
      });
    } catch (error) {
      onMutationError(error);
    }
  }, [currentAccount, injectPool, onMutationError]);

  return {
    userBalanceData,
    userBetsData,
    whitelistData,
    topAppsData,
    poolAmountData,
    activeUsersData,
    lastSettleTimeData,
    allAppsData,
    subscriptionData,
    subscriptionStatus,

    loading: {
      userBalance: userBalanceLoading,
      userBets: userBetsLoading,
      whitelist: whitelistLoading,
      topApps: topAppsLoading,
      poolAmount: poolAmountLoading,
      activeUsers: activeUsersLoading,
      lastSettleTime: lastSettleTimeLoading,
      allApps: allAppsLoading,
      placeBet: placeBetLoading,
      redeemBet: redeemBetLoading,
      addApplication: addApplicationLoading,
      removeApplication: removeApplicationLoading,
      injectPool: injectPoolLoading
    },

    error: {
      userBalance: userBalanceError,
      userBets: userBetsError,
      whitelist: whitelistError,
      topApps: topAppsError,
      poolAmount: poolAmountError,
      activeUsers: activeUsersError,
      lastSettleTime: lastSettleTimeError,
      allApps: allAppsError
    },

    refetchUserBalance,
    refetchUserBets,
    refetchWhitelist,
    refetchTopApps,
    refetchPoolAmount,
    refetchActiveUsers,
    refetchLastSettleTime,
    refetchAllApps,
    refetchAllData,

    handlePlaceBet,
    handleRedeemBet,
    handleAddApplication,
    handleRemoveApplication,
    handleInjectPool,

    isValidAccountOwner,
    formatAccountOwner
  };
};

export default useBetOperations;