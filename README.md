# Absence Calculator

A CLI tool to calculate days spent abroad in rolling time windows, helping you track compliance with visa, immigration, and tax residency requirements. Supports customizable rolling windows and absence limits for any country's requirements.

**Written in Go** - Fast, cross-platform, standalone binaries with no dependencies.

## Features

- **Customizable rules**: Configure rolling window period (months) and absence limit (days)
- Calculate absence days for each trip's end date in a rolling window
- Check current status based on today's date
- Project future status with a custom estimated date
- **Flexible CSV input**: Auto-detects headers, supports multiple date formats
- **Simple format**: Only requires start and end dates (days calculated automatically)
- **Cross-platform binaries**: macOS (Apple Silicon & Intel), Windows, Linux
- **Zero dependencies**: Standalone binaries, no runtime required

## Use Cases

- **UK Visa Compliance**: Default 12-month/180-day rule
- **Schengen Visa**: 6-month/90-day rule (`--window 6 --limit 90`)
- **Tax Residency**: Custom periods for different countries
- **Long-term Planning**: Track absences over multiple years

## Quick Start

### 📦 Building the Binaries

Build binaries for all platforms:

```bash
make all
```

This creates:
- `build/stay-within-macos-arm64` - macOS Apple Silicon (M1/M2/M3)
- `build/stay-within-macos-amd64` - macOS Intel
- `build/stay-within-windows-amd64.exe` - Windows 64-bit

Or build for specific platforms:
```bash
make build-macos-arm      # macOS Apple Silicon only
make build-macos-intel    # macOS Intel only
make build-windows        # Windows 64-bit only
make build-linux          # Linux 64-bit (bonus)
```

### Using the Binaries

#### macOS Apple Silicon (M1/M2/M3)
```bash
./build/stay-within-macos-arm64 trips.csv
./build/stay-within-macos-arm64 trips.csv --date 01.06.2026
```

#### macOS Intel
```bash
./build/stay-within-macos-amd64 trips.csv
./build/stay-within-macos-amd64 trips.csv --date 01.06.2026
```

#### Windows
```cmd
.\build\stay-within-windows-amd64.exe trips.csv
.\build\stay-within-windows-amd64.exe trips.csv --date 01.06.2026
```

#### Linux
```bash
./build/stay-within-linux-amd64 trips.csv
./build/stay-within-linux-amd64 trips.csv --date 01.06.2026
```

## CSV File Format

Create a CSV file with your trips. The file only requires **two columns**: start date and end date. Days will be calculated automatically.

### With Header (Recommended)
```csv
Start,End
25.05.2023,10.08.2023
15.09.2023,20.09.2023
24.12.2023,04.01.2024
```

### Without Header (Also Supported)
```csv
25.05.2023,10.08.2023
15.09.2023,20.09.2023
24.12.2023,04.01.2024
```

The tool automatically detects whether your CSV has a header row.

### Supported Date Formats

The tool is flexible and supports multiple date formats:
- `dd.mm.yyyy` - European format (25.05.2023)
- `dd/mm/yyyy` - Alternative European (25/05/2023)
- `yyyy-mm-dd` - ISO format (2023-05-25)
- `mm/dd/yyyy` - US format (05/25/2023)
- `dd-mm-yyyy` - Dashed format (25-05-2023)
- And more...

**Columns:**
- **First column**: Trip start date
- **Second column**: Trip end date

Days of absence are automatically calculated (end date - start date + 1).

## Command Line Options

```bash
<csv_file>              Required: Path to your trips CSV file

Options:
  --date <dd.mm.yyyy>   Use a specific date for calculation instead of today
  --window <months>     Rolling window period in months (default: 12)
  --limit <days>        Maximum allowed absence days in window (default: 180)
```

### Examples

**Default settings (12 months, 180 days):**
```bash
./build/stay-within-macos-arm64 trips.csv
```

**Different visa requirements (6 months, 90 days):**
```bash
./build/stay-within-macos-arm64 trips.csv --window 6 --limit 90
```

**Long-term tracking (24 months, 365 days):**
```bash
./build/stay-within-macos-arm64 trips.csv --window 24 --limit 365
```

**Plan future with custom parameters:**
```bash
./build/stay-within-macos-arm64 trips.csv --date 01.06.2026 --window 6 --limit 90
```

## Output

The tool generates two sections:

### 1. Per-Trip Analysis
Shows for each trip end date:
- Days spent outside UK in the 12-month window ending on that date
- Remaining days out of the 180-day allowance

### 2. Current/Estimated Status
Shows:
- Today's date (or custom estimated date)
- Last trip end date
- Days in UK since last trip
- Total absence days in the rolling 12-month window
- Remaining allowance

## Building from Source

### Prerequisites

- Go 1.19 or higher
- Make (optional, but recommended)

### Build All Platforms

```bash
make all
```

This builds binaries for:
- macOS Apple Silicon (ARM64)
- macOS Intel (AMD64)
- Windows 64-bit

### Build Specific Platform

```bash
make build-macos-arm     # macOS Apple Silicon
make build-macos-intel   # macOS Intel
make build-windows       # Windows 64-bit
make build-linux         # Linux 64-bit
```

### Build for Current Platform Only

```bash
make build
# or
go build -o build/stay-within .
```

### Without Make

If you don't have Make installed, use Go directly:

```bash
# macOS Apple Silicon
GOOS=darwin GOARCH=arm64 go build -ldflags "-s -w" -o build/stay-within-macos-arm64 .

# macOS Intel
GOOS=darwin GOARCH=amd64 go build -ldflags "-s -w" -o build/stay-within-macos-amd64 .

# Windows 64-bit
GOOS=windows GOARCH=amd64 go build -ldflags "-s -w" -o build/stay-within-windows-amd64.exe .

# Linux 64-bit
GOOS=linux GOARCH=amd64 go build -ldflags "-s -w" -o build/stay-within-linux-amd64 .
```

### Development

```bash
# Run tests
make test

# Run locally
make run

# Install dependencies
make deps
```

## Technical Details

### Rolling Window Calculation

For each calculation point (trip end date or today/estimated date):
- Window end: The calculation date
- Window start: N months before the calculation date (configurable via `--window`)
- Counted days: All days from trips that overlap with this window
- Limit: Maximum allowed absence days (configurable via `--limit`)

### Common Rules by Country

This tool can be configured for various country requirements:

| Country/Visa | Window | Limit | Command |
|-------------|---------|-------|---------|
| UK (Default) | 12 months | 180 days | Default settings |
| Schengen | 6 months | 90 days | `--window 6 --limit 90` |
| US B1/B2 | 12 months | ~182 days | Default or `--limit 182` |
| Custom | Any | Any | `--window X --limit Y` |

**Important:** This tool is for tracking purposes only. Consult with immigration or tax professionals for official guidance specific to your situation.

## Examples

### Example 1: Check current status
```bash
./build/stay-within-macos-arm64 trips.csv
```

Sample output:
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
05.01.2024   | 15.01.2024   |     11 |                  107 |           73
30.03.2024   | 03.04.2024   |      5 |                  112 |           68
07.04.2024   | 20.04.2024   |     14 |                  126 |           54
------------------------------------------------------------------------------------------

Note: The 12-month window ends on each trip's end date and starts 12 months before.
Days in window include all days from trips that overlap with that window.

==========================================================================================
CURRENT STATUS - As of Today
==========================================================================================

Today's date: 14.11.2025
Last trip ended: 20.04.2024
Days in UK since last trip: 208 days
Rolling 12-month window: 14.11.2024 to 14.11.2025

------------------------------------------------------------------------------------------
Days spent outside UK (last 12 months): 130 days
Days remaining (out of 180):            50 days
------------------------------------------------------------------------------------------

✓ You are within the 180-day limit.
```

### Example 2: Plan a future trip
```bash
./build/stay-within-macos-arm64 trips.csv --date 01.03.2026
```

Sample output shows:
```
==========================================================================================
ESTIMATED STATUS - As of 01.03.2026
==========================================================================================

Estimated date: 01.03.2026
Last trip ended: 20.04.2024
Days in UK since last trip: 315 days
Rolling 12-month window: 01.03.2025 to 01.03.2026

------------------------------------------------------------------------------------------
Days spent outside UK (last 12 months): 104 days
Days remaining (out of 180):            76 days
------------------------------------------------------------------------------------------

✓ You are within the 180-day limit.
```

This helps you plan future trips by showing how many days you'll have remaining at any future date.

## Files in This Repository

### Core Files
- `main.go` - Main Go application
- `go.mod` - Go module definition
- `trips.csv` - Example CSV file with sample trip data
- `Makefile` - Build automation

### Documentation
- `README.md` - This file

### Generated Files (after build)
- `build/stay-within-macos-arm64` - macOS Apple Silicon binary
- `build/stay-within-macos-amd64` - macOS Intel binary
- `build/stay-within-windows-amd64.exe` - Windows 64-bit executable
- `build/stay-within-linux-amd64` - Linux 64-bit binary (optional)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues or questions, please refer to the source code and documentation.

## Changelog

### Version 3.0 (Go Rewrite)
- **REWRITTEN IN GO**: Complete rewrite from PHP to Go
- **Cross-platform binaries**: Native support for macOS (ARM64 & Intel), Windows, Linux
- **Zero dependencies**: Standalone binaries, no runtime required
- **Faster performance**: Native compiled binaries
- **Same features**: All functionality from v2.0 maintained
- Customizable rolling window period via `--window` parameter
- Customizable absence limit via `--limit` parameter
- Support for any country's visa/residency requirements (UK, Schengen, etc.)
- Flexible CSV parsing (auto-detects headers, multiple date formats)
- Simplified CSV format (only start/end dates required)
- Days calculated automatically

### Version 2.0 (PHP)
- Customizable rolling window period via `--window` parameter
- Customizable absence limit via `--limit` parameter
- Flexible CSV parsing (auto-detects headers, multiple date formats)
- Simplified CSV format (only start/end dates required)

### Version 1.0 (PHP)
- Initial PHP release
- Rolling 12-month window calculations
- Current and estimated date projections
