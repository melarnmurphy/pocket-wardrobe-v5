import type { ReactNode } from "react";

type HairlineListRowProps = {
  children: ReactNode;
  last?: boolean;
  className?: string;
};

/** A full-width row separated by a hairline; the last row in a list carries none. */
export function HairlineListRow({ children, last = false, className = "" }: HairlineListRowProps) {
  return (
    <div
      className={[
        "flex items-center gap-[13px] py-[14px]",
        last ? "" : "border-b border-[rgba(30,26,23,.11)]",
        className
      ].join(" ")}
    >
      {children}
    </div>
  );
}
