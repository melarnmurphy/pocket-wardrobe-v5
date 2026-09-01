type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
};

/** The toggle primitive: 42 × 25, knob 19. */
export function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-[25px] w-[42px] shrink-0 items-center rounded-[100px]",
        "transition-colors duration-150 ease-out disabled:opacity-40",
        checked ? "bg-[var(--oxblood)]" : "bg-[rgba(30,26,23,.16)]"
      ].join(" ")}
    >
      <span
        className={[
          "absolute h-[19px] w-[19px] rounded-full bg-[var(--cream)] shadow-sm",
          "transition-transform duration-150 ease-out",
          checked ? "translate-x-[20px]" : "translate-x-[3px]"
        ].join(" ")}
      />
    </button>
  );
}
