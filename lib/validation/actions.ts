/** Server Action input schemas, composed from the per-step schemas. */
import { z } from "zod";
import {
  AttributionSchema,
  ContactSchema,
  CustomJobSchema,
  EmailSchema,
  LocationSchema,
  PhoneSchema,
  SelectionSchema,
  VehicleDetailsSchema,
} from "./booking";

const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Invalid link");

export const HoldRequestSchema = z.object({
  idempotencyKey: z.uuid(),
  sessionId: z.uuid(),
  selection: SelectionSchema,
  vehicle: VehicleDetailsSchema,
  location: LocationSchema,
  slotStart: z.iso.datetime({ offset: true }),
  quoteToken: token.nullable().optional(),
  attribution: AttributionSchema,
});

export const TokenSchema = z.object({ token });

export const ContactActionSchema = z.object({
  token,
  sessionId: z.uuid(),
  contact: ContactSchema,
  captchaToken: z.string().max(4096).optional(),
});

export const StartPaymentSchema = z.object({
  token,
  sessionId: z.uuid(),
  agreePolicy: z.literal(true, "Please agree to the cancellation policy to continue"),
  promoCode: z
    .string()
    .trim()
    .max(32)
    .regex(/^[A-Za-z0-9_-]*$/)
    .optional()
    .transform((v) => (v ? v : undefined)),
  expectedTotalCents: z.number().int().min(0),
});

export const PromoPreviewSchema = z.object({ token, promoCode: z.string().trim().min(1).max(32) });

export const QuoteSubmissionSchema = z.object({
  submissionId: z.uuid(),
  sessionId: z.uuid(),
  uploadSessionId: z.uuid(),
  vehicle: VehicleDetailsSchema.extend({ sizeId: z.string().max(64).nullable().optional() }),
  job: CustomJobSchema,
  location: LocationSchema,
  contact: ContactSchema,
  captchaToken: z.string().max(4096).optional(),
  attribution: AttributionSchema,
});

export const SignUploadSchema = z.object({
  uploadSessionId: z.uuid(),
  contentType: z.string().max(40),
  size: z.number().int().positive(),
});

export const ConfirmUploadSchema = z.object({ uploadSessionId: z.uuid(), photoId: z.uuid() });

export const ContactFormSchema = z.object({
  submissionId: z.uuid(),
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: EmailSchema,
  phone: z.union([PhoneSchema, z.literal("").transform(() => undefined)]).optional(),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(3000),
  website: z.string().max(0).optional(),
  captchaToken: z.string().max(4096).optional(),
  attribution: AttributionSchema,
});

export const ExitOfferSchema = z.object({
  submissionId: z.uuid(),
  email: EmailSchema,
  attribution: AttributionSchema,
});

export const RescheduleSchema = z.object({ token, slotStart: z.iso.datetime({ offset: true }) });
export const CancelSchema = z.object({ token, reason: z.string().trim().max(500).optional() });
