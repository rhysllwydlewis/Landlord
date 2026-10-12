export async function requestJson<T = Record<string, unknown>>(
  url: string,
  method = "POST",
  body?: unknown,
): Promise<T> {
  const r = await fetch(url, {
    method,
    headers:
      body instanceof FormData ? {} : { "Content-Type": "application/json" },
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(
      [
        data.error || "Unable to complete the request.",
        ...Object.entries(data.fields || {})
          .slice(0, 3)
          .map(
            ([field, errors]) =>
              `${field}: ${Array.isArray(errors) ? errors.join(", ") : String(errors)}`,
          ),
      ].join(" "),
    );
  return data as T;
}
