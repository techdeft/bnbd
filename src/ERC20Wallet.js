import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

// Ethereum Mainnet configuration
const ETH_MAINNET = {
  chainId: '0x1', // 1 in decimal
  chainName: 'Ethereum Mainnet',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://mainnet.infura.io/v3/'],
  blockExplorerUrls: ['https://etherscan.io/'],
};

// Common ERC20 tokens on Ethereum
const COMMON_ERC20_TOKENS = [
  {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6
  },
  {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6
  },
  {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18
  },
  {
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8
  },
  {
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    symbol: 'UNI',
    name: 'Uniswap',
    decimals: 18
  }
];

// Minimal ERC20 ABI for token interaction
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

function ERC20Wallet() {
  const [account, setAccount] = useState('');
  const [ethBalance, setEthBalance] = useState('0');
  const [usdBalance, setUsdBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [tokenBalances, setTokenBalances] = useState([]);
  const [scanStatus, setScanStatus] = useState('');

  const ensureETHNetwork = async () => {
    try {
      console.log('Checking network connection...');
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      console.log('Current chain ID:', currentChainId);
      
      if (currentChainId !== ETH_MAINNET.chainId) {
        console.log('Not on ETH network, switching...');
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: ETH_MAINNET.chainId }]
          });
          console.log('Successfully switched to ETH network');
          return true;
        } catch (switchError) {
          console.error('Switch error:', switchError);
          throw new Error('Please switch to Ethereum network to continue.');
        }
      }
      console.log('Already on ETH network');
      return true;
    } catch (error) {
      console.error('Network check error:', error);
      throw error;
    }
  };

  const connectWallet = async () => {
    try {
      setLoading(true);
      setError('');

      if (typeof window.ethereum === 'undefined') {
        throw new Error('No Web3 wallet detected. Please install MetaMask or Trust Wallet.');
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts',
        params: []
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please check your wallet and try again.');
      }

      const account = accounts[0];
      await ensureETHNetwork();

      setAccount(account);
      setProvider(provider);
      setIsCorrectNetwork(true);
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

  const updateBalance = async (address, provider) => {
    try {
      // Get ETH balance
      const balance = await provider.getBalance(address);
      const formattedBalance = ethers.utils.formatEther(balance);
      setEthBalance(parseFloat(formattedBalance).toFixed(8));
      
      // Get ETH price in USD
      const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT');
      const data = await response.json();
      const ethPrice = parseFloat(data.price);
      const usdValue = (parseFloat(formattedBalance) * ethPrice).toFixed(2);
      setUsdBalance(usdValue);

      // Check common tokens
      const commonTokenBalances = await checkCommonTokens(address, provider);
      console.log('Common tokens found:', commonTokenBalances);

      // Scan for all tokens
      await scanForTokens(address, provider);
    } catch (error) {
      console.error('Error updating balances:', error);
      setError('Failed to fetch balances: ' + error.message);
    }
  };

  const checkCommonTokens = async (address, provider) => {
    const tokenPromises = COMMON_ERC20_TOKENS.map(async (token) => {
      try {
        const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
        const balance = await contract.balanceOf(address);
        const formattedBalance = ethers.utils.formatUnits(balance, token.decimals);
        
        return {
          ...token,
          balance: formattedBalance,
          formattedBalance: parseFloat(formattedBalance).toFixed(8)
        };
      } catch (error) {
        console.error(`Error checking ${token.symbol}:`, error);
        return null;
      }
    });

    const results = await Promise.all(tokenPromises);
    return results.filter(token => token !== null);
  };

  const scanForTokens = async (address, provider) => {
    try {
      setScanStatus('Scanning for ERC20 tokens...');
      
      // Get the current block number
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = currentBlock - 100000;

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

      const logs = await provider.getLogs(filter);
      const uniqueTokens = [...new Set(logs.map(log => log.address))];
      
      setScanStatus(`Found ${uniqueTokens.length} potential tokens. Checking balances...`);

      const tokenPromises = uniqueTokens.map(async (tokenAddress) => {
        try {
          const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          
          let symbol, name, decimals;
          try {
            symbol = await contract.symbol();
            name = await contract.name();
            decimals = await contract.decimals();
          } catch (error) {
            return null;
          }

          const balance = await contract.balanceOf(address);
          const formattedBalance = ethers.utils.formatUnits(balance, decimals);
          
          return {
            address: tokenAddress,
            symbol,
            name,
            decimals,
            balance: formattedBalance,
            formattedBalance: parseFloat(formattedBalance).toFixed(8)
          };
        } catch (error) {
          return null;
        }
      });

      const results = await Promise.all(tokenPromises);
      const validTokens = results.filter(token => token !== null);
      
      // Combine common tokens and scanned tokens
      const commonTokens = await checkCommonTokens(address, provider);
      const allTokens = [...commonTokens, ...validTokens];
      
      // Remove duplicates
      const dedupedTokens = allTokens.filter((token, index, self) =>
        index === self.findIndex((t) => t.address === token.address)
      );
      
      // Sort by balance
      dedupedTokens.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));
      
      setTokenBalances(dedupedTokens);
      setScanStatus('');
    } catch (error) {
      console.error('Error scanning tokens:', error);
      setScanStatus('Error scanning tokens: ' + error.message);
    }
  };

  return (
    <div className="app">
      <div className="container">
        <div className="card">
          <img src="/eth-logo.svg" alt="ETH Logo" className="logo" />
          <h1 className="title">Ethereum Wallet</h1>
          
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
                  <span>ETH Balance:</span>
                  <span className="balance-value">{ethBalance} ETH</span>
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
                  <h2 className="token-title">Token Balances</h2>
                  {tokenBalances.map((token) => (
                    <div key={token.address} className="token-row">
                      <div className="token-info">
                        <span className="token-symbol">{token.symbol}</span>
                        <span className="token-name">{token.name}</span>
                        <a 
                          href={`https://etherscan.io/token/${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="token-address"
                        >
                          {token.address.substring(0, 6)}...{token.address.substring(38)}
                        </a>
                      </div>
                      <div className="token-balance">
                        {token.formattedBalance}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ERC20Wallet; 