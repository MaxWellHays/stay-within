# Pre-built Binaries

This folder contains ready-to-use binaries for different platforms. **No installation or build required!**

## How to Use

1. Choose the right binary for your platform:
   - **macOS Apple Silicon (M1/M2/M3/M4)**: `stay-within-macos-arm64`
   - **macOS Intel**: `stay-within-macos-amd64`
   - **Windows 64-bit**: `stay-within-windows-amd64.exe`

2. Create a CSV file with your trips (see `../trips.csv` for example format)

3. Run the binary:

### macOS
```bash
# Make it executable (first time only)
chmod +x stay-within-macos-arm64

# Run it
./stay-within-macos-arm64 your-trips.csv
```

### Windows
```cmd
stay-within-windows-amd64.exe your-trips.csv
```

## Examples

```bash
# Basic usage (default: 12 months, 180 days)
./stay-within-macos-arm64 trips.csv

# Check status on a specific future date
./stay-within-macos-arm64 trips.csv --date 01.06.2026

# Schengen visa rules (6 months, 90 days)
./stay-within-macos-arm64 trips.csv --window 6 --limit 90

# Custom window and limit
./stay-within-macos-arm64 trips.csv --window 24 --limit 365
```

## Need Help?

See the main [README.md](../README.md) for full documentation.
