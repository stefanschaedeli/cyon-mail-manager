import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const PASSWORD_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";

export function generatePassword(length: number): string {
  const chars = PASSWORD_CHARS;
  // Use rejection sampling to avoid modulo bias (256 % 72 != 0)
  const limit = 256 - (256 % chars.length);
  const result: string[] = [];
  while (result.length < length) {
    const array = new Uint8Array(length - result.length + 16);
    crypto.getRandomValues(array);
    for (const byte of array) {
      if (result.length >= length) break;
      if (byte < limit) result.push(chars[byte % chars.length]);
    }
  }
  return result.join("");
}
