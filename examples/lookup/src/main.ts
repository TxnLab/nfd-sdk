import { NfdResolver } from '@txnlab/nfd-sdk/lookup'

/**
 * Minimal demo of the slim `@txnlab/nfd-sdk/lookup` entry point.
 *
 * `NfdResolver` reads NFD records directly from on-chain state without
 * bundling the generated typed contract clients or the NFD HTTP API client,
 * making it a good fit for size-sensitive contexts (wallets, extensions, edge
 * functions) that only need name/address resolution.
 *
 * Run with: pnpm start
 */

// A name to resolve on MainNet. Override via the first CLI argument.
const NAME = process.argv[2] ?? 'nfdomains.algo'

async function main(): Promise<void> {
  const resolver = NfdResolver.mainNet()

  // Forward lookup: name -> full NFD record ('full' surfaces verified caAlgo)
  console.log(`\nResolving "${NAME}"...`)
  const nfd = await resolver.resolve(NAME, { view: 'full' })
  console.log({
    name: nfd.name,
    appID: nfd.appID,
    owner: nfd.owner,
    state: nfd.state,
    verifiedAddresses: nfd.caAlgo,
  })

  // Reverse lookup: a verified address -> its primary NFD (read on-chain).
  // An NFD's own verified caAlgo address is, by definition, in the registry's
  // reverse index, so this round-trips back to the same NFD.
  const address = nfd.caAlgo?.[0]
  if (address) {
    console.log(`\nReverse lookup for verified address ${address}...`)
    const primary = await resolver.resolveAddress(address)
    console.log(primary ? `Primary NFD: ${primary.name}` : 'No linked NFD')
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
