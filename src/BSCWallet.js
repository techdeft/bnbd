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
  }
];

// Minimal BEP20 ABI for token interaction
const BEP20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

function BSCWallet() {
  const [account, setAccount] = useState('');
  const [bnbBalance, setBnbBalance] = useState('0');
  const [usdBalance, setUsdBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [tokenBalances, setTokenBalances] = useState([]);

  const ensureBSCNetwork = async () => {
    try {
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      if (currentChainId !== BSC_MAINNET.chainId) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BSC_MAINNET.chainId }]
          });
          return true;
        } catch (switchError) {
          throw new Error('Please switch to BSC network to continue.');
        }
      }
      return true;
    } catch (error) {
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
      await ensureBSCNetwork();

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
      // Get BNB balance
      const balance = await provider.getBalance(address);
      const formattedBalance = ethers.utils.formatEther(balance);
      setBnbBalance(parseFloat(formattedBalance).toFixed(8));
      
      // Get BNB price in USD
      const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT');
      const data = await response.json();
      const bnbPrice = parseFloat(data.price);
      const usdValue = (parseFloat(formattedBalance) * bnbPrice).toFixed(2);
      setUsdBalance(usdValue);

      // Check common tokens
      const commonTokenBalances = await checkCommonTokens(address, provider);
      setTokenBalances(commonTokenBalances);
    } catch (error) {
      console.error('Error updating balances:', error);
      setError('Failed to fetch balances: ' + error.message);
    }
  };

  const checkCommonTokens = async (address, provider) => {
    const tokenPromises = COMMON_TOKENS.map(async (token) => {
      try {
        const contract = new ethers.Contract(token.address, BEP20_ABI, provider);
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

  return (
    <div className="app">
      <div className="container">
        <div className="card">
          <img src="/bnb-logo.svg" alt="BNB Logo" className="logo" />
          <h1 className="title">BSC Wallet</h1>
          
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

              {tokenBalances.length > 0 && (
                <div className="token-balances">
                  <h2 className="token-title">Token Balances</h2>
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

export default BSCWallet; 