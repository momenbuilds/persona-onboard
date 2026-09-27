"use client";

import { useId, useRef, useState } from "react";
import { ArrowUpIcon } from "./icons";

type Props = {
  /** Return false to keep the text (e.g. the send was rejected). */
  onSend: (text: string) => boolean | void | Promise<boolean | void>;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
};

/** iMessage-style composer: growing textarea + blue send button. Enter sends, Shift+Enter adds a line. */
export function Composer({ onSend, placeholder = "iMessage", disabled, autoFocus, label = "Your message" }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  function submit() {
    if (!value.trim() || disabled) return;
    if (onSend(value) === false) return;
    setValue("");
    requestAnimationFrame(() => {
      if (ref.current) ref.current.style.height = "auto";
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="liquid-glass flex items-end gap-2 rounded-[24px] py-1.5 pl-4 pr-1.5 focus-within:ring-2 focus-within:ring-ios-blue/60"
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={1}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={1200}
        onChange={(e) => {
          setValue(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent py-[7px] text-[16px] leading-[22px] text-ink outline-none placeholder:text-faint focus-visible:outline-none disabled:opacity-50"
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={disabled || !value.trim()}
        className="mb-px flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-ios-blue text-white transition-[opacity,transform] active:scale-90 disabled:opacity-30"
      >
        <ArrowUpIcon className="h-[18px] w-[18px]" />
      </button>
    </form>
  );
}
