import { useWallet, type Wallet } from '@txnlab/use-wallet-react'
import { useState } from 'react'

export const WalletMenu = () => {
  const { wallets, activeWallet } = useWallet()

  if (activeWallet) {
    return <ConnectedWallet wallet={activeWallet} />
  }

  return <WalletList wallets={wallets} />
}

const WalletList = ({ wallets }: { wallets: Wallet[] }) => {
  return (
    <div className="wallet-list">
      <h3>Connect Wallet</h3>
      <div className="wallet-options">
        {wallets.map((wallet) => (
          <WalletOption key={wallet.id} wallet={wallet} />
        ))}
      </div>
    </div>
  )
}

const WalletOption = ({ wallet }: { wallet: Wallet }) => {
  const [connecting, setConnecting] = useState(false)

  const handleConnect = async () => {
    setConnecting(true)
    try {
      await wallet.connect()
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className="wallet-option"
      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
    >
      <img
        src={wallet.metadata.icon}
        alt={wallet.metadata.name}
        width={24}
        height={24}
      />
      <span>Connect {wallet.metadata.name}</span>
    </button>
  )
}

const ConnectedWallet = ({ wallet }: { wallet: Wallet }) => {
  return (
    <div
      className="connected-wallet"
      style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      <div
        className="wallet-header"
        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        <img
          src={wallet.metadata.icon}
          alt={wallet.metadata.name}
          width={32}
          height={32}
        />
        <strong>{wallet.metadata.name}</strong>
      </div>

      {wallet.accounts.length > 1 && (
        <select
          value={wallet.activeAccount?.address}
          onChange={(e) => wallet.setActiveAccount(e.target.value)}
          style={{ maxWidth: '640px', padding: '2px' }}
        >
          {wallet.accounts.map((account) => (
            <option key={account.address} value={account.address}>
              {account.address}
            </option>
          ))}
        </select>
      )}

      {wallet.activeAccount && (
        <div className="account-info">
          Active Account: {wallet.activeAccount.address}
        </div>
      )}

      <div>
        <button onClick={wallet.disconnect}>Disconnect</button>
      </div>
    </div>
  )
}
