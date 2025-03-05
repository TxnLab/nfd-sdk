/**
 * Split an array into chunks of a specified size
 * @param array - The array to split
 * @param chunkSize - The maximum size of each chunk
 * @returns An array of chunks
 */
export function chunkArray<T>(array: T[], chunkSize = 20): T[][] {
  if (!array.length) return []
  if (array.length <= chunkSize) return [array]

  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}
