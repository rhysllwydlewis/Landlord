export type Capability =
  | "rentCollection"
  | "signatures"
  | "referencing"
  | "identity"
  | "banking"
  | "accounting"
  | "depositProtection"
  | "advertising"
  | "taxSubmission"
  | "documentExtraction"
  | "inventoryAnalysis"
  | "sensors"
  | "creditReporting";
export type ProviderResult<T> =
  | { ok: true; provider: string; externalId: string; data: T }
  | {
      ok: false;
      code: "unconfigured" | "unsupported" | "provider_error";
      message: string;
    };
export interface ProviderAdapter {
  id: string;
  configured: boolean;
  execute(
    action: string,
    input: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<ProviderResult<Record<string, unknown>>>;
  verifyWebhook(
    rawBody: string,
    signature: string,
  ): Promise<ProviderResult<{ eventId: string }>>;
}
export class UnconfiguredAdapter implements ProviderAdapter {
  configured = false;
  constructor(public id: string) {}
  async execute(): Promise<ProviderResult<Record<string, unknown>>> {
    return {
      ok: false,
      code: "unconfigured",
      message: "Provider access is not configured. Use the manual workflow.",
    };
  }
  async verifyWebhook(): Promise<ProviderResult<{ eventId: string }>> {
    return {
      ok: false,
      code: "unconfigured",
      message: "Webhook processing is disabled.",
    };
  }
}
export const adapters: Record<Capability, ProviderAdapter> = Object.fromEntries(
  [
    "rentCollection",
    "signatures",
    "referencing",
    "identity",
    "banking",
    "accounting",
    "depositProtection",
    "advertising",
    "taxSubmission",
    "documentExtraction",
    "inventoryAnalysis",
    "sensors",
    "creditReporting",
  ].map((id) => [id, new UnconfiguredAdapter(id)]),
) as unknown as Record<Capability, ProviderAdapter>;
