import { z } from "zod";

export const sendWahTextIntegrationSchema = z.object({
  empresa_id: z.string().uuid(),
  account_id: z.string().uuid(),
  to: z.string().min(8),
  text: z.string().min(1),
  contact_name: z.string().optional(),
  conversation_id: z.string().uuid().optional(),
  external_id: z.string().optional(),
});

export const sendWahAudioIntegrationSchema = z.object({
  empresa_id: z.string().uuid(),
  account_id: z.string().uuid(),
  to: z.string().min(8),
  audio_url: z.string().url(),
  filename: z.string().optional(),
  contact_name: z.string().optional(),
  conversation_id: z.string().uuid().optional(),
});

export const sendWahFileIntegrationSchema = z.object({
  empresa_id: z.string().uuid(),
  account_id: z.string().uuid(),
  to: z.string().min(8),
  file_url: z.string().url(),
  filename: z.string().min(1),
  caption: z.string().optional(),
  contact_name: z.string().optional(),
  conversation_id: z.string().uuid().optional(),
});

export const sendWahPanelMessageSchema = z.object({
  body: z.string().min(1),
  generatedByAi: z.boolean().optional(),
});

export type SendWahTextIntegrationInput = z.infer<typeof sendWahTextIntegrationSchema>;
export type SendWahAudioIntegrationInput = z.infer<typeof sendWahAudioIntegrationSchema>;
export type SendWahFileIntegrationInput = z.infer<typeof sendWahFileIntegrationSchema>;
export type SendWahPanelMessageInput = z.infer<typeof sendWahPanelMessageSchema>;
