import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { image, mediaType } = await req.json()

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
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
1. The trading symbol/pair (e.g. EUR/USD, BTC/USDT, GOLD, NAS100)
2. Trade direction (long/buy or short/sell) based on the trade setup shown
3. Entry price level (where the trade entry is marked)
4. Stop Loss price level (SL line)
5. Take Profit price level (TP line)

Respond ONLY with valid JSON, no other text:
{
  "symbol": "EUR/USD",
  "direction": "long",
  "entry_price": 1.0842,
  "stop_loss": 1.0800,
  "take_profit": 1.0940,
  "confidence": 92,
  "analysis": "brief explanation of what you found"
}

If you cannot identify a value, use null for that field.
For confidence, use 0-100 based on how clearly the levels are visible.`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
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
