import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  shape?: "round" | "square";
  size?: number;
  children: ReactNode;
}

/** Glass icon-only button (44px round camera controls, 48px square nav, …). */
export function IconButton({ label, shape = "square", size = 44, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`glass ${styles.button} ${className ?? ""}`}
      data-shape={shape}
      style={{ width: size, height: size }}
      {...rest}
    >
      {children}
    </button>
  );
}
