// React 19 resets uncontrolled <form action> fields after the action
// resolves, INCLUDING when the action returns a validation error, so a
// failed submit silently wiped everything the admin had typed. The fix
// pattern: every action that can return an error echoes the submitted
// string values back in its state, and the form feeds them into
// defaultValue ahead of the original defaults. File inputs are not
// echoable (browsers forbid programmatic file values) and are skipped.

export type EchoedValues = Record<string, string>;

export function echoFormValues(formData: FormData): EchoedValues {
  const values: EchoedValues = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

// Checkbox convenience: a ticked box posts "on"; an unticked one posts
// nothing, so its absence in echoed values means unticked ONLY when we
// know the form was submitted (values present at all).
export function echoedChecked(
  values: EchoedValues | null | undefined,
  key: string,
  fallback: boolean,
): boolean {
  if (!values) return fallback;
  return values[key] === "on" || values[key] === "true";
}
