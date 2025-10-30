// The free delivery logic for orders over R500 has been removed.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Return a short relative time string like 'just now', '2m', '3h', '5d', '2mo', '1y'
export function relativeTime(dateInput: string | number | Date): string {
  const now = Date.now();
  const then = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput).getTime() : dateInput.getTime();
  const diff = Math.max(0, now - then);

  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;

  const years = Math.floor(months / 12);
  return `${years}y`;
}
