/**
 * Convert a string to a Uint8Array
 * @param str - The string to convert
 * @returns The string as a Uint8Array
 */
export function strToUint8Array(str: string): Uint8Array {
  return new Uint8Array(str.length).map((_, i) => str.charCodeAt(i))
}

/**
 * Concatenate two Uint8Arrays
 * @param array1 - The first array
 * @param array2 - The second array
 * @returns The concatenated array
 */
export function concatUint8Arrays(
  array1: Uint8Array,
  array2: Uint8Array,
): Uint8Array {
  const concatenatedArray = new Uint8Array(array1.length + array2.length)

  // Set the first array values
  concatenatedArray.set(array1, 0)

  // Set the second array values starting from the end of the first array
  concatenatedArray.set(array2, array1.length)

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
