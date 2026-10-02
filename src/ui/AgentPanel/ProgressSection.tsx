import type { Progress } from "../../domain/types";
import { displayProgress, progressFraction } from "../../domain/progress";
import { ProgressRing } from "./ProgressRing";
import styles from "./ProgressSection.module.css";

interface ProgressSectionProps {
  progress: Progress;
  currentStep: string | null;
}

/** Progress ring beside the "CURRENT STEP" summary. */
export function ProgressSection({ progress, currentStep }: ProgressSectionProps) {
  const display = displayProgress(progress);
  return (
    <section className={styles.section}>
      <ProgressRing fraction={progressFraction(progress)} label={display.label} caption={display.caption} />
      <div className={styles.step}>
        <h3 className="caps">Current step</h3>
        <p className={styles.text}>{currentStep ?? "No recent activity"}</p>
        {display.detail && <p className={styles.detail}>{display.detail}</p>}
      </div>
    </section>
  );
}
