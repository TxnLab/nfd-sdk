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

/** The base URLs for the NFD API for each network */
export enum NfdApiBaseUrl {
  MAINNET = 'https://api.nf.domains',
  TESTNET = 'https://api.testnet.nf.domains',
}
