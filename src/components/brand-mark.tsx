import { cn } from "@/lib/cn";

/** RolePebble's placeholder mark, a cairn of three pebbles as in src/app/icon.svg, in the primary colour, so it turns light in the dark scheme. Decorative: put the name next to it. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="8 8 48 48" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <ellipse cx="32" cy="46" rx="19" ry="8" className="fill-primary" />
      <ellipse cx="33.5" cy="29.5" rx="13" ry="6.5" transform="rotate(-5 33.5 29.5)" className="fill-primary opacity-80" />
      <ellipse cx="30.5" cy="16" rx="8" ry="5" transform="rotate(6 30.5 16)" className="fill-primary opacity-60" />
    </svg>
  );
}
