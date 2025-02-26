import { useWallet, type Wallet } from '@txnlab/use-wallet-react';
import { useState } from 'react';

const WalletMenu = () => {
	const { wallets, activeWallet } = useWallet();

	// If we have an active wallet, show the connected view
	if (activeWallet) {
		return <ConnectedWallet wallet={activeWallet} />;
	}

	// Otherwise, show the wallet selection list
	return <WalletList wallets={wallets} />;
};

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
	);
};

const WalletOption = ({ wallet }: { wallet: Wallet }) => {
	const [connecting, setConnecting] = useState(false);

	const handleConnect = async () => {
		setConnecting(true);
		try {
			await wallet.connect();
		} catch (error) {
			console.error('Failed to connect:', error);
		} finally {
			setConnecting(false);
		}
	};

	return (
		<button
			onClick={handleConnect}
			disabled={connecting}
			className="wallet-option"
		>
			<img
				src={wallet.metadata.icon}
				alt={wallet.metadata.name}
				width={32}
				height={32}
			/>
			<span>{wallet.metadata.name}</span>
		</button>
	);
};

const ConnectedWallet = ({ wallet }: { wallet: Wallet }) => {
	return (
		<div className="connected-wallet">
			{/* Wallet header */}
			<div className="wallet-header">
				<img
					src={wallet.metadata.icon}
					alt={wallet.metadata.name}
					width={32}
					height={32}
				/>
				<span>{wallet.metadata.name}</span>
			</div>

			{/* Account selector */}
			{wallet.accounts.length > 1 && (
				<select
					value={wallet.activeAccount?.address}
					onChange={(e) => wallet.setActiveAccount(e.target.value)}
				>
					{wallet.accounts.map((account) => (
						<option key={account.address} value={account.address}>
							{account.name}
						</option>
					))}
				</select>
			)}

			{/* Account details */}
			{wallet.activeAccount && (
				<div className="account-info">
					<span>{wallet.activeAccount.address}</span>
				</div>
			)}

			{/* Disconnect button */}
			<button onClick={wallet.disconnect}>Disconnect</button>
		</div>
	);
};

export default WalletMenu;
