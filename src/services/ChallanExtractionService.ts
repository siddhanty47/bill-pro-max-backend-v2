/**
 * @file Challan Extraction Service
 * @description Uses Claude Vision API to extract structured challan data from
 * photographs of handwritten challan books. Supports two formats:
 * - Pre-printed items list (marked/ticked items)
 * - Blank table (manually written items)
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { anthropicConfig } from '../config';
import { ValidationError } from '../middleware';
import { logger } from '../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExtractionContext {
  parties: { id: string; name: string; sites: { name: string; code: string }[] }[];
  inventoryItems: { id: string; name: string }[];
  agreements: { id: string; partyId: string; siteCode: string; status: string }[];
}

export interface ExtractedChallanItem {
  itemName: string;
  itemId: string | null;
  quantity: number;
}

export interface ExtractedChallanData {
  type: 'delivery' | 'return';
  challanNumber: string | null;
  date: string | null;
  partyName: string | null;
  partyId: string | null;
  siteName: string | null;
  items: ExtractedChallanItem[];
  transporterName: string | null;
  vehicleNumber: string | null;
  cartageAmount: number | null;
  damagedItems: ExtractedChallanItem[];
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

// ─── Zod schema for response validation ──────────────────────────────────────

const extractedItemSchema = z.object({
  itemName: z.string(),
  itemId: z.string().nullable(),
  quantity: z.number().int().min(1),
});

const extractedChallanSchema = z.object({
  type: z.enum(['delivery', 'return']),
  challanNumber: z.string().nullable(),
  date: z.string().nullable(),
  partyName: z.string().nullable(),
  partyId: z.string().nullable(),
  siteName: z.string().nullable(),
  items: z.array(extractedItemSchema),
  transporterName: z.string().nullable(),
  vehicleNumber: z.string().nullable(),
  cartageAmount: z.number().nullable(),
  damagedItems: z.array(extractedItemSchema),
  confidence: z.enum(['high', 'medium', 'low']),
  warnings: z.array(z.string()),
});

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert at reading handwritten Indian scaffolding/equipment rental challans (delivery notes and return receipts). Your job is to extract structured data from a photographed challan page.

## Challan Format Types

There are TWO common challan formats you will encounter:

### Format A: Pre-printed Items List
- The challan has ALL inventory items pre-printed in rows (e.g., Planks, Palloos, Golas, Steel Plate, Steel Props, etc.)
- The user MARKS only the items that are part of this challan by:
  - Ticking/checkmarking the item
  - Underlining the item name
  - Drawing an arrow from item to quantity
  - Writing a quantity number next to the item in the "Total Nug" or quantity column
  - Circling the item
- Items WITHOUT any mark, tick, quantity, or annotation should be IGNORED — they are just pre-printed blanks
- Some items have size variants printed (e.g., "Steel Props 2x2m, 2x3m, 3x3m"). If a specific size is marked, include the size in the item name
- Look for "Return Book" or "Receive" in the header — this indicates a RETURN challan

### Format B: Blank Table (Manually Written Items)
- The challan has an empty table with columns like "S.No.", "Description of Goods", "Qty/Unit"
- Items are written by hand in the rows
- ALL written items should be included in the extraction
- Look for "Outward/Delivery" or "Dispatch" in the header — this indicates a DELIVERY challan

## What to Extract

1. **type**: Determine if this is "delivery" or "return" from:
   - Header text: "Outward", "Delivery", "Dispatch" → delivery
   - Header text: "Return", "Receive", "Inward" → return
   - If unclear, default to "delivery"

2. **challanNumber**: Look for "No.", "Challan No.", "Book No." — usually top area. Extract the number as-is.

3. **date**: Look for "Date" field — usually top right. Parse to YYYY-MM-DD format. Handle Indian formats (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY). If only partial date or unclear, extract what you can.

4. **partyName**: Look for "M/s", "Dispatch To M/s", "To" — the party/customer name. Extract the raw handwritten name exactly as written.

5. **siteName**: Look for "Site Add.", "Site", "Village", or the line below/next to party name. This is the construction site location. Extract as-is.

6. **items**: Extract ONLY marked/written items:
   - For Format A (pre-printed): only items with a tick, mark, quantity, or any handwritten annotation
   - For Format B (blank table): all handwritten item rows
   - Each item needs: name (string) and quantity (number)
   - If quantity is illegible, set to 1 and add a warning
   - Include size/variant in the item name if specified (e.g., "Steel Props 2x3m", "Steel Plate 3x1.5 Fit")

7. **transporterName**: Look for "Transporter Name", "Mode of Transportation", or similar at the bottom

8. **vehicleNumber**: Look for "Vehicle No.", "GR No.", or a vehicle registration number pattern

9. **cartageAmount**: Look for "Cartage", "Cartage Rs." — a number representing transport charges

10. **breakage/damage**: Look for "Breakage", "Damage", or a damage section. Only relevant for return challans. Extract item names, quantities, and any damage notes.

## Matching Rules

You will receive lists of known parties and inventory items from the business database. Use these for fuzzy matching:

- Match the handwritten party name against the provided parties list. Use the closest match. Set partyId if confident (>80% match). Keep partyName as the raw handwritten text regardless.
- Match each item name against the provided inventory items list. Use the closest match. Set itemId if confident. Common abbreviations: "S. Plate" = "Steel Plate", "Prop" = "Steel Props", "Challis" = "Steel Challis", etc.
- If a party has sites listed, try to match the siteName against them.

## Output Format

Return ONLY valid JSON (no markdown, no code fences, no explanation):

{
  "type": "delivery" | "return",
  "challanNumber": string | null,
  "date": "YYYY-MM-DD" | null,
  "partyName": string | null,
  "partyId": "matched_id" | null,
  "siteName": string | null,
  "items": [
    { "itemName": "exact text from challan", "itemId": "matched_id" | null, "quantity": number }
  ],
  "transporterName": string | null,
  "vehicleNumber": string | null,
  "cartageAmount": number | null,
  "damagedItems": [
    { "itemName": string, "itemId": "matched_id" | null, "quantity": number }
  ],
  "confidence": "high" | "medium" | "low",
  "warnings": ["description of any issues encountered"]
}

## Important Rules
- If a field is not found or illegible, set it to null. Do NOT guess.
- Only include items that are clearly marked/written. When in doubt, skip the item and add a warning.
- The "confidence" field reflects overall extraction quality: "high" = clear photo, most fields readable; "medium" = some fields unclear; "low" = poor photo quality, many guesses.
- Add a warning for each: unmatched party, unmatched item, illegible quantity, unclear date, or any ambiguity.
- Quantities are always positive integers (number of pieces/units, called "Nug" or "Nos").
- Never fabricate data. If you cannot read something, say so in warnings.`;

// ─── Service ─────────────────────────────────────────────────────────────────

export class ChallanExtractionService {
  private client: Anthropic;
  private model: string;

  constructor() {
    if (!anthropicConfig.apiKey) {
      logger.warn('Anthropic API key not configured — challan photo extraction will be unavailable');
    }
    this.client = new Anthropic({ apiKey: anthropicConfig.apiKey || 'not-configured' });
    this.model = anthropicConfig.model;
  }

  async extractFromPhoto(
    imageBuffer: Buffer,
    mimeType: string,
    context: ExtractionContext
  ): Promise<ExtractedChallanData> {
    if (!anthropicConfig.apiKey) {
      throw new ValidationError('Anthropic API key is not configured. Please set ANTHROPIC_API_KEY in environment variables.');
    }

    const base64Image = imageBuffer.toString('base64');

    const userMessage = this.buildUserMessage(context);

    const base64Length = base64Image.length;
    const userMessageLength = userMessage.length;

    logger.info('Calling Claude Vision API for challan extraction', {
      model: this.model,
      imageSize: imageBuffer.length,
      base64Length,
      mimeType,
      userMessageLength,
      partiesCount: context.parties.length,
      itemsCount: context.inventoryItems.length,
      agreementsCount: context.agreements.length,
    });

    try {
      const requestPayload = {
        model: this.model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user' as const,
            content: [
              {
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
                  data: base64Image,
                },
              },
              {
                type: 'text' as const,
                text: userMessage,
              },
            ],
          },
        ],
      };

      logger.info('Sending request to Anthropic API', {
        model: requestPayload.model,
        maxTokens: requestPayload.max_tokens,
        systemPromptLength: SYSTEM_PROMPT.length,
        messageContentBlocks: requestPayload.messages[0].content.length,
      });

      const response = await this.client.messages.create(requestPayload);

      logger.info('Claude Vision API raw response metadata', {
        id: response.id,
        model: response.model,
        stopReason: response.stop_reason,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        contentBlocks: response.content.length,
        contentTypes: response.content.map((b) => b.type),
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        logger.error('Claude returned no text content', {
          contentBlocks: response.content.map((b) => b.type),
          stopReason: response.stop_reason,
        });
        throw new ValidationError('Claude returned an empty response. Please try with a clearer photo.');
      }

      const rawJson = textBlock.text.trim();

      logger.info('Claude Vision API response text', {
        responseLength: rawJson.length,
        responsePreview: rawJson.substring(0, 1000),
        stopReason: response.stop_reason,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });

      const parsed = this.parseAndValidate(rawJson);

      logger.info('Challan extraction successful', {
        type: parsed.type,
        partyId: parsed.partyId,
        partyName: parsed.partyName,
        itemsCount: parsed.items.length,
        confidence: parsed.confidence,
        warningsCount: parsed.warnings.length,
        warnings: parsed.warnings,
      });

      return parsed;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      // Log the full error details for debugging
      const errorDetails: Record<string, unknown> = {
        errorType: error?.constructor?.name,
        message: error instanceof Error ? error.message : 'Unknown error',
      };

      // Anthropic SDK errors have additional properties
      if (error && typeof error === 'object') {
        if ('status' in error) errorDetails.httpStatus = (error as { status: number }).status;
        if ('error' in error) errorDetails.apiError = (error as { error: unknown }).error;
        if ('headers' in error) {
          const headers = (error as { headers: Record<string, string> }).headers;
          errorDetails.requestId = headers?.['request-id'] || headers?.['x-request-id'];
        }
      }

      logger.error('Claude Vision API call failed', errorDetails);

      throw new ValidationError(
        `Failed to extract challan data from the photo. Error: ${errorDetails.message}`
      );
    }
  }

  private buildUserMessage(context: ExtractionContext): string {
    const partiesList = context.parties.map((p) => ({
      id: p.id,
      name: p.name,
      sites: p.sites.map((s) => s.name),
    }));

    const itemsList = context.inventoryItems.map((i) => ({
      id: i.id,
      name: i.name,
    }));

    return `Extract challan data from the attached photo.

Match extracted names against these known lists from the business database:

## Known Parties
${JSON.stringify(partiesList)}

## Known Inventory Items
${JSON.stringify(itemsList)}

Return ONLY the JSON object as specified in your instructions.`;
  }

  private parseAndValidate(rawJson: string): ExtractedChallanData {
    let cleaned = rawJson;

    // Strip markdown code fences if present
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      logger.error('Failed to parse Claude response as JSON', { rawJson: rawJson.substring(0, 500) });
      throw new ValidationError('Could not parse the extraction result. Please try with a clearer photo.');
    }

    const result = extractedChallanSchema.safeParse(parsed);
    if (!result.success) {
      logger.error('Claude response failed schema validation', {
        errors: result.error.issues,
        rawJson: rawJson.substring(0, 500),
      });
      throw new ValidationError('Extraction returned unexpected data format. Please try again.');
    }

    return result.data;
  }
}
