# SigmaUSD Tracker

## Live Demo

**[https://ad-ergo-sigmausd-tracker-1775099463035.vercel.app](https://ad-ergo-sigmausd-tracker-1775099463035.vercel.app)**

## Features

- **Reserve Ratio Gauge** — animated semicircle gauge showing protocol health (Critical / Warning / Healthy)
- **Live Stats Grid** — SigUSD price (ERG), SigRSV price (ERG), ERG reserve, SigUSD supply, SigRSV supply, ERG/USD price
- **Reserve History Chart** — Chart.js line chart tracking ratio over your session with threshold reference lines at 200% (critical) and 400% (healthy)
- **Oracle Commentary** — AI-style narrative description of current reserve health with context
- **Auto-refresh** every 2 minutes

## Data Sources

| Source | Data |
|--------|------|
| Ergo Explorer API | Bank box value, register R4/R5 (SigUSD/SigRSV supply) |
| CoinGecko | ERG/USD spot price |

## SigmaUSD Protocol Summary

SigmaUSD is an algorithmic stablecoin on Ergo. The bank contract holds ERG as collateral and issues:
- **SigUSD** — pegged to $1 USD, backed by ERG
- **SigRSV** — reserve coin, absorbs volatility, profits from reserve equity

Reserve Ratio = (Reserve in USD) / (SigUSD supply in USD) × 100

| Ratio | State |
|-------|-------|
| > 400% | Healthy — all operations permitted |
| 200–400% | Warning — SigRSV redemptions blocked |
| < 200% | Critical — SigUSD minting + SigRSV redemptions blocked |

## How to Run Locally

```bash
# Any static file server works:
npx serve .
# or
python -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

## Built With

- Vanilla HTML/CSS/JS
- [Chart.js](https://chartjs.org) for reserve history chart
- Ergo Explorer REST API
- CoinGecko public API

---

Part of the [Degens.World](https://degens.world) Ergo toolkit.
