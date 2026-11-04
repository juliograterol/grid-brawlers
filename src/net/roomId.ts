const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** Short, human-typeable room code, e.g. "K7QF2". The server should still verify uniqueness. */
export function generateRoomId(length = 5): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function isValidRoomId(id: string): boolean {
  return new RegExp(`^[${ALPHABET}]{4,8}$`).test(id.toUpperCase());
}
