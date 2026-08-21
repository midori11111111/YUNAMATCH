"use client";

import { useFormStatus } from "react-dom";

export default function LoginButton({
  className,
  markClassName,
  mark,
  label,
}: {
  className: string;
  markClassName: string;
  mark: string;
  label: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending}>
      <span className={markClassName} aria-hidden="true">{mark}</span>
      {pending ? "ログイン画面を開いています…" : label}
    </button>
  );
}
