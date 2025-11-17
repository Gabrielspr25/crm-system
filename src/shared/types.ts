import z from "zod";

// Vendor schemas
export const VendorSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().nullable(),
  is_active: z.number().int(), // 0 or 1
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateVendorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
});

export const UpdateVendorSchema = CreateVendorSchema.partial();

export type Vendor = z.infer<typeof VendorSchema>;
export type CreateVendor = z.infer<typeof CreateVendorSchema>;
export type UpdateVendor = z.infer<typeof UpdateVendorSchema>;

// Client schemas
export const ClientSchema = z.object({
  id: z.number(),
  name: z.string(),
  business_name: z.string().nullable(),
  contact_person: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  secondary_phone: z.string().nullable(),
  mobile_phone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  zip_code: z.string().nullable(),
  includes_ban: z.number().int(), // 0 or 1
  vendor_id: z.number().nullable(),
  is_active: z.number().int(), // 0 or 1
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateClientSchema = z.object({
  name: z.string().min(1),
  business_name: z.string().optional(),
  contact_person: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  secondary_phone: z.string().optional(),
  mobile_phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zip_code: z.string().optional(),
  includes_ban: z.boolean().default(false),
  vendor_id: z.number().optional(),
});

export const UpdateClientSchema = CreateClientSchema.partial();

export type Client = z.infer<typeof ClientSchema>;
export type CreateClient = z.infer<typeof CreateClientSchema>;
export type UpdateClient = z.infer<typeof UpdateClientSchema>;

// BAN schemas
export const BANSchema = z.object({
  id: z.number(),
  ban_number: z.string(),
  client_id: z.number(),
  description: z.string().nullable(),
  status: z.enum(['active', 'cancelled']).default('active'),
  is_active: z.number().int(), // 0 or 1
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateBANSchema = z.object({
  ban_number: z.string().length(9).regex(/^\d+$/, "BAN must be 9 digits"),
  client_id: z.number(),
  description: z.string().optional(),
  status: z.enum(['active', 'cancelled']).optional(),
});

export const UpdateBANSchema = CreateBANSchema.partial().omit({ client_id: true });

export type BAN = z.infer<typeof BANSchema>;
export type CreateBAN = z.infer<typeof CreateBANSchema>;
export type UpdateBAN = z.infer<typeof UpdateBANSchema>;

// Subscriber schemas
export const SubscriberSchema = z.object({
  id: z.number(),
  phone: z.string(),
  ban_id: z.number(),
  contract_start_date: z.string().nullable(),
  contract_end_date: z.string().nullable(),
  service_type: z.string().nullable(),
  monthly_value: z.number().nullable(),
  months: z.number().nullable(),
  remaining_payments: z.number().nullable(),
  is_active: z.number().int(), // 0 or 1
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateSubscriberSchema = z.object({
  phone: z.string().min(10).max(10).regex(/^\d+$/, "Phone must be 10 digits"),
  ban_id: z.number(),
  contract_start_date: z.string().optional().nullable(),
  contract_end_date: z.string().optional().nullable(),
  payment_due_date: z.string().optional().nullable(),
  service_type: z.string().min(1, "Service type is required"),
  monthly_value: z.number().positive("Monthly value must be greater than 0"),
  months: z.number().int().positive("Months must be greater than 0"),
  remaining_payments: z.number().int().min(0, "Remaining payments must be 0 or greater").default(0),
});

export const UpdateSubscriberSchema = CreateSubscriberSchema.partial().omit({ ban_id: true });

export type Subscriber = z.infer<typeof SubscriberSchema>;
export type CreateSubscriber = z.infer<typeof CreateSubscriberSchema>;
export type UpdateSubscriber = z.infer<typeof UpdateSubscriberSchema>;

// Follow-up task schemas
export const FollowUpTaskSchema = z.object({
  id: z.number(),
  subscriber_id: z.number(),
  status: z.enum(['prospect', 'current_month', 'negotiating', 'renewed', 'not_renewed']),
  priority_order: z.number(),
  notes: z.string().nullable(),
  expected_value: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateFollowUpTaskSchema = z.object({
  subscriber_id: z.number(),
  status: z.enum(['prospect', 'current_month', 'negotiating', 'renewed', 'not_renewed']).default('prospect'),
  priority_order: z.number().default(0),
  notes: z.string().optional(),
  expected_value: z.number().positive().optional(),
});

export const UpdateFollowUpTaskSchema = CreateFollowUpTaskSchema.partial().omit({ subscriber_id: true });

export type FollowUpTask = z.infer<typeof FollowUpTaskSchema>;
export type CreateFollowUpTask = z.infer<typeof CreateFollowUpTaskSchema>;
export type UpdateFollowUpTask = z.infer<typeof UpdateFollowUpTaskSchema>;

// Extended types for frontend display
export type ClientWithDetails = Client & {
  vendor?: Vendor;
  bans: (BAN & {
    subscribers: Subscriber[];
  })[];
};

export type SubscriberWithDetails = Subscriber & {
  ban: BAN & {
    client: Client & {
      vendor?: Vendor;
    };
  };
  followUpTask?: FollowUpTask;
};
