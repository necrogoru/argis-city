import styles from "./HeroHeading.module.css";

export function HeroHeading() {
  return (
    <div className={styles.heading}>
      <h1 className={styles.title}>
        Agent
        <br />
        Infrastructure
      </h1>
      <p className={styles.description}>
        Every coding agent running on this machine, mapped as a living city — one tower per tool,
        one house per live session.
      </p>
    </div>
  );
}
