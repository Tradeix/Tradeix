import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key') {
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
              text: `You are a professional trading chart analyzer. Analyze this trading chart image and extract the trade details.

Look for:
1. The trading symbol/pair (e.g. EURUSD, BTCUSDT, GOLD, NAS100, ES) — no slashes
2. Trade direction: "long" if it's a buy/long setup, "short" if it's a sell/short setup
3. Entry price level (where the trade entry is marked)
4. Stop Loss price level (SL line)
5. Take Profit price level (TP line)

Respond ONLY with valid JSON, no markdown, no code blocks, no other text:
{"symbol":"EURUSD","direction":"long","entry_price":1.0842,"stop_loss":1.0800,"take_profit":1.0940,"confidence":92,"analysis":"brief explanation"}

Rules:
- symbol: uppercase, no spaces or slashes (EURUSD not EUR/USD)
- direction: exactly "long" or "short"
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
