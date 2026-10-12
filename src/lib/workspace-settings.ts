import { z } from "zod";
export const organisationSettingsSchema = z.object({
  emergencyContact: z.string().trim().max(200).default(""),
  emergencyGuidance: z.string().trim().max(3000).default(""),
  complianceReminderDays: z.number().int().min(1).max(180).default(30),
  documentReminderDays: z.number().int().min(1).max(180).default(30),
});
export const profilePreferencesSchema = z.object({
  email: z.boolean().default(true),
  phone: z.string().trim().max(30).default(""),
  preferredContact: z.enum(["portal", "email", "phone"]).default("portal"),
  accessibilityNeeds: z.string().trim().max(1000).default(""),
});
export function organisationSettings(value: unknown) {
  const result = organisationSettingsSchema.safeParse(value);
  return result.success ? result.data : organisationSettingsSchema.parse({});
}
export function profilePreferences(value: unknown) {
  const result = profilePreferencesSchema.safeParse(value);
  return result.success ? result.data : profilePreferencesSchema.parse({});
}
export type WorkspaceSettings = z.infer<typeof organisationSettingsSchema>;
export type ProfilePreferences = z.infer<typeof profilePreferencesSchema>;
