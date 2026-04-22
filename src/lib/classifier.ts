import Anthropic from '@anthropic-ai/sdk'
import { ClassifierResult, ALL_TAGS } from '@/types'

const client = new Anthropic()

const CLASSIFIER_SYSTEM = `You are a task/event classifier for a personal productivity app called Briefer.
The user will give you a raw thought or note. You must classify it as a task or event and extract structured data.

Tags must come from this exact list: work, personal, errand, family, health, home, social
If the item is clearly an event (has a specific start time, meeting, appointment), classify as "event".
If ambiguous, default to "task" with low confidence.
If you cannot make sense of the input, use type "unclear".
Preserve the original context in notes if it adds meaning beyond the title.`

export async function classifyInput(
  rawInput: string,
  userTimezone: string,
  now: Date = new Date()
): Promise<ClassifierResult> {
  const prompt = `Current date/time: ${now.toISOString()} (timezone: ${userTimezone})
User's raw input: "${rawInput}"

Classify this and return a JSON object with exactly these fields:
{
  "type": "task" | "event" | "unclear",
  "title": "cleaned-up short version of the input",
  "datetime": "ISO 8601 with offset" | null,
  "datetime_confidence": "explicit" | "inferred" | "none",
  "duration_minutes": number | null,
  "tags": ["tag1"],
  "location": "string" | null,
  "notes": "original context if relevant" | null,
  "classifier_confidence": 0.0-1.0,
  "needs_review": false
}

Rules:
- needs_review must be true if classifier_confidence < 0.7
- For events without explicit duration, use 60 minutes as default
- "explicit" confidence = input had a specific time; "inferred" = derived from context; "none" = no date at all
- Tags: pick 1-2 most relevant from: ${ALL_TAGS.join(', ')}
- If type is "unclear", set classifier_confidence to 0.3 and needs_review to true`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: CLASSIFIER_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Classifier returned no JSON')

  const result = JSON.parse(jsonMatch[0]) as ClassifierResult
  // Enforce needs_review rule regardless of model output
  if (result.classifier_confidence < 0.7) result.needs_review = true
  return result
}
