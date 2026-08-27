/** The NFD registry app IDs for each network */
export enum NfdRegistryId {
  MAINNET = 760937186,
  TESTNET = 84366825,
}

/** The default sender addresses (fee sinks) for each network */
export enum DefaultSender {
  MAINNET = 'Y76M3MSY6DKBRHBL7C3NNDXGS5IIMQVQVUAB6MP4XEMMGVF2QWNPL226CA',
  TESTNET = 'A7NMWS3NT3IUDMLVO26ULGXGIIOUQ3ND2TXSER6EBGRZNOBOUIQXHIBGDE',
}

/** The Algorand zero address (all zeros, used as a placeholder for "no address") */
export const ALGORAND_ZERO_ADDRESS =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'

/**
 * Static fee (in microAlgos) covering an NFD app call and the inner
 * transactions it issues
 */
export const APP_CALL_STATIC_FEE = 3000n

/** Static fee (in microAlgos) for an NFD renewal, which issues more inners */
export const RENEW_STATIC_FEE = 5000n

/**
 * Additional fee (in microAlgos) per asset in a vault operation, covering the
 * inner transaction the contract issues for each one
 */
export const VAULT_FEE_PER_ASSET = 1000n

/**
 * Minimum balance (in microAlgos) the vault needs per asset it opts into
 *
 * `vaultOptIn` verifies that the transaction immediately before it pays the
 * vault exactly this much per asset in the call, and it is charged whether or
 * not the vault is already opted into that asset.
 */
export const VAULT_OPT_IN_MBR = 100_000n

/** The base URLs for the NFD API for each network */
export enum NfdApiBaseUrl {
  MAINNET = 'https://api.nf.domains',
  TESTNET = 'https://api.testnet.nf.domains',
}
