import type { ComponentProps } from "react";

/** Primary action styling, shared by buttons and button-like links and labels. */
export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

/**
 * Page shell. `wide` is for galleries; forms read better narrow. Omit the
 * title when the page renders its own header.
 */
export function Page({ title, wide, children }: { title?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <main className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-12 ${wide ? "max-w-5xl" : "max-w-xl"}`}>
      {title && <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>}
      {children}
    </main>
  );
}

export function Field({ label, ...input }: { label: string } & ComponentProps<"input">) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        className="rounded-md border border-zinc-300 px-3 py-2 text-base font-normal dark:border-zinc-700 dark:bg-zinc-900"
        {...input}
      />
    </label>
  );
}

export function Button(props: ComponentProps<"button">) {
  return (
    <button
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      {...props}
    />
  );
}

export function Notice({ tone, children }: { tone: "error" | "ok"; children: React.ReactNode }) {
  const color = tone === "error" ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`text-sm ${color}`}>
      {children}
    </p>
  );
}
