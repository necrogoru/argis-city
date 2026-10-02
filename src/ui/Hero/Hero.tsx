import { DistrictList } from "./DistrictList";
import { HeroHeading } from "./HeroHeading";
import styles from "./Hero.module.css";

/** Left column: headline, description and the district filter list. */
export function Hero() {
  return (
    <section className={styles.hero} aria-label="Overview">
      <HeroHeading />
      <DistrictList />
    </section>
  );
}
