import {
  WalletId,
  WalletManager,
  WalletProvider,
} from '@txnlab/use-wallet-react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'

const walletManager = new WalletManager({
  wallets: [
    {
      id: WalletId.LUTE,
      options: { siteName: 'NFD SDK Set Metadata Example' },
    },
  ],
  defaultNetwork: 'testnet',
  options: {
    resetNetwork: true,
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider manager={walletManager}>
      <App />
    </WalletProvider>
  </StrictMode>,
)
