export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "money"
    | "date"
    | "select"
    | "multi"
    | "checkbox"
    | "email";
  required?: boolean;
  options?: string[];
  source?:
    | "properties"
    | "tenants"
    | "tenancies"
    | "units"
    | "repairs"
    | "documents"
    | "compliance";
  default?: string | number | boolean;
  hint?: string;
};
export type Module = {
  title: string;
  description: string;
  singular: string;
  permission: string;
  fields: Field[];
  columns: string[];
  tenantCreate?: boolean;
};
const property: Field = {
  name: "propertyId",
  label: "Property",
  type: "select",
  source: "properties",
  required: true,
};
const tenancy: Field = {
  name: "tenancyId",
  label: "Tenancy",
  type: "select",
  source: "tenancies",
  required: true,
};
export const modules: Record<string, Module> = {
  properties: {
    title: "Properties",
    singular: "property",
    description: "Your portfolio, at a glance.",
    permission: "properties",
    columns: ["name", "address", "type", "occupancy", "rent"],
    fields: [
      { name: "name", label: "Property name", required: true },
      { name: "address", label: "Address", required: true },
      { name: "postcode", label: "Postcode", required: true },
      {
        name: "type",
        label: "Property type",
        type: "select",
        options: [
          "house",
          "flat",
          "apartment",
          "HMO",
          "student",
          "multi-unit",
          "commercial",
        ],
      },
      {
        name: "jurisdiction",
        label: "Jurisdiction",
        type: "select",
        options: ["England", "Wales", "Scotland", "Northern Ireland"],
      },
      { name: "bedrooms", label: "Bedrooms", type: "number", default: 0 },
      { name: "bathrooms", label: "Bathrooms", type: "number", default: 0 },
      {
        name: "furnishing",
        label: "Furnishing",
        type: "select",
        options: ["unfurnished", "part furnished", "furnished"],
      },
      {
        name: "epcRating",
        label: "EPC rating",
        type: "select",
        options: ["A", "B", "C", "D", "E", "F", "G"],
      },
      { name: "valuePence", label: "Estimated value", type: "money" },
      { name: "purchasePricePence", label: "Purchase price", type: "money" },
      { name: "notes", label: "Internal notes", type: "textarea" },
    ],
  },
  tenants: {
    title: "Tenants",
    singular: "tenant",
    description: "People, tenancies and secure portal access.",
    permission: "tenants",
    columns: ["name", "email", "phone", "portal"],
    fields: [
      { name: "name", label: "Full name", required: true },
      { name: "email", label: "Email address", type: "email", required: true },
      { name: "phone", label: "Telephone" },
    ],
  },
  tenancies: {
    title: "Tenancies",
    singular: "tenancy",
    description: "Manage occupancy without losing the history.",
    permission: "tenancies",
    columns: [
      "reference",
      "property",
      "participants",
      "rentPence",
      "startDate",
      "status",
    ],
    fields: [
      property,
      {
        name: "unitId",
        label: "Room / unit (optional)",
        type: "select",
        source: "units",
      },
      {
        name: "tenantIds",
        label: "Tenants",
        type: "multi",
        source: "tenants",
        required: true,
      },
      { name: "reference", label: "Tenancy reference", required: true },
      { name: "startDate", label: "Start date", type: "date", required: true },
      { name: "endDate", label: "End date (if applicable)", type: "date" },
      {
        name: "rentPence",
        label: "Rent amount",
        type: "money",
        required: true,
      },
      {
        name: "frequency",
        label: "Frequency",
        type: "select",
        options: ["monthly", "weekly", "fortnightly", "quarterly", "annual"],
      },
      {
        name: "dueDay",
        label: "Payment day of month",
        type: "number",
        default: 1,
      },
      {
        name: "depositPence",
        label: "Deposit amount",
        type: "money",
        default: 0,
      },
    ],
  },
  repairs: {
    title: "Repairs & maintenance",
    singular: "repair",
    description: "From the first report to the final resolution.",
    permission: "repairs",
    tenantCreate: true,
    columns: [
      "reference",
      "title",
      "property",
      "priority",
      "status",
      "visibility",
      "createdAt",
    ],
    fields: [
      property,
      {
        name: "unitId",
        label: "Room / unit (leave blank for common areas)",
        type: "select",
        source: "units",
      },
      { name: "title", label: "Short title", required: true },
      {
        name: "description",
        label: "Describe the problem",
        type: "textarea",
        required: true,
      },
      {
        name: "category",
        label: "Category",
        type: "select",
        options: [
          "Plumbing",
          "Heating",
          "Hot water",
          "Electrical",
          "Kitchen appliances",
          "Bathroom",
          "Doors and windows",
          "Roof and gutters",
          "Damp and mould",
          "Pest control",
          "Structural issues",
          "Communal areas",
          "General maintenance",
          "Other",
        ],
      },
      {
        name: "priority",
        label: "Urgency",
        type: "select",
        options: ["normal", "low", "high", "emergency"],
      },
      {
        name: "issueStartedAt",
        label: "When did the issue start?",
        type: "date",
      },
      {
        name: "ongoing",
        label: "The issue is ongoing",
        type: "checkbox",
        default: true,
      },
    ],
  },
  rent: {
    title: "Rent & payments",
    singular: "charge",
    description: "A clear ledger of obligations, allocations and balances.",
    permission: "rent",
    columns: [
      "description",
      "tenancy",
      "dueDate",
      "amountPence",
      "balancePence",
      "status",
    ],
    fields: [
      tenancy,
      {
        name: "description",
        label: "Charge description",
        required: true,
        hint: "Only record additional charges where lawful and applicable.",
      },
      { name: "amountPence", label: "Amount", type: "money", required: true },
      { name: "dueDate", label: "Due date", type: "date", required: true },
    ],
  },
  payments: {
    title: "Payment history",
    singular: "payment",
    description: "Record bank transfers, cash and other manual payments.",
    permission: "rent",
    columns: ["reference", "tenancy", "paidAt", "amountPence", "method"],
    fields: [
      tenancy,
      {
        name: "amountPence",
        label: "Amount received",
        type: "money",
        required: true,
      },
      { name: "paidAt", label: "Payment date", type: "date", required: true },
      { name: "reference", label: "Bank / receipt reference", required: true },
      {
        name: "method",
        label: "Payment method",
        type: "select",
        options: ["bank transfer", "cash", "cheque", "other"],
      },
    ],
  },
  expenses: {
    title: "Accounting & expenses",
    singular: "expense",
    description: "Keep property costs and reconciliation records together.",
    permission: "finance",
    columns: [
      "description",
      "property",
      "category",
      "supplier",
      "incurredAt",
      "amountPence",
      "reconciled",
    ],
    fields: [
      property,
      {
        name: "category",
        label: "Category",
        type: "select",
        options: [
          "Repairs",
          "Mortgage",
          "Insurance",
          "Service charge",
          "Management fee",
          "Utilities",
          "Licensing",
          "Other",
        ],
      },
      { name: "description", label: "Description", required: true },
      { name: "amountPence", label: "Amount", type: "money", required: true },
      {
        name: "incurredAt",
        label: "Expense date",
        type: "date",
        required: true,
      },
      { name: "supplier", label: "Supplier (text only)" },
      { name: "invoiceReference", label: "Invoice reference" },
      {
        name: "repairId",
        label: "Linked repair",
        type: "select",
        source: "repairs",
      },
    ],
  },
  compliance: {
    title: "Compliance",
    singular: "compliance record",
    description: "Certificates, evidence and upcoming renewals.",
    permission: "compliance",
    columns: [
      "title",
      "property",
      "category",
      "issuedAt",
      "expiresAt",
      "status",
    ],
    fields: [
      property,
      { name: "title", label: "Certificate / record name", required: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        options: [
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
        ],
      },
      {
        name: "issuedAt",
        label: "Issue / check date",
        type: "date",
        required: true,
      },
      { name: "expiresAt", label: "Expiry date", type: "date" },
      { name: "reference", label: "Certificate reference" },
      { name: "notes", label: "Notes", type: "textarea" },
      {
        name: "documentId",
        label: "Certificate document",
        type: "select",
        source: "documents",
      },
      {
        name: "replacesId",
        label: "Replaces a previous record (optional)",
        type: "select",
        source: "compliance",
      },
    ],
  },
  tasks: {
    title: "Tasks & calendar",
    singular: "task",
    description: "Keep deadlines and recurring work under control.",
    permission: "tasks",
    columns: ["title", "property", "category", "dueDate", "priority", "status"],
    fields: [
      { ...property, required: false },
      { name: "title", label: "Task name", required: true },
      { name: "dueDate", label: "Due date", type: "date", required: true },
      {
        name: "priority",
        label: "Priority",
        type: "select",
        options: ["normal", "low", "high"],
      },
      {
        name: "category",
        label: "Category",
        type: "select",
        options: [
          "general",
          "compliance",
          "maintenance",
          "move-in",
          "move-out",
          "inspection",
          "rent",
          "document",
        ],
      },
      { name: "recurrenceDays", label: "Repeat every (days)", type: "number" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  assets: {
    title: "Property health",
    singular: "asset",
    description: "Track servicing, warranties and expected replacements.",
    permission: "operations",
    columns: [
      "name",
      "property",
      "category",
      "installedAt",
      "lastServiceAt",
      "replacementAt",
    ],
    fields: [
      property,
      { name: "name", label: "Asset name", required: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        options: ["Boiler", "Appliance", "Roof", "Electrical", "Other"],
      },
      { name: "installedAt", label: "Installed on", type: "date" },
      { name: "lastServiceAt", label: "Last service", type: "date" },
      {
        name: "serviceIntervalMonths",
        label: "Service interval (months)",
        type: "number",
        default: 12,
      },
      { name: "warrantyExpiresAt", label: "Warranty expiry", type: "date" },
      { name: "replacementAt", label: "Planned replacement", type: "date" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  listings: {
    title: "Lettings & applications",
    singular: "listing",
    description: "Publish a listing, receive enquiries and manage applicants.",
    permission: "lettings",
    columns: ["title", "property", "rentPence", "availableAt", "published"],
    fields: [
      property,
      { name: "title", label: "Listing title", required: true },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        required: true,
      },
      {
        name: "rentPence",
        label: "Advertised rent (per month)",
        type: "money",
        required: true,
      },
      { name: "depositPence", label: "Deposit", type: "money", required: true },
      {
        name: "availableAt",
        label: "Available from",
        type: "date",
        required: true,
      },
      {
        name: "published",
        label: "Publish to the platform listing page",
        type: "checkbox",
        default: false,
      },
    ],
  },
  applications: {
    title: "Applications",
    singular: "application",
    description: "Record viewings, reviews and application decisions.",
    permission: "lettings",
    columns: [
      "name",
      "email",
      "listing",
      "status",
      "referencingStatus",
      "createdAt",
    ],
    fields: [],
  },
  documents: {
    title: "Documents",
    singular: "document",
    description: "Private storage. Explicit sharing. A clear evidence trail.",
    permission: "documents",
    columns: [
      "name",
      "property",
      "category",
      "size",
      "visibility",
      "createdAt",
    ],
    fields: [],
  },
  messages: {
    title: "Messages",
    singular: "conversation",
    description: "Keep tenancy conversations in one secure place.",
    permission: "messages",
    tenantCreate: true,
    columns: ["subject", "tenancy", "createdAt"],
    fields: [
      tenancy,
      { name: "subject", label: "Subject", required: true },
      {
        name: "tenantIds",
        label: "Tenant recipients",
        type: "multi",
        source: "tenants",
      },
      { name: "body", label: "Message", type: "textarea", required: true },
    ],
  },
  deposits: {
    title: "Deposits",
    singular: "deposit",
    description: "Scheme records, proposed deductions and return progress.",
    permission: "tenancies",
    columns: [
      "tenancy",
      "amountPence",
      "scheme",
      "reference",
      "status",
      "returnedPence",
    ],
    fields: [],
  },
  inventories: {
    title: "Inventories & inspections",
    singular: "inventory",
    description: "Capture condition and compare evidence with human review.",
    permission: "operations",
    columns: ["title", "property", "status", "createdAt"],
    fields: [
      property,
      { ...tenancy, required: false },
      { name: "title", label: "Report title", required: true },
    ],
  },
  transitions: {
    title: "Move-in & move-out",
    singular: "workflow",
    description: "Configurable checklists for a smooth tenancy transition.",
    permission: "operations",
    columns: ["title", "property", "status", "createdAt"],
    fields: [
      property,
      tenancy,
      { name: "title", label: "Workflow title", required: true },
    ],
  },
  improvements: {
    title: "EPC & improvements",
    singular: "improvement plan",
    description:
      "Plan upgrades and record costs. Estimates are not EPC assessments.",
    permission: "operations",
    columns: ["title", "property", "status", "createdAt"],
    fields: [property, { name: "title", label: "Plan title", required: true }],
  },
  feedback: {
    title: "Feedback & requests",
    singular: "feedback",
    description: "Private feedback, complaints and assistance requests.",
    permission: "operations",
    tenantCreate: true,
    columns: ["title", "property", "status", "createdAt"],
    fields: [
      { ...property, required: false },
      { name: "title", label: "Subject", required: true },
    ],
  },
  passport: {
    title: "Rental passport",
    singular: "profile entry",
    description: "Your rental history, with sharing controlled by you.",
    permission: "operations",
    tenantCreate: true,
    columns: ["title", "status", "createdAt"],
    fields: [{ name: "title", label: "Entry title", required: true }],
  },
  bank: {
    title: "Bank reconciliation",
    singular: "bank transaction",
    description: "Import or record statement entries and match your ledger.",
    permission: "finance",
    columns: ["title", "property", "status", "createdAt"],
    fields: [
      { ...property, required: false },
      { name: "title", label: "Transaction title", required: true },
    ],
  },
  forecasts: {
    title: "Forecasting & investments",
    singular: "forecast",
    description:
      "Explore cash flow and yield using clearly stated assumptions.",
    permission: "finance",
    columns: ["title", "property", "createdAt"],
    fields: [
      { ...property, required: false },
      { name: "title", label: "Scenario name", required: true },
    ],
  },
  guarantors: {
    title: "Guarantors",
    singular: "guarantor",
    description: "Private supporting tenancy records.",
    permission: "operations",
    columns: ["title", "property", "createdAt"],
    fields: [
      property,
      tenancy,
      { name: "title", label: "Reference", required: true },
    ],
  },
};
