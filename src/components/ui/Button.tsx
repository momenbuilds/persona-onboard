import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "ink" | "glass" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  ink: "ink-glass text-white hover:brightness-125 active:brightness-95",
  glass: "liquid-glass text-ink hover:bg-white/90",
  ghost: "text-ink-soft hover:text-ink hover:bg-black/[0.04]",
  danger:
    "bg-ios-red text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_10px_24px_-10px_rgb(255_59_48/0.7)] hover:brightness-110",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-[14px] gap-1.5",
  md: "h-12 px-6 text-[16px] gap-2",
  lg: "h-14 px-7 text-[17px] gap-2.5",
};

export function buttonClass(variant: Variant = "ink", size: Size = "md", extra = "") {
  return [
    "inline-flex select-none items-center justify-center rounded-full font-medium tracking-[-0.01em]",
    "transition-[filter,background-color,transform,opacity] duration-200 ease-(--ease-soft) active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-40",
    VARIANTS[variant],
    SIZES[size],
    extra,
  ].join(" ");
}

type Common = { variant?: Variant; size?: Size; className?: string; children: ReactNode };

export function Button({ variant, size, className, children, type = "button", ...rest }: Common & ComponentProps<"button">) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, className, children, ...rest }: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

/** Round icon-only control (call controls, composer send). Always needs a label. */
export function IconButton({
  label,
  variant = "glass",
  className = "",
  children,
  type = "button",
  ...rest
}: { label: string; variant?: Variant; className?: string; children: ReactNode } & ComponentProps<"button">) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full transition-[filter,transform,background-color,opacity] duration-200 active:scale-95",
        "disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
