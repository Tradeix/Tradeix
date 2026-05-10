import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an expert trading-chart vision analyst working inside a trading-journal app. You extract precise trade data from a single chart screenshot and return it via the submit_trade_analysis tool — never plain text.

You MUST work in this exact order. Do NOT extract prices first.

══════════════════════════════════════════════════════════════
STEP 1 — Read the SYMBOL (top-left of the chart)
══════════════════════════════════════════════════════════════
Strip exchange prefixes (CME:, NASDAQ:, BINANCE:, FOREX:, OANDA:, FX:).
Uppercase, no spaces, no slashes (EUR/USD → EURUSD).
Examples: MES1!, EURUSD, GOLD, NAS100, BTCUSDT, AAPL, SPX500.
If unreadable, return "".

══════════════════════════════════════════════════════════════
STEP 2 — Determine DIRECTION first, BEFORE any prices
══════════════════════════════════════════════════════════════
TradingView's Long/Short Position tool is the dominant case. It is a
two-band rectangle stacked vertically across the chart, split by a
horizontal entry line in the middle. Each band is a flat color fill.

Visual decision tree — apply in order, stop at the first match:

(A) Look at the COLOR ABOVE the central horizontal entry line.
    - GREEN / TEAL / LIGHT-GREEN above entry  →  direction = "long"
    - RED / PINK / LIGHT-RED   above entry    →  direction = "short"
    The opposite color must be on the other side. This rule is
    correct in ~95% of TradingView screenshots — trust it.

(B) If no colored zones, look for explicit labels:
    "Long" / "Buy" / "BUY"   →  long
    "Short" / "Sell" / "SELL" →  short

(C) If still ambiguous, fall back to relative geometry of any
    visible price markers:
    SL line ABOVE entry → short
    SL line BELOW entry → long

(D) If absolutely nothing is visible, return "long" with confidence ≤ 30.

DO NOT decide direction from the price trend. A long can lose; a
short can win. Direction comes from the POSITION TOOL, not the
candles.

══════════════════════════════════════════════════════════════
STEP 3 — Map prices using the direction you just determined
══════════════════════════════════════════════════════════════
Once direction is known, the four prices have FIXED roles:

Direction = LONG:
  - TAKE_PROFIT = top edge of GREEN zone (highest price in the tool)
  - ENTRY       = horizontal line at the BORDER between green & red
  - STOP_LOSS   = bottom edge of RED zone (lowest price in the tool)
  - For LONG: take_profit > entry > stop_loss   ← MUST hold

Direction = SHORT:
  - STOP_LOSS   = top edge of RED zone (highest price in the tool)
  - ENTRY       = horizontal line at the BORDER between red & green
  - TAKE_PROFIT = bottom edge of GREEN zone (lowest price in the tool)
  - For SHORT: take_profit < entry < stop_loss   ← MUST hold

If the prices you extract violate the direction inequality above, you
made a swap — re-check the colors and start over.

EXIT price (the actual close):
  - "Close", "Exit", "TP hit", "SL hit" labels.
  - Rightmost endpoint of a finished trade line.
  - Where a P&L bar stops on the right side of the trade tool.
  - If the chart shows only a PLAN (no close), return 0.

OUTCOME is determined by FIRST TOUCH after entry, not by where price
eventually went later:
  - Scan candles left-to-right after the trade entry/activation point.
  - The trade starts at the LEFT edge of the TradingView position tool / the
    first candle after the entry marker. Ignore candles before that.
  - Do not look at the final visible candle first. Determine which boundary
    was touched earliest in time.
  - For LONG: if price touches STOP_LOSS before TAKE_PROFIT, outcome = "loss"
    and exit_price = stop_loss, even if price later rallies to TP.
  - For LONG: if price touches TAKE_PROFIT before STOP_LOSS, outcome = "win"
    and exit_price = take_profit.
  - For SHORT: if price touches STOP_LOSS before TAKE_PROFIT, outcome = "loss"
    and exit_price = stop_loss, even if price later drops to TP.
  - For SHORT: if price touches TAKE_PROFIT before STOP_LOSS, outcome = "win"
    and exit_price = take_profit.
  - Candle wicks count as touches. A wick through SL means stopped out.
  - If SL and TP appear touched in the same candle and the intrabar order is
    impossible to verify, choose outcome = "loss" and confidence <= 60.
  - If there is no clear first touch, outcome = "unknown" and exit_price = 0.
Never mark a trade as a win just because price eventually reaches TP after SL
was touched first.
You MUST also return first_touch:
  - "stop_loss" when SL was touched first.
  - "take_profit" when TP was touched first.
  - "unknown" when the first touch is not visible/clear.
For screenshots where price drops into the stop zone immediately after entry
and only later rises into the green target zone, first_touch = "stop_loss",
outcome = "loss", exit_price = stop_loss.

══════════════════════════════════════════════════════════════
STEP 4 — Read each price precisely from the right-edge price axis
══════════════════════════════════════════════════════════════
Project a horizontal mental line from each marker to the price axis
on the RIGHT side. The axis numbers are the ground truth, not the
labels printed inside the tool box (those can be cropped or partial).

Decimal precision by instrument:
  Forex majors: 4–5 decimals (1.08234)
  Indices:      0–2 decimals (6869, 18450.25)
  Crypto:       variable     (67234.5, 0.0245)
  Stocks:       2–4 decimals (142.55)
  Futures:      typically 2 decimals (5045.25)

Numbers only — no $, no thousand separators. Return 0 for any value
you cannot read with confidence. NEVER guess to fill a slot.

══════════════════════════════════════════════════════════════
STEP 5 — Self-check before returning
══════════════════════════════════════════════════════════════
Before calling the tool, verify ALL of these:
  1. If direction = "long":  stop_loss < entry < take_profit  (when both set)
  2. If direction = "short": stop_loss > entry > take_profit  (when both set)
  3. first_touch follows the candle order from left to right.
  4. outcome follows first_touch: stop_loss -> loss, take_profit -> win.
  5. If outcome = "loss", exit_price should normally equal stop_loss.
     If outcome = "win", exit_price should normally equal take_profit.
  6. The price decimal places match the instrument type.

If any check fails, REVISIT step 2 — direction was probably wrong.

══════════════════════════════════════════════════════════════
STEP 6 — Confidence (0–100)
══════════════════════════════════════════════════════════════
  90–100: Position tool clearly visible, all numbers crisp, axis values match.
  70–89:  Tool visible but a value or two read off the axis with care.
  50–69:  Partial visibility, some inference required.
  <50:    Chart is ambiguous or low-contrast.

══════════════════════════════════════════════════════════════
STEP 7 — Reasoning note (analysis field, 1–2 sentences)
══════════════════════════════════════════════════════════════
Explicitly state which color was above the entry line and what that
forced for the direction. Examples:
  - "Green band above entry → long. Entry 1.0823 from middle border, TP 1.0867 from top edge, SL 1.0780 from bottom; trade ran to close at 1.0867 (TP hit)."
  - "Red band above entry → short. SL 5050 (top of red), entry 5040, TP 5020; chart shows planned trade only, exit returned 0."

────────────────────────────────────────
RULES
────────────────────────────────────────
- Always call submit_trade_analysis. Never return plain text.
- Numbers only for prices. Use 0 (zero) when a value is unreadable / not visible — the app will treat 0 as "missing" and let the user fill it in.
- symbol uppercase, no exchange prefix. Use "" if unreadable.
- direction is exactly "long" or "short".
- first_touch is exactly "stop_loss", "take_profit", or "unknown".
- outcome is exactly "win", "loss", or "unknown".
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
      outcome: {
        type: 'string',
        enum: ['win', 'loss', 'unknown'],
        description:
          'Trade result based on first touch after entry: SL first = loss, TP first = win, unknown if no clear first touch.',
      },
      first_touch: {
        type: 'string',
        enum: ['stop_loss', 'take_profit', 'unknown'],
        description:
          'Which boundary was touched first after entry when scanning candles left-to-right. stop_loss if SL was hit before TP, take_profit if TP was hit before SL, unknown if unclear.',
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
      'outcome',
      'first_touch',
      'confidence',
      'analysis',
    ],
  },
}

async function fetchTradingViewSnapshot(rawUrl: string): Promise<{ base64: string; mediaType: string; sourceUrl: string }> {
  let u: URL
  try { u = new URL(rawUrl) } catch { throw new Error('Invalid URL') }
  const host = u.hostname.replace(/^www\./, '')
  if (!/(^|\.)tradingview\.com$/.test(host)) {
    throw new Error('Only tradingview.com URLs are supported')
  }

  const xMatch = u.pathname.match(/\/x\/([A-Za-z0-9]+)/)
  if (xMatch) {
    const id = xMatch[1]
    const directUrl = `https://s3.tradingview.com/snapshots/${id[0].toLowerCase()}/${id}.png`
    const direct = await fetch(directUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (direct.ok) {
      const buf = await direct.arrayBuffer()
      return { base64: Buffer.from(buf).toString('base64'), mediaType: 'image/png', sourceUrl: directUrl }
    }
  }

  const html = await fetch(u.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9' },
  }).then(r => r.text())

  const og = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
    ?? html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i)
  if (!og) throw new Error('לא נמצאה תמונת snapshot בקישור — ודא שזה קישור tradingview.com/x/... ציבורי')
  const imgUrl = og[1].replace(/&amp;/g, '&')
  const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!imgRes.ok) throw new Error(`Failed to download chart image (${imgRes.status})`)
  const buf = await imgRes.arrayBuffer()
  const ct = (imgRes.headers.get('content-type') || 'image/png').split(';')[0].trim()
  return { base64: Buffer.from(buf).toString('base64'), mediaType: ct, sourceUrl: imgUrl }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.startsWith('your_') || !apiKey.startsWith('sk-ant-')) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    let { image, mediaType } = body as { image?: string; mediaType?: string }
    const tradingViewUrl: string | undefined = body.tradingViewUrl

    let resolvedSourceUrl: string | undefined

    if (tradingViewUrl && !image) {
      try {
        const fetched = await fetchTradingViewSnapshot(tradingViewUrl)
        image = fetched.base64
        mediaType = fetched.mediaType
        resolvedSourceUrl = fetched.sourceUrl
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Failed to fetch TradingView image' }, { status: 400 })
      }
    }

    if (!image) {
      return NextResponse.json({ error: 'No image or TradingView URL provided' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      // Note: thinking can't be combined with a forced tool_choice
      // (API rejects with "Thinking may not be enabled when tool_choice
      // forces tool use"). Forced tool gives us a deterministic structured
      // response which is what the journal needs; the post-processing layer
      // below corrects any geometric inconsistencies the model produces.
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
                media_type: ((mediaType || 'image/jpeg') as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'),
                data: image,
              },
            },
            {
              type: 'text',
              text: 'Analyze this trading chart and submit the values via submit_trade_analysis. Be especially careful with first_touch: scan the candles from the trade entry forward. If price hit stop loss first and only later reached take profit, return first_touch="stop_loss", outcome="loss", and exit_price=stop_loss.',
            },
          ],
        },
      ],
    })

    const toolUseBlock = response.content.find(
      (b: any) => b.type === 'tool_use' && b.name === 'submit_trade_analysis',
    ) as { type: 'tool_use'; name: string; input: any } | undefined

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
      outcome?: 'win' | 'loss' | 'unknown'
      first_touch?: 'stop_loss' | 'take_profit' | 'unknown'
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
      outcome: raw.outcome === 'win' || raw.outcome === 'loss' ? raw.outcome : null,
      first_touch: raw.first_touch === 'stop_loss' || raw.first_touch === 'take_profit' ? raw.first_touch : null,
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0,
      analysis: raw.analysis || '',
    }

    // ── Sanity-correction layer ─────────────────────────────────────────
    // Direction is the most error-prone field. If the relative order of
    // the prices contradicts the declared direction, infer the truth from
    // the geometry — which the model cannot fake even when its color
    // perception failed. SL position relative to entry is the gold
    // standard rule.
    const corrections: string[] = []
    const e = normalized.entry_price
    const sl = normalized.stop_loss
    const tp = normalized.take_profit
    const x = normalized.exit_price

    // Geometric direction from prices, when available
    let geoDirection: 'long' | 'short' | null = null
    if (e != null && sl != null) {
      if (sl < e) geoDirection = 'long'
      else if (sl > e) geoDirection = 'short'
    } else if (e != null && tp != null) {
      if (tp > e) geoDirection = 'long'
      else if (tp < e) geoDirection = 'short'
    }

    if (geoDirection && normalized.direction !== geoDirection) {
      corrections.push(`direction: ${normalized.direction} → ${geoDirection} (geometry)`)
      normalized.direction = geoDirection
    }

    // Fix swapped TP/SL when the values themselves contradict the
    // (now correct) direction. This handles the case where the model
    // identified direction correctly but mis-labeled which line is which.
    if (e != null && sl != null && tp != null) {
      const isLong = normalized.direction === 'long'
      const validLong  = sl < e && tp > e
      const validShort = sl > e && tp < e
      if ((isLong && !validLong) || (!isLong && !validShort)) {
        const newSl = tp, newTp = sl
        const swapValid = isLong ? (newSl < e && newTp > e) : (newSl > e && newTp < e)
        if (swapValid) {
          normalized.stop_loss = newSl
          normalized.take_profit = newTp
          corrections.push('swapped sl/tp')
        }
      }
    }

    // Prefer the explicit first-touch field over the model's summary
    // outcome. This prevents a later TP touch from overriding an earlier stop.
    if (normalized.first_touch === 'stop_loss') {
      if (normalized.outcome !== 'loss') corrections.push('outcome set to loss from first_touch')
      normalized.outcome = 'loss'
    } else if (normalized.first_touch === 'take_profit') {
      if (normalized.outcome !== 'win') corrections.push('outcome set to win from first_touch')
      normalized.outcome = 'win'
    }

    // Align the close price to the boundary that ended the trade so the
    // frontend does not reclassify a stopped trade as a win after a later TP.
    if (normalized.outcome === 'loss' && normalized.stop_loss != null) {
      if (normalized.exit_price !== normalized.stop_loss) {
        normalized.exit_price = normalized.stop_loss
        corrections.push('exit set to sl for loss')
      }
    } else if (normalized.outcome === 'win' && normalized.take_profit != null) {
      if (normalized.exit_price !== normalized.take_profit) {
        normalized.exit_price = normalized.take_profit
        corrections.push('exit set to tp for win')
      }
    } else if (!normalized.outcome && e != null && x != null) {
      const isLong = normalized.direction === 'long'
      const priceWentUp = x > e
      normalized.outcome = (isLong ? priceWentUp : !priceWentUp) ? 'win' : 'loss'
      corrections.push('outcome inferred from exit')
    }

    // Penalize confidence when we had to correct
    if (corrections.length > 0) {
      normalized.confidence = Math.min(normalized.confidence, 70)
      normalized.analysis = `${normalized.analysis} [auto-corrected: ${corrections.join('; ')}]`.trim()
    }

    return NextResponse.json({ ...normalized, sourceUrl: resolvedSourceUrl, fetchedImage: resolvedSourceUrl ? image : undefined, fetchedMediaType: resolvedSourceUrl ? (mediaType || 'image/png') : undefined })
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
