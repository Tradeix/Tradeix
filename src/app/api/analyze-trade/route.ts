import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an expert trading-chart vision analyst working inside a trading-journal app. Your job is to extract precise trade data from a single screenshot of a trading chart and return it as a structured tool call.

You will use the submit_trade_analysis tool to return your answer — never reply with plain text.

────────────────────────────────────────
STEP 1 — Identify the symbol
────────────────────────────────────────
Scan the chart for the instrument name. It is almost always at the TOP-LEFT or in the chart title.

- Strip exchange prefixes: CME:, NASDAQ:, BINANCE:, FOREX:, OANDA:, FX:, etc.
- Uppercase, no spaces, no slashes (e.g. EUR/USD → EURUSD).
- Examples: MES1!, EURUSD, GOLD, NAS100, BTCUSDT, AAPL, SPX500.

If the symbol is genuinely unreadable, return an empty string "" — never guess.

────────────────────────────────────────
STEP 2 — Identify the four price levels
────────────────────────────────────────
Trading platforms render trade markers in a few standard ways:

ENTRY price:
  - Horizontal line with "Entry", "Open", "Buy", "Sell" label
  - The TOP edge (longs) or BOTTOM edge (shorts) of a colored entry box
  - An arrow icon at the start of a trade line
  - The leftmost endpoint of a P&L line / trade visualization

EXIT price (where the trade actually CLOSED):
  - "Close", "Exit", "TP hit", "SL hit" labels
  - The RIGHTMOST endpoint of a trade line
  - Where the price line clearly REVERSES or ENDS
  - **If the chart shows only a PLANNED trade with no closure, return 0.**

STOP_LOSS (SL):
  - Red horizontal line, "SL" label, dashed lower line on a long, dashed upper line on a short
  - Bottom of a red zone for longs / top of a red zone for shorts
  - If not visible, return 0.

TAKE_PROFIT (TP):
  - Green horizontal line, "TP" / "Target" label
  - Top of a green zone for longs / bottom of a green zone for shorts
  - If not visible, return 0.

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

Cross-check: if SL is ABOVE entry → "short"; if SL is BELOW entry → "long". Trust this rule when other signals conflict.

────────────────────────────────────────
STEP 4 — Read prices precisely
────────────────────────────────────────
- Use the PRICE AXIS on the right edge of the chart as ground truth.
- Numbers only — no currency symbols, no thousand separators.
- Match decimal precision per instrument:
   * Forex majors: 4-5 decimals (1.08234)
   * Indices: 0-2 decimals (6869, 18450.25)
   * Crypto: variable (67234.5, 0.0245)
   * Stocks: 2-4 decimals (142.55)
- If a number is partially obscured, return 0 instead of guessing.

────────────────────────────────────────
STEP 5 — Calibrate confidence (0-100)
────────────────────────────────────────
  90-100: All values clearly labeled, high resolution, no ambiguity.
  70-89:  Most values clear, one or two read carefully from the price axis.
  50-69:  Lower-quality chart, some values inferred from box edges.
  Below 50: Chart is ambiguous, partial, or low-contrast.

────────────────────────────────────────
STEP 6 — Reasoning note
────────────────────────────────────────
1-2 sentences in the analysis field explaining what you found and how. Examples:
  - "Entry from green box top edge at 1.0823, exit at TP-hit marker at 1.0867; SL at red dashed line below."
  - "SL above entry → short. Exit not shown on chart, returned 0."

────────────────────────────────────────
RULES
────────────────────────────────────────
- Always call submit_trade_analysis. Never return plain text.
- Numbers only for prices. Use 0 (zero) when a value is unreadable / not visible — the app will treat 0 as "missing" and let the user fill it in.
- symbol uppercase, no exchange prefix. Use "" if unreadable.
- direction is exactly "long" or "short".
- confidence is an integer 0-100.`

// Tool with simple-typed schema — the API accepts these reliably across SDK
// versions. Sentinel values (0 for missing prices, "" for missing symbol) are
// converted to nulls in the response below.
const ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'submit_trade_analysis',
  description:
    'Submit the structured analysis of the trading chart. You MUST call this tool with the extracted values — do not respond with plain text.',
  input_schema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description:
          'Trading symbol/ticker, uppercase, no exchange prefix. Empty string "" if unreadable.',
      },
      direction: {
        type: 'string',
        enum: ['long', 'short'],
        description: 'Trade direction.',
      },
      entry_price: {
        type: 'number',
        description: 'Entry price as a number. 0 if unreadable.',
      },
      exit_price: {
        type: 'number',
        description:
          'Exit/close price as a number. 0 if the chart only shows a planned trade with no clear close.',
      },
      stop_loss: {
        type: 'number',
        description: 'Stop loss price. 0 if not visible.',
      },
      take_profit: {
        type: 'number',
        description: 'Take profit price. 0 if not visible.',
      },
      confidence: {
        type: 'integer',
        description: 'Confidence 0-100 that the extracted values are correct.',
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

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
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

    const toolUseBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === 'tool_use' && b.name === 'submit_trade_analysis',
    )

    if (!toolUseBlock) {
      console.error('[analyze-trade] No tool_use block. stop_reason:', response.stop_reason, 'content:', JSON.stringify(response.content))
      throw new Error('Model did not produce a tool call — chart may be unreadable')
    }

    const raw = toolUseBlock.input as {
      symbol: string
      direction: 'long' | 'short'
      entry_price: number
      exit_price: number
      stop_loss: number
      take_profit: number
      confidence: number
      analysis: string
    }

    // Convert sentinel values (0 / "") back to nulls for the frontend.
    const normalized = {
      symbol: raw.symbol && raw.symbol.trim() ? raw.symbol.trim().toUpperCase() : null,
      direction: raw.direction,
      entry_price: raw.entry_price && raw.entry_price > 0 ? raw.entry_price : null,
      exit_price: raw.exit_price && raw.exit_price > 0 ? raw.exit_price : null,
      stop_loss: raw.stop_loss && raw.stop_loss > 0 ? raw.stop_loss : null,
      take_profit: raw.take_profit && raw.take_profit > 0 ? raw.take_profit : null,
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0,
      analysis: raw.analysis || '',
    }

    return NextResponse.json(normalized)
  } catch (error: any) {
    console.error('[analyze-trade] Error:', error?.message || error, error?.status, error?.response?.data || '')

    if (error?.constructor?.name === 'RateLimitError' || error?.status === 429) {
      return NextResponse.json(
        { error: 'Rate limited — try again in a moment' },
        { status: 429 },
      )
    }
    if (error?.status) {
      return NextResponse.json(
        { error: error.message || 'Analysis failed' },
        { status: error.status },
      )
    }
    return NextResponse.json(
      { error: error?.message || 'Analysis failed' },
      { status: 500 },
    )
  }
}
