"use client";
import { ChevronsUpDown, Check, Moon, Sun, Monitor, Keyboard, RotateCcw, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useApp } from "@/data/store";
import { ACCOUNTS } from "@/data/accounts";
import { useUI } from "@/data/ui-store";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, MenuSub, MenuSubContent, MenuSubTrigger } from "@/components/ui/menu";
import { toneVar } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function setAccountCookie(id: string) {
  document.cookie = `meridian_account=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
}

export function Avatar({ initials, tone, className }: { initials: string; tone: Parameters<typeof toneVar>[0]; className?: string }) {
  return (
    <span style={toneVar(tone)} className={cn("grid size-6 shrink-0 place-items-center rounded-full tone-solid text-[10px] font-semibold text-white", className)}>
      {initials}
    </span>
  );
}

export function AccountMenu({ collapsed }: { collapsed?: boolean }) {
  const accountId = useApp((s) => s.accountId);
  const theme = useApp((s) => s.settings.theme);
  const updateSettings = useApp((s) => s.updateSettings);
  const resetDemo = useApp((s) => s.resetDemo);
  const setShortcutsOpen = useUI((s) => s.setShortcutsOpen);
  const router = useRouter();
  const acct = ACCOUNTS.find((a) => a.id === accountId) ?? ACCOUNTS[0];

  const switchTo = (id: string) => {
    if (id === accountId) return;
    setAccountCookie(id);
    void useApp.getState().hydrate(id);
    router.refresh();
    toast(`Switched to ${ACCOUNTS.find((a) => a.id === id)?.name}`);
  };

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          className={cn(
            "flex h-10 w-full items-center gap-2.5 rounded-[9px] px-2 text-left outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-[var(--ring)] data-[state=open]:bg-pressed",
            collapsed && "justify-center px-0",
          )}
          aria-label="Account menu"
        >
          <Avatar initials={acct.initials} tone={acct.tone} />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{acct.name}</span>
                <span className="block truncate text-[11.5px] text-fg-3">{acct.email}</span>
              </span>
              <ChevronsUpDown className="size-3.5 text-fg-4" />
            </>
          )}
        </button>
      </MenuTrigger>
      <MenuContent side="top" align="start" className="w-[248px]">
        <MenuLabel>Accounts</MenuLabel>
        {ACCOUNTS.map((a) => (
          <MenuItem key={a.id} onSelect={() => switchTo(a.id)}>
            <Avatar initials={a.initials} tone={a.tone} className="size-5 text-[9px]" />
            <span className="min-w-0 flex-1 truncate">{a.name}</span>
            {a.id === accountId && <Check className="!text-accent" />}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuSub>
          <MenuSubTrigger>
            {theme === "dark" ? <Moon /> : theme === "light" ? <Sun /> : <Monitor />}
            Appearance
          </MenuSubTrigger>
          <MenuSubContent>
            {(
              [
                ["light", "Light", Sun],
                ["dark", "Dark", Moon],
                ["system", "System", Monitor],
              ] as const
            ).map(([v, l, I]) => (
              <MenuItem key={v} onSelect={() => updateSettings({ theme: v })}>
                <I />
                {l}
                {theme === v && <Check className="ml-auto !text-accent" />}
              </MenuItem>
            ))}
          </MenuSubContent>
        </MenuSub>
        <MenuItem onSelect={() => setShortcutsOpen(true)} shortcut="?">
          <Keyboard />
          Keyboard shortcuts
        </MenuItem>
        <MenuItem
          onSelect={() => {
            resetDemo();
            toast.success("Sample data restored");
          }}
        >
          <RotateCcw />
          Reset sample data
        </MenuItem>
        <MenuSeparator />
        <MenuItem disabled>
          <LogOut />
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
