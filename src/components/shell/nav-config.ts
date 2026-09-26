import {
  Sun,
  CalendarRange,
  CalendarDays,
  Repeat2,
  ListChecks,
  NotebookPen,
  Timer,
  ChartNoAxesColumn,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** "G then <key>" navigation shortcut. */
  key: string;
  group: "plan" | "track" | "grow";
  /** Shown in the mobile tab bar. */
  mobile?: boolean;
}

export const NAV: NavItem[] = [
  { href: "/today", label: "Today", icon: Sun, key: "t", group: "plan", mobile: true },
  { href: "/week", label: "This week", icon: CalendarRange, key: "w", group: "plan", mobile: true },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, key: "c", group: "plan" },
  { href: "/tasks", label: "Tasks", icon: ListChecks, key: "k", group: "plan" },
  { href: "/habits", label: "Habits", icon: Repeat2, key: "h", group: "track", mobile: true },
  { href: "/learn", label: "Learning", icon: GraduationCap, key: "l", group: "grow" },
  { href: "/notes", label: "Notes", icon: NotebookPen, key: "n", group: "track" },
  { href: "/focus", label: "Focus", icon: Timer, key: "f", group: "grow" },
  { href: "/stats", label: "Stats", icon: ChartNoAxesColumn, key: "s", group: "track" },
];
