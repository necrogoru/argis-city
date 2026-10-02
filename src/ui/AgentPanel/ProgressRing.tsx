import styles from "./ProgressRing.module.css";

interface ProgressRingProps {
  /** 0–1 fill. */
  fraction: number;
  label: string;
  caption: string;
  size?: number;
  stroke?: number;
}

/** SVG ring: faint track, accent arc with glow, centred value + caption. */
export function ProgressRing({ fraction, label, caption, size = 112, stroke = 8 }: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, fraction));

  return (
    <div className={styles.ring} style={{ width: size, height: size }} role="img" aria-label={`${label} ${caption}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className={styles.track} cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
        <circle
          className={styles.arc}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className={styles.center}>
        <span className={styles.value}>{label}</span>
        <span className={styles.caption}>{caption}</span>
      </div>
    </div>
  );
}
