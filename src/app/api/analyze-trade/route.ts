import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.startsWith('your_') || !apiKey.startsWith('sk-ant-')) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  try {
    const { image, mediaType } = await req.json()

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: image,
              },
            },
            {
              type: 'text',
              text: `You are a professional trading chart analyzer. Analyze this trading chart image and extract ALL trade details precisely.

Step 1 — Find the price levels:
- entry_price: the horizontal line or box edge where the trade was entered (look for "Entry", "Open", an arrow, or a dotted line at the start of the trade)
- exit_price: where the trade actually CLOSED — look for the end of the trade line, "Close", "Exit", "TP hit", "SL hit", or where price clearly reverses/ends
- stop_loss: SL line (for reference only)
- take_profit: TP line (for reference only)

Step 2 — Determine direction:
- "long" if price was expected to go UP (TP above entry, or labeled Buy/Long/green)
- "short" if price was expected to go DOWN (TP below entry, or labeled Sell/Short/red)
- If SL is ABOVE entry → "short"; if SL is BELOW entry → "long"

Step 3 — Find the symbol:
- Look for ticker/pair name in chart title or top-left (e.g. MES1!, EURUSD, GOLD, NAS100)
- Strip exchange prefixes (CME:, NASDAQ:, etc.), keep only the symbol itself

Respond ONLY with valid JSON, no markdown, no code blocks:
{"symbol":"MES1","direction":"short","entry_price":6869,"exit_price":6850,"stop_loss":6890,"take_profit":6820,"confidence":88,"analysis":"Brief: what you found and why"}

Rules:
- symbol: uppercase, no spaces, no slashes, no exchange prefix
- direction: exactly "long" or "short"
- all prices: numbers only (no strings, no currency symbols)
- exit_price: null if the chart only shows a planned trade with no clear close price
- confidence: 0-100`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse AI response')
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('AI analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    )
  }
}
