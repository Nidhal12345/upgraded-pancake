import {
  BookOpen, Dumbbell, Droplet, Footprints, Moon, PenLine, Palette, Sun, Leaf, Brain, Coffee, Heart,
  Music, Bike, Apple, Bed, Languages, Code, Flower2, Sparkles, type LucideIcon,
} from "lucide-react";

export const HABIT_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  pen: { icon: PenLine, label: "Journal" },
  book: { icon: BookOpen, label: "Read" },
  dumbbell: { icon: Dumbbell, label: "Strength" },
  footprints: { icon: Footprints, label: "Run" },
  bike: { icon: Bike, label: "Cycle" },
  droplet: { icon: Droplet, label: "Water" },
  moon: { icon: Moon, label: "Sleep" },
  bed: { icon: Bed, label: "Rest" },
  sun: { icon: Sun, label: "Outside" },
  leaf: { icon: Leaf, label: "Nature" },
  brain: { icon: Brain, label: "Meditate" },
  coffee: { icon: Coffee, label: "Ritual" },
  heart: { icon: Heart, label: "Health" },
  apple: { icon: Apple, label: "Nutrition" },
  music: { icon: Music, label: "Practice" },
  languages: { icon: Languages, label: "Language" },
  code: { icon: Code, label: "Code" },
  palette: { icon: Palette, label: "Create" },
  flower: { icon: Flower2, label: "Care" },
  sparkles: { icon: Sparkles, label: "Other" },
};

export function HabitIcon({ name, className }: { name: string; className?: string }) {
  const I = HABIT_ICONS[name]?.icon ?? Sparkles;
  return <I className={className} />;
}
