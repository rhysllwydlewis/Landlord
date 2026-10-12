import { z } from "zod";
const id = z.string().min(1);
const pence = z.number().int().min(0).max(2000000000);
export const propertyDetailsSchema = z
  .object({
    localAuthority: z.string().trim().max(160).optional(),
    licenceType: z.string().trim().max(160).optional(),
    licenceReference: z.string().trim().max(120).optional(),
    licenceExpiresAt: z.iso.date().nullable().optional(),
    purchaseDate: z.iso.date().nullable().optional(),
    mortgageProvider: z.string().trim().max(160).optional(),
    mortgageReference: z.string().trim().max(120).optional(),
    mortgageBalancePence: pence.nullable().optional(),
    mortgagePaymentPence: pence.nullable().optional(),
    insuranceProvider: z.string().trim().max(160).optional(),
    insuranceReference: z.string().trim().max(120).optional(),
    insuranceExpiresAt: z.iso.date().nullable().optional(),
  })
  .strict();
export const propertySchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(250),
  postcode: z
    .string()
    .trim()
    .min(3)
    .max(12)
    .transform((s) => s.toUpperCase()),
  type: z.enum([
    "house",
    "flat",
    "apartment",
    "HMO",
    "student",
    "multi-unit",
    "commercial",
  ]),
  jurisdiction: z
    .enum(["England", "Wales", "Scotland", "Northern Ireland"])
    .default("England"),
  bedrooms: z.number().int().min(0).max(200).default(0),
  bathrooms: z.number().int().min(0).max(100).default(0),
  furnishing: z
    .enum(["unfurnished", "part furnished", "furnished"])
    .default("unfurnished"),
  epcRating: z.enum(["A", "B", "C", "D", "E", "F", "G"]).nullable().optional(),
  purchasePricePence: pence.nullable().optional(),
  valuePence: pence.nullable().optional(),
  details: propertyDetailsSchema.optional(),
  notes: z.string().max(10000).default(""),
  portfolioId: id.nullable().optional(),
  ownerId: id.nullable().optional(),
});
// Zod 4 applies defaults inside optional fields. PATCH validation must remove
// creation defaults so omitted values never overwrite existing records.
export const propertyPatchSchema = propertySchema.partial().extend({
  jurisdiction: propertySchema.shape.jurisdiction.removeDefault().optional(),
  bedrooms: propertySchema.shape.bedrooms.removeDefault().optional(),
  bathrooms: propertySchema.shape.bathrooms.removeDefault().optional(),
  furnishing: propertySchema.shape.furnishing.removeDefault().optional(),
  notes: propertySchema.shape.notes.removeDefault().optional(),
});
export const tenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().transform((s) => s.toLowerCase()),
  phone: z.string().max(30).default(""),
});
export const tenantPatchSchema = tenantSchema
  .partial()
  .omit({ email: true })
  .extend({
    phone: tenantSchema.shape.phone.removeDefault().optional(),
  });
export const tenancySchema = z
  .object({
    propertyId: id,
    unitId: id.optional(),
    tenantIds: z.array(id).min(1).max(30),
    reference: z.string().trim().min(2).max(100),
    startDate: z.iso.date(),
    endDate: z.iso.date().optional(),
    rentPence: pence.positive(),
    frequency: z
      .enum(["monthly", "weekly", "fortnightly", "quarterly", "annual"])
      .default("monthly"),
    dueDay: z.number().int().min(1).max(31).default(1),
    depositPence: pence.default(0),
  })
  .refine((x) => !x.endDate || x.endDate >= x.startDate, {
    message: "End date must follow the start date.",
    path: ["endDate"],
  });
export const expenseSchema = z.object({
  propertyId: id,
  repairId: id.optional(),
  category: z.enum([
    "Repairs",
    "Mortgage",
    "Insurance",
    "Service charge",
    "Management fee",
    "Utilities",
    "Licensing",
    "Other",
  ]),
  description: z.string().trim().min(3).max(250),
  supplier: z.string().max(120).default(""),
  invoiceReference: z.string().max(120).default(""),
  amountPence: pence.positive(),
  incurredAt: z.iso.date(),
});
export const complianceSchema = z
  .object({
    propertyId: id,
    title: z.string().trim().min(3).max(160),
    category: z.enum([
      "Gas safety",
      "EICR",
      "EPC",
      "HMO licence",
      "Other licence",
      "Fire assessment",
      "Alarm check",
      "Legionella",
      "Insurance",
      "Deposit information",
      "Right to Rent",
      "Other",
    ]),
    issuedAt: z.iso.date(),
    expiresAt: z.iso.date().optional(),
    reference: z.string().max(100).default(""),
    notes: z.string().max(10000).default(""),
    documentId: id.optional(),
    replacesId: id.optional(),
  })
  .refine((x) => !x.expiresAt || x.expiresAt >= x.issuedAt, {
    message: "Expiry must not precede issue date.",
    path: ["expiresAt"],
  });
export const taskSchema = z.object({
  propertyId: id.optional(),
  tenancyId: id.optional(),
  repairId: id.optional(),
  title: z.string().trim().min(3).max(160),
  notes: z.string().max(10000).default(""),
  category: z
    .enum([
      "general",
      "compliance",
      "maintenance",
      "move-in",
      "move-out",
      "inspection",
      "rent",
      "document",
    ])
    .default("general"),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  dueDate: z.iso.date(),
  recurrenceDays: z.number().int().min(1).max(3650).optional(),
  assignedToUserId: id.optional(),
});
export const assetSchema = z.object({
  propertyId: id,
  name: z.string().min(2).max(150),
  category: z.enum(["Boiler", "Appliance", "Roof", "Electrical", "Other"]),
  installedAt: z.iso.date().optional(),
  lastServiceAt: z.iso.date().optional(),
  serviceIntervalMonths: z.number().int().min(1).max(120).default(12),
  warrantyExpiresAt: z.iso.date().optional(),
  replacementAt: z.iso.date().optional(),
  notes: z.string().max(10000).default(""),
});
export const listingSchema = z.object({
  propertyId: id,
  title: z.string().min(3).max(150),
  description: z.string().min(20).max(10000),
  rentPence: pence.positive(),
  depositPence: pence,
  availableAt: z.iso.date(),
  published: z.boolean().default(false),
});
export const inventoryItem = z.object({
  room: z.string().min(1),
  item: z.string().min(1),
  condition: z.enum(["new", "good", "fair", "poor", "damaged"]),
  notes: z.string().max(2000).default(""),
  documentIds: z.array(id).default([]),
});
const checklist = z
  .array(
    z.object({
      label: z.string().min(1),
      completed: z.boolean().default(false),
    }),
  )
  .max(100);
export const operationSchemas = {
  inventories: z.object({
    type: z.enum(["check-in", "check-out", "inspection"]),
    date: z.iso.date(),
    items: z.array(inventoryItem).min(1).max(500),
    meterReadings: z.string().max(2000).default(""),
    keys: z.string().max(2000).default(""),
    tenantComments: z.string().max(5000).default(""),
    acknowledged: z.boolean().default(false),
  }),
  transitions: z.object({
    type: z.enum(["move-in", "move-out"]),
    date: z.iso.date(),
    checklist,
    notes: z.string().max(5000).default(""),
  }),
  improvements: z.object({
    currentRating: z.enum(["A", "B", "C", "D", "E", "F", "G"]),
    targetRating: z.enum(["A", "B", "C", "D", "E", "F", "G"]),
    estimatedCostPence: pence,
    work: z.string().min(5).max(10000),
    funding: z.string().max(2000).default(""),
    completed: z.boolean().default(false),
  }),
  feedback: z.object({
    type: z.enum(["repair", "general", "complaint", "assistance"]),
    repairId: id.optional(),
    rating: z.number().int().min(1).max(5).optional(),
    body: z.string().min(5).max(10000),
    response: z.string().max(10000).default(""),
    responses: z
      .array(
        z.object({
          id: z.string().uuid(),
          body: z.string().min(1).max(5000),
          authorName: z.string().max(120),
          createdAt: z.iso.datetime(),
          status: z.enum([
            "draft",
            "in progress",
            "completed",
            "closed",
            "cancelled",
          ]),
        }),
      )
      .max(100)
      .default([]),
  }),
  passport: z.object({
    source: z.enum(["self-reported", "platform-record"]),
    description: z.string().min(5).max(10000),
    shared: z.boolean().default(false),
    consent: z.boolean().default(false),
  }),
  guarantors: z.object({
    name: z.string().min(2).max(120),
    email: z.email(),
    phone: z.string().max(30),
    notes: z.string().max(2000).default(""),
  }),
  bank: z.object({
    date: z.iso.date(),
    amountPence: z.number().int(),
    reference: z.string().max(250),
    matchedPaymentId: id.optional(),
    matchedExpenseId: id.optional(),
  }),
  anomalyReviews: z.object({
    alertId: id,
    decision: z.enum(["dismissed", "resolved"]),
    notes: z.string().min(3).max(2000),
  }),
  forecasts: z.object({
    monthlyRentPence: pence,
    monthlyExpensePence: pence,
    maintenancePence: pence,
    vacancyPercent: z.number().min(0).max(100),
    valuePence: pence,
    investmentPence: pence,
    growthPercent: z.number().min(-50).max(50),
    years: z.number().int().min(1).max(30),
  }),
};
export type OperationKind = keyof typeof operationSchemas;
