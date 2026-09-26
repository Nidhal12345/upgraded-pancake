import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";
import { ACCOUNTS, DEFAULT_ACCOUNT_ID } from "@/data/accounts";

/** Server layout: resolves the signed-in account (cookie stand-in for auth) and hands it to the client shell. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const id = jar.get("meridian_account")?.value;
  const accountId = ACCOUNTS.some((a) => a.id === id) ? id! : DEFAULT_ACCOUNT_ID;
  return <AppShell accountId={accountId}>{children}</AppShell>;
}
