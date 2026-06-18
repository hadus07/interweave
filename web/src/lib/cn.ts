import { twMerge } from 'tailwind-merge'

export function cn(...parts: (string | false | null | undefined)[]): string {
  return twMerge(parts.filter(Boolean).join(' '))
}
