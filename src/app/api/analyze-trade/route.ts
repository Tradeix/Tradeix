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
              text: `You are a professional trading chart analyzer. Analyze this trading chart image and extract the trade details precisely.

Step 1 — Find the price levels:
- Entry price: the horizontal line or box edge marking the trade entry
- Stop Loss (SL): the line above or below entry where the trade is invalidated
- Take Profit (TP): the target line where profit is taken

Step 2 — Determine direction using price math (most reliable method):
- If Take Profit price > Entry price → direction is "long" (price expected to go UP)
- If Take Profit price < Entry price → direction is "short" (price expected to go DOWN)
- Also check: red/orange coloring or "Short"/"Sell" labels = short; green coloring or "Long"/"Buy" labels = long
- Also check: if Stop Loss is ABOVE entry → direction is "short"; if SL is BELOW entry → direction is "long"

Step 3 — Find the symbol:
- Look for the ticker/pair name in the chart title or top-left area (e.g. MES1, EURUSD, GOLD, NAS100)

Respond ONLY with valid JSON, no markdown, no code blocks, no other text:
{"symbol":"MES1","direction":"short","entry_price":6834,"stop_loss":6855,"take_profit":6790,"confidence":90,"analysis":"brief explanation of what you found and why you chose this direction"}

Rules:
- symbol: uppercase, no spaces or slashes
- direction: exactly "long" or "short" — use price math to decide, not just visual style
- prices: numbers only, no strings
- If a value cannot be found, use null
- confidence: 0-100 based on how clearly the levels are visible`,
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
