import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// System prompt is large + stable. cache_control is set below so repeated
// analyses hit the prompt cache (Opus 4.7 minimum cacheable prefix is 4096
// tokens — if the prompt is shorter than that the cache silently no-ops,
// which is fine; the marker is harmless).
const SYSTEM_PROMPT = `You are an expert trading-chart vision analyst working inside a trading-journal app. Your job is to extract precise trade data from a single screenshot of a trading chart and return it as a structured tool call.

You will use the submit_trade_analysis tool to return your answer — never reply with plain text.

────────────────────────────────────────
STEP 1 — Identify the symbol
────────────────────────────────────────
Scan the chart for the instrument name. It is almost always at the TOP-LEFT or in the chart title.

- Strip exchange prefixes: CME:, NASDAQ:, BINANCE:, FOREX:, OANDA:, FX:, etc.
- Strip the trailing exchange suffix and ":" — keep only the bare symbol.
- Uppercase, no spaces, no slashes (e.g. EUR/USD → EURUSD).
- Examples of good symbols: MES1!, EURUSD, GOLD, NAS100, US30, BTCUSDT, AAPL, SPX500.

If the symbol is genuinely unreadable, set it to null — never guess. The user will fill it in manually.

────────────────────────────────────────
STEP 2 — Identify the four price levels
────────────────────────────────────────
Trading platforms render trade markers in a few standard ways. Look for ALL of:

ENTRY price:
  - Horizontal line with "Entry", "Open", "Buy", "Sell" label
  - The TOP edge (longs) or BOTTOM edge (shorts) of a colored entry box
  - An arrow icon at the start of a trade line
  - The leftmost endpoint of a P&L line / trade visualization

EXIT price (where the trade actually CLOSED):
  - "Close", "Exit", "TP hit", "SL hit" labels
  - The RIGHTMOST endpoint of a trade line
  - Where the price line clearly REVERSES or ENDS
  - The opposite edge of a P&L box from the entry
  - **If the chart shows only a PLANNED trade with no closure, exit_price = null.**

STOP_LOSS (SL):
  - Red horizontal line, "SL" label, dashed lower line on a long, dashed upper line on a short
  - Bottom of a red zone for longs / top of a red zone for shorts
  - If not visible, return null.

TAKE_PROFIT (TP):
  - Green horizontal line, "TP" / "Target" label
  - Top of a green zone for longs / bottom of a green zone for shorts
  - If not visible, return null.

────────────────────────────────────────
STEP 3 — Determine direction (long / short)
────────────────────────────────────────
Use multiple signals; they should all agree:

LONG if any of:
  - Entry < Take Profit (TP above entry)
  - Entry > Stop Loss (SL below entry)
  - Box / box-fill colored green / blue
  - Label says "Buy", "Long", "BUY"

SHORT if any of:
  - Entry > Take Profit (TP below entry)
  - Entry < Stop Loss (SL above entry)
  - Box colored red / pink
  - Label says "Sell", "Short", "SELL"

Cross-check rule: if SL is ABOVE entry → "short"; if SL is BELOW entry → "long". Trust this rule when other signals conflict.

────────────────────────────────────────
STEP 4 — Read prices precisely
────────────────────────────────────────
- Use the PRICE AXIS on the right edge of the chart as ground truth.
- Numbers only — no currency symbols, no thousand separators.
- Match the decimal precision of the instrument:
   * Forex majors: 4-5 decimals (e.g. 1.08234)
   * Indices: 0-2 decimals (e.g. 6869, 18450.25)
   * Crypto: variable (e.g. 67234.5, 0.0245)
   * Stocks: 2-4 decimals (e.g. 142.55)
- If a number is partially obscured, return null rather than guessing the obscured digits.

────────────────────────────────────────
STEP 5 — Calibrate confidence (0-100)
────────────────────────────────────────
Set the confidence field honestly:
  90-100: All values clearly labeled, chart is high resolution, no ambiguity.
  70-89:  Most values clear, one or two required careful reading from the price axis.
  50-69:  Lower-quality chart, some values inferred from box edges or partial labels.
  Below 50: Chart is ambiguous, partial, or low-contrast — user will need to verify.

────────────────────────────────────────
STEP 6 — Write a short reasoning note
────────────────────────────────────────
In the analysis field, give 1-2 sentences explaining what you found and how. Examples:
  - "Entry from green box top edge at 1.0823, exit at TP-hit marker at 1.0867; SL at red dashed line below."
  - "Symbol read from top-left (FX:EURUSD → EURUSD). SL above entry → short. Exit price unclear, returned null."
  - "Long trade visible with arrow icon at entry; close not shown on chart, exit_price=null."

────────────────────────────────────────
RULES
────────────────────────────────────────
- Always call submit_trade_analysis. Never return plain text.
- Numbers only for prices. Use null when unreadable — never guess.
- Symbol uppercase, no exchange prefix.
- direction is exactly "long" or "short".
- confidence is an integer 0-100.`

// Forced tool call — guarantees the output is structured JSON matching this
// schema. Far more reliable than free-text JSON + regex parsing.
const ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'submit_trade_analysis',
  description:
    'Submit the structured analysis of the trading chart. You MUST call this tool with the extracted values — do not respond with plain text.',
  input_schema: {
    type: 'object',
    properties: {
      symbol: {
        type: ['string', 'null'] as any,
        description:
          'The trading symbol / ticker, uppercase, no exchange prefix. e.g. "EURUSD", "MES1!", "BTCUSDT". null if unreadable.',
      },
      direction: {
        type: 'string',
        enum: ['long', 'short'],
        description: 'Trade direction.',
      },
      entry_price: {
        type: ['number', 'null'] as any,
        description:
          'Entry price as a number — no currency, no commas. null if unreadable.',
      },
      exit_price: {
        type: ['number', 'null'] as any,
        description:
          'Exit / close price as a number. null if the chart only shows a planned trade with no clear close.',
      },
      stop_loss: {
        type: ['number', 'null'] as any,
        description: 'Stop loss price as a number. null if not visible on the chart.',
      },
      take_profit: {
        type: ['number', 'null'] as any,
        description: 'Take profit price as a number. null if not visible on the chart.',
      },
      confidence: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description: 'Confidence (0-100) that the extracted values are correct.',
      },
      analysis: {
        type: 'string',
        description:
          '1-2 sentence note explaining what was found and how (where each value was read from on the chart).',
      },
    },
    required: [
      'symbol',
      'direction',
      'entry_price',
      'exit_price',
      'stop_loss',
      'take_profit',
      'confidence',
      'analysis',
    ],
  },
}

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

    // Stream so adaptive thinking + vision can run without HTTP timeouts.
    // We don't stream to the client — we collect server-side then return JSON.
    const stream = client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 8192,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' } as any,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [ANALYSIS_TOOL],
      tool_choice: { type: 'tool', name: 'submit_trade_analysis' },
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
              text: 'Analyze this trading chart and submit the values via submit_trade_analysis.',
            },
          ],
        },
      ],
    })

    const message = await stream.finalMessage()

    const toolUseBlock = message.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === 'tool_use' && b.name === 'submit_trade_analysis',
    )

    if (!toolUseBlock) {
      console.error('No tool_use block in response. stop_reason:', message.stop_reason)
      throw new Error('Model did not produce a tool call — chart may be unreadable')
    }

    const parsed = toolUseBlock.input as {
      symbol: string | null
      direction: 'long' | 'short'
      entry_price: number | null
      exit_price: number | null
      stop_loss: number | null
      take_profit: number | null
      confidence: number
      analysis: string
    }

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('AI analysis error:', error)

    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limited — try again in a moment' },
        { status: 429 },
      )
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: error.message || 'Analysis failed' },
        { status: error.status || 500 },
      )
    }
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 },
    )
  }
}
