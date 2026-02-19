# Stay Within - Absence Calculator

Track your days abroad to stay compliant with visa and residency rules. Supports customizable rolling windows and absence limits for any country's requirements.

## Web Version

**No installation needed** — use it directly in your browser:

**[https://maxwellhays.github.io/stay-within/](https://maxwellhays.github.io/stay-within/)**

- Paste or type your trips, or upload a CSV file
- Preset rules for UK, Schengen, and US B1/B2
- Per-trip breakdown table and color-coded status card
- Data persists in browser localStorage between visits

## CLI Version

A Go CLI for power users and scripting. Fast, cross-platform, standalone binaries with no dependencies.

### Quick Start

1. **Download/clone this repo**
2. **Choose your binary** from `cli/build/`:
   - macOS Apple Silicon: `cli/build/stay-within-macos-arm64`
   - macOS Intel: `cli/build/stay-within-macos-amd64`
   - Windows: `cli/build/stay-within-windows-amd64.exe`
3. **Create your trips CSV** (see `trips.csv` for an example)
4. **Run it**: `./cli/build/stay-within-macos-arm64 trips.csv`

No installation, no dependencies, no build required.

### Example Output

```
==========================================================================================
UK ABSENCE CALCULATOR - Rolling 12-Month Window Analysis
==========================================================================================

Allowed absence: 180 days in any rolling 12-month period

------------------------------------------------------------------------------------------
Trip Start   | Trip End     | Days   | Days in 12mo Window  | Days Remaining
------------------------------------------------------------------------------------------
25.05.2023   | 10.08.2023   |     78 |                   78 |          102
15.09.2023   | 20.09.2023   |      6 |                   84 |           96
24.12.2023   | 04.01.2024   |     12 |                   96 |           84
------------------------------------------------------------------------------------------

==========================================================================================
CURRENT STATUS - As of Today
==========================================================================================

Today's date: 15.11.2025
Last trip ended: 30.10.2025
Days in UK since last trip: 16 days
Rolling 12-month window: 15.11.2024 to 15.11.2025

------------------------------------------------------------------------------------------
Days spent outside UK (last 12 months): 130 days
Days remaining (out of 180):            50 days
------------------------------------------------------------------------------------------

✓ You are within the 180-day limit.
```

### Command Line Options

```
<csv_file>              Required: path to your trips CSV file

Options:
  --date <dd.mm.yyyy>   Use a specific date instead of today
  --window <months>     Rolling window period in months (default: 12)
  --limit <days>        Maximum allowed absence days in window (default: 180)
  --json                Output results as JSON (for scripting/testing)
```

### Examples

```bash
# Default (UK: 12 months, 180 days)
./cli/build/stay-within-macos-arm64 trips.csv

# Schengen visa (6 months, 90 days)
./cli/build/stay-within-macos-arm64 trips.csv --window 6 --limit 90

# Project status at a future date
./cli/build/stay-within-macos-arm64 trips.csv --date 01.06.2026 --window 6 --limit 90
```

### Building from Source

Requires Go 1.19+ and Make (optional).

```bash
cd cli

make all             # build for macOS (arm64 + amd64) and Windows
make build-linux     # build for Linux 64-bit
make build           # build for current platform
make run             # run with ../trips.csv
make test            # run Go tests
```

Without Make:

```bash
cd cli

# macOS Apple Silicon
GOOS=darwin GOARCH=arm64 go build -ldflags "-s -w" -o build/stay-within-macos-arm64 .

# Linux 64-bit
GOOS=linux GOARCH=amd64 go build -ldflags "-s -w" -o build/stay-within-linux-amd64 .
```

## CSV Format

Both the web app and CLI accept the same format. Only two columns are required — days are calculated automatically.

```csv
Start,End
25.05.2023,10.08.2023
15.09.2023,20.09.2023
24.12.2023,04.01.2024
```

Headers are auto-detected and optional. The tool supports **10 date formats**:

| Format | Example |
|--------|---------|
| `dd.mm.yyyy` | 25.05.2023 |
| `dd/mm/yyyy` | 25/05/2023 |
| `yyyy-mm-dd` | 2023-05-25 |
| `mm/dd/yyyy` | 05/25/2023 |
| `dd-mm-yyyy` | 25-05-2023 |
| and more... | |

## Common Rules by Country

| Country/Visa | Window | Limit |
|---|---|---|
| UK (default) | 12 months | 180 days |
| Schengen | 6 months | 90 days |
| US B1/B2 | 12 months | 182 days |

**This tool is for tracking purposes only. Consult with immigration or tax professionals for official guidance.**

## Repository Structure

```
stay-within/
├── cli/                    # Go CLI
│   ├── main.go
│   ├── go.mod
│   ├── Makefile
│   └── build/              # Pre-built binaries
│       ├── stay-within-macos-arm64
│       ├── stay-within-macos-amd64
│       └── stay-within-windows-amd64.exe
├── web/                    # Angular web app (source)
│   ├── angular.json
│   ├── package.json
│   └── src/
│       └── app/
│           ├── models/     # TypeScript type definitions
│           ├── services/   # Calculation logic (date parser, CSV parser, calculator)
│           └── components/ # config-bar, trip-input, status-card, trip-table
├── docs/                   # Built web app (GitHub Pages)
├── tests/                  # Cross-implementation e2e tests (Go vs TypeScript)
│   ├── e2e.ts
│   └── fixtures/           # Test CSV files
└── trips.csv               # Example trip data
```

## Development

### Web App

```bash
cd web
npm start            # dev server at http://localhost:4200 (hot reload)
npm run preview      # build + serve production output at http://localhost:3000
npm test             # run unit tests (Vitest)
npm run build        # production build → docs/
```

### Cross-Implementation Tests

Tests run the Go CLI and the TypeScript services against the same CSV fixtures and compare every output value:

```bash
cd tests
npx tsx e2e.ts
```

## License

MIT — see [LICENSE](LICENSE).
