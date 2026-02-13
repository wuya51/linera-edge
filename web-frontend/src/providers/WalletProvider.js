import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import Web3 from 'web3';
import PropTypes from 'prop-types';
import { useDynamicContext, DynamicConnectButton } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';

const WalletContext = createContext();

const getFormattedAccount = (account) => {
  if (!account) return null;
  return account.startsWith('0x') ? account : `0x${account}`;
};

const formatShortAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const getLineraChainId = async (provider) => {
  const fallbackChainId = '1';
  if (!provider) return fallbackChainId;

  const methods = [
    { method: 'linera_getChainId', processor: (result) => result?.toString() },
    { 
      method: 'metamask_getProviderState', 
      processor: (result) => {
        if (!result?.chainId) return null;
        let chainId = result.chainId;
        if (typeof chainId === 'string' && chainId.startsWith('0x')) {
          chainId = chainId.slice(2);
        }
        return chainId.toString();
      }
    },
    { method: 'eth_chainId', processor: (result) => result?.startsWith?.('0x') ? result.slice(2) : result },
    { method: 'net_version', processor: (result) => result?.toString?.() }
  ];

  for (const { method, processor } of methods) {
    try {
      const result = await provider.request({ method });
      const processed = processor(result);
      if (processed) return processed;
    } catch (error) {
      continue;
    }
  }

  if (provider.chainId) {
    const chainId = provider.chainId.toString().startsWith('0x') 
      ? provider.chainId.toString().slice(2)
      : provider.chainId.toString();
    return chainId;
  }

  if (provider.networkVersion) {
    return provider.networkVersion;
  }

  return fallbackChainId;
};

const getEthereumChainId = async (provider) => {
  return await provider.request({ method: 'eth_chainId' });
};

const shouldUseAppChainId = (walletType, appChainId) => {
  return walletType === 'ethereum' && appChainId;
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children, appChainId }) => {
  const WALLET_CACHE_KEY = 'gm_wallet_cache';
  const CACHE_DURATION = 5 * 60 * 1000;
  const CHECK_INTERVAL = 5000;
  const RECONNECT_DELAY = 500;

  const getCachedWalletState = useCallback(() => {
    try {
      const cached = localStorage.getItem(WALLET_CACHE_KEY);
      if (cached) {
        const state = JSON.parse(cached);
        if (Date.now() - state.timestamp < CACHE_DURATION) {
          return state;
        }
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }
    return null;
  }, []);

  const cacheWalletState = useCallback((state) => {
    try {
      localStorage.setItem(WALLET_CACHE_KEY, JSON.stringify({
        ...state,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }, []);

  const clearWalletCache = useCallback(() => {
    try {
      localStorage.removeItem(WALLET_CACHE_KEY);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }, []);

  const [account, setAccount] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [chainId, setChainId] = useState(appChainId || null);
  const [walletChainId, setWalletChainId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [walletType, setWalletType] = useState(null);

  const { primaryWallet, handleLogOut } = useDynamicContext();
  const reconnectTimeoutRef = useRef(null);
  const lastCheckRef = useRef(0);

  const updateWalletState = useCallback((newAccount, newWalletType, newChainId, newWalletChainId) => {
    setAccount(newAccount);
    setWalletType(newWalletType);
    setChainId(newChainId);
    setWalletChainId(newWalletChainId);
    setIsConnected(!!newAccount);
    
    cacheWalletState({
      account: newAccount,
      isConnected: !!newAccount,
      chainId: newChainId,
      walletChainId: newWalletChainId,
      walletType: newWalletType
    });
  }, [cacheWalletState]);

  const disconnectWalletState = useCallback(() => {
    setAccount(null);
    setIsConnected(false);
    setChainId(appChainId || null);
    setWalletChainId(null);
    setWalletType(null);
    setError(null);
    clearWalletCache();
  }, [appChainId, clearWalletCache]);

  const connectToWallet = useCallback(async (walletTypeToConnect, provider, requestMethod = 'eth_requestAccounts') => {
    try {
      if (isConnected && walletTypeToConnect !== walletType && walletType === 'dynamic' && handleLogOut) {
        await handleLogOut();
      }
      
      let accounts;
      if (walletTypeToConnect === 'linera') {
        const lineraProvider = window.linera || provider;
        if (!lineraProvider) {
          throw new Error('Linera wallet not found');
        }
        const web3 = new Web3(lineraProvider);
        accounts = requestMethod === 'eth_requestAccounts'
          ? await web3.eth.requestAccounts()
          : await web3.eth.getAccounts();
      } else if (walletTypeToConnect === 'dynamic') {
        if (!primaryWallet?.address) {
          throw new Error('Dynamic wallet not connected');
        }
        accounts = [primaryWallet.address];
      } else {
        accounts = await provider.request({ method: requestMethod });
      }

      if (!accounts?.length) {
        throw new Error('No accounts available');
      }

      const formattedAccount = getFormattedAccount(accounts[0]);
      if (!formattedAccount) {
        throw new Error('Invalid account format');
      }

      let walletChainIdValue = '1';
      try {
        if (walletTypeToConnect === 'linera') {
          walletChainIdValue = await getLineraChainId(window.linera || provider);
        } else if (walletTypeToConnect === 'dynamic') {
          walletChainIdValue = appChainId || '1';
        } else {
          walletChainIdValue = await getEthereumChainId(provider);
        }
      } catch (chainError) {
        console.error('Chain ID error:', chainError);
      }

      const finalChainId = shouldUseAppChainId(walletTypeToConnect, appChainId)
        ? appChainId
        : walletChainIdValue;

      updateWalletState(formattedAccount, walletTypeToConnect, finalChainId, walletChainIdValue);
      setError(null);

      return { account: formattedAccount, chainId: walletChainIdValue };
    } catch (error) {
      disconnectWalletState();
      throw error;
    }
  }, [appChainId, primaryWallet, isConnected, walletType, handleLogOut, updateWalletState, disconnectWalletState]);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = useCallback(async () => {
    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_INTERVAL) {
      return;
    }
    lastCheckRef.current = now;

    if (primaryWallet?.address) {
      try {
        await connectToWallet('dynamic', null, 'eth_requestAccounts');
        return;
      } catch (err) {

      }
    }

    if (window.linera) {
      try {
        const web3 = new Web3(window.linera);
        const accounts = await web3.eth.getAccounts();
        if (accounts?.length > 0) {
          await connectToWallet('linera', window.linera);
          return;
        }
      } catch (err) {

      }
    }

    if (window.ethereum) {
      try {
        await connectToWallet('ethereum', window.ethereum, 'eth_accounts');
      } catch (err) {

      }
    }
  }, [getCachedWalletState, updateWalletState, connectToWallet, primaryWallet]);

  useEffect(() => {
    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_INTERVAL) {
      return;
    }
    lastCheckRef.current = now;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (primaryWallet?.address) {
      const formattedAccount = getFormattedAccount(primaryWallet.address);
      if (!isConnected || walletType !== 'dynamic') {
        reconnectTimeoutRef.current = setTimeout(() => {
          connectToWallet('dynamic', null).catch(err => {

          });
        }, RECONNECT_DELAY);
      } else if (account !== formattedAccount && account !== 'Connected') {
        updateWalletState(formattedAccount, 'dynamic', appChainId || '1', appChainId || '1');
      }
    } else if (isConnected && walletType === 'dynamic') {
      reconnectTimeoutRef.current = setTimeout(() => {
        disconnectWalletState();
      }, 1000);
    }
  }, [primaryWallet, isConnected, walletType, connectToWallet, account, appChainId, updateWalletState, disconnectWalletState]);

  const connectWallet = useCallback(async (walletTypeParam = null) => {
    setIsLoading(true);
    setError(null);

    try {
      const detectedType = walletTypeParam ||
        (primaryWallet?.address ? 'dynamic' : window.linera ? 'linera' : window.ethereum ? 'ethereum' : null);

      if (!detectedType) {
        throw new Error('No wallet detected');
      }

      let provider = null;
      if (detectedType !== 'dynamic') {
        provider = detectedType === 'linera' ? window.linera : window.ethereum;
        if (!provider) {
          throw new Error(`${detectedType} wallet not found`);
        }
      }

      await connectToWallet(detectedType, provider, 'eth_requestAccounts');
    } catch (err) {
      const message = err?.message || 'Connection failed';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [primaryWallet, connectToWallet]);

  useEffect(() => {
    const handleAccountsChanged = (accounts) => {
      if (!accounts?.length) {
        disconnectWalletState();
      } else {
        setAccount(getFormattedAccount(accounts[0]));
      }
    };

    const handleChainChanged = (newChainId) => {
      setWalletChainId(newChainId);
      const finalChainId = appChainId || newChainId;
      setChainId(finalChainId);

      window.dispatchEvent(new CustomEvent('walletChainChanged', {
        detail: {
          walletChainId: newChainId,
          appChainId: appChainId || null,
          walletType: walletType || 'unknown',
          usingAppChain: !!appChainId
        }
      }));
    };

    if (window.linera) {
      window.linera.on('accountsChanged', handleAccountsChanged);
      window.linera.on('chainChanged', handleChainChanged);
    }

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    checkConnection();

    return () => {
      if (window.linera) {
        window.linera.removeListener('accountsChanged', handleAccountsChanged);
        window.linera.removeListener('chainChanged', handleChainChanged);
      }
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [checkConnection, appChainId, disconnectWalletState, walletType]);

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return (
    <WalletContext.Provider
      value={{
        account,
        isConnected,
        chainId,
        walletChainId,
        walletType,
        isLoading,
        error,
        setError,
        connectWallet,
        disconnectWallet: disconnectWalletState,
        checkConnection,
        isDynamicConnected: primaryWallet?.address,
        isActiveDynamicWallet: isConnected && walletType === 'dynamic' && account
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

WalletProvider.propTypes = {
  children: PropTypes.node.isRequired,
  appChainId: PropTypes.string
};

WalletProvider.defaultProps = {
  appChainId: null
};

const WalletConnector = ({ setMessage }) => {
  const {
    account,
    isConnected,
    isLoading,
    error,
    walletType,
    connectWallet,
    disconnectWallet
  } = useWallet();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  const { primaryWallet, handleLogOut } = useDynamicContext();
  const isDynamicConnected = primaryWallet?.address;
  const isLineraConnected = isConnected && walletType === 'linera' && account;

  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event) => {
      if (dropdownRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) {
        return;
      }
      setIsDropdownOpen(false);
    };

    document.addEventListener('click', handleClickOutside, true);
    return () => document.removeEventListener('click', handleClickOutside, true);
  }, [isDropdownOpen]);

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  const disconnectDynamicWallet = useCallback(async () => {
    try {
      if (handleLogOut) {
        await handleLogOut();
        disconnectWallet();
        closeDropdown();
      }
    } catch (error) {
      console.error('Dynamic disconnect error:', error);
    }
  }, [handleLogOut, disconnectWallet, closeDropdown]);

  const handleLineraConnect = useCallback(async () => {
    if (!window.linera) {
      setMessage('Linera wallet not installed. Please visit https://github.com/linera-io/linera-protocol/releases', 'warning');
      return;
    }
    try {
      await connectWallet('linera');
      closeDropdown();
    } catch (error) {
      console.error('Linera connect error:', error);
    }
  }, [connectWallet, closeDropdown, setMessage]);

  return (
    <div className="wallet-section top-right">
      <div className="linera-wallet-section">
        {isLineraConnected ? (
          <button
            className="linera-wallet-button active"
            onClick={handleLineraConnect}
            disabled={isLoading && walletType === 'linera'}
          >
            {formatShortAddress(account)}
          </button>
        ) : (
          <button
            className="linera-wallet-button"
            onClick={handleLineraConnect}
            disabled={isLoading && walletType === 'linera'}
          >
            {isLoading && walletType === 'linera' ? 'Connecting...' : 'Linera Wallet'}
          </button>
        )}
        {error && <div className="wallet-error">{error}</div>}
      </div>

      <div className="dynamic-wallet-section">
        {isDynamicConnected ? (
          <button
            className="dynamic-wallet-button active"
            onClick={disconnectDynamicWallet}
            title="Disconnect Dynamic"
          >
            {formatShortAddress(primaryWallet.address)}
          </button>
        ) : (
          <DynamicConnectButton />
        )}
      </div>
    </div>
  );
};

WalletConnector.propTypes = {
  setMessage: PropTypes.func.isRequired
};

export default WalletProvider;
export { WalletConnector, getFormattedAccount, getLineraChainId, getEthereumChainId };