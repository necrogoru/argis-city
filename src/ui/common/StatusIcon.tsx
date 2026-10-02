import { Check, CircleAlert, Hand, LoaderCircle, Moon, type LucideIcon } from "lucide-react";
import type { StatusIcon as StatusIconName } from "../../domain/status";

const ICONS: Readonly<Record<StatusIconName, LucideIcon>> = {
  loader: LoaderCircle,
  hand: Hand,
  moon: Moon,
  check: Check,
  alert: CircleAlert,
};

interface StatusIconProps {
  icon: StatusIconName;
  size?: number;
  className?: string;
}

/** Maps a domain status icon name onto its Lucide glyph. */
export function StatusIcon({ icon, size = 12, className }: StatusIconProps) {
  const Icon = ICONS[icon];
  return <Icon size={size} strokeWidth={2.2} className={className} aria-hidden />;
}
