import Anthropic from '@anthropic-ai/sdk'
import { Item } from '@/types'
import { format, isToday, isPast } from 'date-fns'

const client = new Anthropic()

interface BriefInput {
  userName: string
  timezone: string
  todayEvents: Item[]
  todayTasks: Item[]
  overdueTasks: Item[]
  inboxCount: number
  upcomingItems: Item[]
  dayOfWeek: string
}

function itemLine(item: Item): string {
  const time = item.due_at ? format(new Date(item.due_at), 'h:mm a') : ''
  return `- ${item.title}${time ? ` at ${time}` : ''}${item.location ? ` @ ${item.location}` : ''}`
}

export async function generateMorningBrief(input: BriefInput): Promise<{ subject: string; body: string }> {
  const { userName, todayEvents, todayTasks, overdueTasks, inboxCount, upcomingItems, dayOfWeek } = input
  const isWeekend = ['Saturday', 'Sunday'].includes(dayOfWeek)

  const contextBlock = [
    `User: ${userName}`,
    `Day: ${dayOfWeek}`,
    todayEvents.length ? `Today's events:\n${todayEvents.map(itemLine).join('\n')}` : null,
    todayTasks.length ? `Today's tasks:\n${todayTasks.map(itemLine).join('\n')}` : null,
    overdueTasks.length ? `Overdue (${overdueTasks.length} items):\n${overdueTasks.map(i => `- ${i.title} (${Math.round((Date.now() - new Date(i.due_at!).getTime()) / 86400000)}d overdue)`).join('\n')}` : null,
    inboxCount > 5 ? `Inbox: ${inboxCount} uncaptured items waiting for dates` : null,
    upcomingItems.length ? `Coming up (next 3 days):\n${upcomingItems.map(itemLine).join('\n')}` : null,
  ].filter(Boolean).join('\n\n')

  const prompt = `Write a morning brief for ${userName}.

${contextBlock}

Instructions:
- Write 2-4 sentences (up to 6 if very dense schedule)
- Lead with the most important thing, not the first chronological thing
- ${isWeekend ? 'It\'s the weekend — keep the tone lighter, less work-focused' : 'Weekday tone: clear and professional but warm'}
- If there are overdue items, acknowledge them without scolding
- Skip trivial observations (don't say "you have 0 events")
- If the day is completely empty, write a single sentence acknowledging that
- Also write a short subject line (under 60 chars) — e.g. "Rivera at 10, clear afternoon"

Respond with JSON: { "subject": "...", "body": "..." }`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Brief generation returned no JSON')
  return JSON.parse(jsonMatch[0])
}

export function generateFallbackBrief(input: BriefInput): { subject: string; body: string } {
  const { todayEvents, todayTasks, overdueTasks } = input
  const total = todayEvents.length + todayTasks.length
  const subject = total
    ? `${total} item${total > 1 ? 's' : ''} today${overdueTasks.length ? `, ${overdueTasks.length} overdue` : ''}`
    : 'Clear day ahead'

  const lines: string[] = []
  if (todayEvents.length) lines.push(`Events: ${todayEvents.map(e => e.title).join(', ')}`)
  if (todayTasks.length) lines.push(`Tasks: ${todayTasks.map(t => t.title).join(', ')}`)
  if (overdueTasks.length) lines.push(`Overdue: ${overdueTasks.map(t => t.title).join(', ')}`)
  const body = lines.length ? lines.join('\n') : 'Nothing scheduled today.'

  return { subject, body }
}
