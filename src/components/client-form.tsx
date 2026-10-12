"use client";
import { useRef, useState, type ComponentProps } from "react";

// React form actions reset uncontrolled inputs whenever their promise resolves,
// including handled validation failures. Keep inputs until the caller explicitly
// closes or navigates away, and prevent overlapping submissions.
export function ClientForm({
  action,
  children,
  ...props
}: Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  action: (data: FormData) => void | boolean | Promise<void | boolean>;
}) {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      {...props}
      aria-busy={pending}
      onSubmit={async (event) => {
        event.preventDefault();
        if (inFlight.current) return;
        const form = event.currentTarget;
        const data = new FormData(form);
        inFlight.current = true;
        setPending(true);
        setError("");
        try {
          if ((await action(data)) === true) form.reset();
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "Unable to save. Please try again.",
          );
        } finally {
          inFlight.current = false;
          setPending(false);
        }
      }}
    >
      {children}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
