import type { Account } from "@/domain/types";

/**
 * Demo accounts. In production this is replaced by the auth session; the rest
 * of the app only depends on `Account.id` to scope cache + cloud storage.
 */
export const ACCOUNTS: (Account & { flavor: "personal" | "studio" })[] = [
  { id: "maya", name: "Maya Lindqvist", email: "maya@northwind.co", initials: "ML", tone: "persimmon", flavor: "personal" },
  { id: "studio", name: "Halden Studio", email: "hello@halden.studio", initials: "HS", tone: "iris", flavor: "studio" },
];

export const DEFAULT_ACCOUNT_ID = ACCOUNTS[0].id;
