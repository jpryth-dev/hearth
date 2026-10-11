/**
 * A text field from submitted form data. Files and missing fields come back
 * as "", so the caller's Zod schema rejects them like any other bad input.
 */
export function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
