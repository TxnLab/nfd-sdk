/**
 * Convert a string to a Uint8Array
 * @param str - The string to convert
 * @returns The string as a Uint8Array
 */
export function strToUint8Array(str: string): Uint8Array {
  return new Uint8Array(str.length).map((_, i) => str.charCodeAt(i))
}

/**
 * Concatenate any number of Uint8Arrays
 * @param arrays - The arrays to concatenate, in order
 * @returns The concatenated array
 */
export function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((total, array) => total + array.length, 0)
  const concatenatedArray = new Uint8Array(totalLength)

  // Set each array's values starting from the end of the previous one
  let offset = 0
  for (const array of arrays) {
    concatenatedArray.set(array, offset)
    offset += array.length
  }

  return concatenatedArray
}

/**
 * Check if a Uint8Array contains only zero bytes
 * @param array - The array to check
 * @returns True if all bytes are zero, false otherwise
 */
export function isZeroBytes(array: Uint8Array): boolean {
  return array.every((byte) => byte === 0)
}
