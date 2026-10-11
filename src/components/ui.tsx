import type { ComponentProps } from "react";

export function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>
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
