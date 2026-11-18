"use client";

import { useRef, useState, useSyncExternalStore, type InputHTMLAttributes, type ReactNode } from "react";

type Side = {
  name: string;
  label: ReactNode;
  defaultValue?: string;
  /** Hint and error shown under the field (already rendered by the parent). */
  after?: ReactNode;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
};

type Props = { from: Side; to: Side; labelClass: string; inputClass: string };

/** Today on the visitor's device, yyyy-mm-dd (the server checks again with Morocco's date). */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const noop = () => () => {};

/** Opens the browser's calendar on any click in the field (not only on the small icon). */
function openPicker(e: React.MouseEvent<HTMLInputElement>) {
  try {
    e.currentTarget.showPicker?.();
  } catch {
    // Some browsers refuse it outside a direct click; the field still opens its own calendar.
  }
}

/**
 * Departure and return dates, chosen in a calendar (day, month and year), never typed.
 * The return cannot be before the departure, and no date can be in the past.
 */
export function DateRange({ from, to, labelClass, inputClass }: Props) {
  // The page can be prepared in advance on the server: "today" is read on the visitor's device.
  const min = useSyncExternalStore(noop, today, () => undefined);
  const [start, setStart] = useState(from.defaultValue ?? "");
  const toRef = useRef<HTMLInputElement>(null);

  const onStart = (value: string) => {
    setStart(value);
    const ret = toRef.current;
    if (ret && value && ret.value && ret.value < value) ret.value = "";
  };

  return (
    <>
      <label className={labelClass}>
        <span>{from.label}</span>
        <input
          type="date"
          className={inputClass}
          name={from.name}
          defaultValue={from.defaultValue}
          min={min}
          onClick={openPicker}
          onChange={(e) => onStart(e.target.value)}
          {...from.inputProps}
        />
        {from.after}
      </label>
      <label className={labelClass}>
        <span>{to.label}</span>
        <input
          ref={toRef}
          type="date"
          className={inputClass}
          name={to.name}
          defaultValue={to.defaultValue}
          min={start || min}
          onClick={openPicker}
          {...to.inputProps}
        />
        {to.after}
      </label>
    </>
  );
}
