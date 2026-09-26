import {
  Brain, Languages, Database, Briefcase, Code, GraduationCap, FlaskConical, Sigma, BookOpen, Globe, Music, Palette,
  Landmark, Stethoscope, Scale, Cpu, Lightbulb, Layers, type LucideIcon,
} from "lucide-react";

export const DECK_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  brain: { icon: Brain, label: "Concepts" },
  languages: { icon: Languages, label: "Language" },
  database: { icon: Database, label: "Data" },
  code: { icon: Code, label: "Programming" },
  cpu: { icon: Cpu, label: "Engineering" },
  briefcase: { icon: Briefcase, label: "Career" },
  graduation: { icon: GraduationCap, label: "University" },
  flask: { icon: FlaskConical, label: "Science" },
  sigma: { icon: Sigma, label: "Maths" },
  book: { icon: BookOpen, label: "Reading" },
  globe: { icon: Globe, label: "Geography" },
  landmark: { icon: Landmark, label: "History" },
  stethoscope: { icon: Stethoscope, label: "Medicine" },
  scale: { icon: Scale, label: "Law" },
  music: { icon: Music, label: "Music" },
  palette: { icon: Palette, label: "Art" },
  lightbulb: { icon: Lightbulb, label: "Ideas" },
  layers: { icon: Layers, label: "General" },
};

export function DeckIcon({ name, className }: { name: string; className?: string }) {
  const I = DECK_ICONS[name]?.icon ?? Layers;
  return <I className={className} />;
}
