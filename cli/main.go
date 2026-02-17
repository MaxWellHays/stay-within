package main

import (
	"encoding/csv"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"math"
	"os"
	"sort"
	"strings"
	"time"
)

// Trip represents a single trip abroad
type Trip struct {
	Start time.Time
	End   time.Time
	Days  int
}

// Config holds command-line configuration
type Config struct {
	Filename     string
	CustomDate   string
	WindowMonths int
	AbsenceLimit int
	JsonOutput   bool
}

// Supported date formats for parsing
var dateFormats = []string{
	"02.01.2006",    // dd.mm.yyyy
	"02/01/2006",    // dd/mm/yyyy
	"02-01-2006",    // dd-mm-yyyy
	"2006-01-02",    // yyyy-mm-dd
	"2006/01/02",    // yyyy/01/02
	"2006.01.02",    // yyyy.mm.dd
	"01/02/2006",    // mm/dd/yyyy (US format)
	"01-02-2006",    // mm-dd-yyyy
	"02 Jan 2006",   // dd Mon yyyy
	"02 January 2006", // dd Month yyyy
}

func main() {
	config := parseArgs()

	// Check if file exists
	if _, err := os.Stat(config.Filename); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "Error: File '%s' not found.\n", config.Filename)
		os.Exit(1)
	}

	// Read and parse CSV
	trips, err := readTripsFromCSV(config.Filename)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading CSV: %v\n", err)
		os.Exit(1)
	}

	if len(trips) == 0 {
		fmt.Fprintf(os.Stderr, "Error: No valid trip data found in '%s'.\n", config.Filename)
		fmt.Fprintf(os.Stderr, "Expected format: Start date, End date (with or without header)\n")
		fmt.Fprintf(os.Stderr, "Supported date formats: dd.mm.yyyy, dd/mm/yyyy, yyyy-mm-dd, mm/dd/yyyy, etc.\n\n")
		os.Exit(1)
	}

	// Sort trips by end date
	sort.Slice(trips, func(i, j int) bool {
		return trips[i].End.Before(trips[j].End)
	})

	if config.JsonOutput {
		outputJSON(trips, config)
	} else {
		// Display per-trip analysis
		displayTripAnalysis(trips, config)

		// Display current/estimated status
		displayCurrentStatus(trips, config)
	}
}

// parseArgs parses command-line arguments
func parseArgs() Config {
	config := Config{
		WindowMonths: 12,
		AbsenceLimit: 180,
	}

	// Create a new FlagSet to allow flags after positional arguments
	fs := flag.NewFlagSet(os.Args[0], flag.ExitOnError)
	customDate := fs.String("date", "", "Use a specific date for calculation instead of today (format: dd.mm.yyyy)")
	windowMonths := fs.Int("window", 12, "Rolling window period in months")
	absenceLimit := fs.Int("limit", 180, "Maximum allowed absence days in window")
	jsonOutput := fs.Bool("json", false, "Output results as JSON")

	fs.Usage = func() {
		fmt.Fprintf(os.Stderr, "Error: CSV file argument is required.\n\n")
		fmt.Fprintf(os.Stderr, "Usage: %s <csv_file> [options]\n\n", os.Args[0])
		fmt.Fprintf(os.Stderr, "Options:\n")
		fmt.Fprintf(os.Stderr, "  --date <dd.mm.yyyy>   Use a specific date for calculation instead of today\n")
		fmt.Fprintf(os.Stderr, "  --window <months>     Rolling window period in months (default: 12)\n")
		fmt.Fprintf(os.Stderr, "  --limit <days>        Maximum allowed absence days in window (default: 180)\n\n")
		fmt.Fprintf(os.Stderr, "Examples:\n")
		fmt.Fprintf(os.Stderr, "  %s trips.csv\n", os.Args[0])
		fmt.Fprintf(os.Stderr, "  %s trips.csv --date 01.01.2026\n", os.Args[0])
		fmt.Fprintf(os.Stderr, "  %s trips.csv --window 24 --limit 365\n", os.Args[0])
		fmt.Fprintf(os.Stderr, "  %s trips.csv --date 01.01.2026 --window 6 --limit 90\n\n", os.Args[0])
	}

	// Manually separate filename and flags
	var filename string
	var flagArgs []string

	for i := 1; i < len(os.Args); i++ {
		arg := os.Args[i]
		if strings.HasPrefix(arg, "-") {
			flagArgs = append(flagArgs, arg)
			// Check if next arg is a flag value (doesn't start with -)
			if i+1 < len(os.Args) && !strings.HasPrefix(os.Args[i+1], "-") {
				i++
				flagArgs = append(flagArgs, os.Args[i])
			}
		} else if filename == "" {
			filename = arg
		}
	}

	// Parse flags
	fs.Parse(flagArgs)

	// Check for filename
	if filename == "" {
		fs.Usage()
		os.Exit(1)
	}

	config.Filename = filename
	config.CustomDate = *customDate
	config.WindowMonths = *windowMonths
	config.AbsenceLimit = *absenceLimit
	config.JsonOutput = *jsonOutput

	// Validate window and limit
	if config.WindowMonths <= 0 {
		fmt.Fprintf(os.Stderr, "Error: --window must be a positive number of months.\n")
		os.Exit(1)
	}
	if config.AbsenceLimit <= 0 {
		fmt.Fprintf(os.Stderr, "Error: --limit must be a positive number of days.\n")
		os.Exit(1)
	}

	return config
}

// parseDate attempts to parse a date string with multiple formats
func parseDate(dateStr string) (time.Time, error) {
	dateStr = strings.TrimSpace(dateStr)

	for _, format := range dateFormats {
		if t, err := time.Parse(format, dateStr); err == nil {
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("unable to parse date: %s", dateStr)
}

// isHeaderRow checks if a CSV row is likely a header
func isHeaderRow(row []string) bool {
	if len(row) < 2 {
		return false
	}

	// Check if first two cells contain common header keywords
	firstCell := strings.ToLower(strings.TrimSpace(row[0]))
	secondCell := strings.ToLower(strings.TrimSpace(row[1]))

	headerKeywords := []string{"start", "end", "begin", "from", "to", "departure", "arrival", "date"}

	for _, keyword := range headerKeywords {
		if strings.Contains(firstCell, keyword) || strings.Contains(secondCell, keyword) {
			return true
		}
	}

	// Check if we can parse the dates - if not, it's likely a header
	_, err1 := parseDate(row[0])
	_, err2 := parseDate(row[1])

	return err1 != nil || err2 != nil
}

// readTripsFromCSV reads trips from a CSV file
func readTripsFromCSV(filename string) ([]Trip, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	var trips []Trip
	firstRow := true

	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}

		if len(row) < 2 {
			continue
		}

		// Skip header row if detected
		if firstRow {
			firstRow = false
			if isHeaderRow(row) {
				continue
			}
		}

		startDate, err1 := parseDate(row[0])
		endDate, err2 := parseDate(row[1])

		if err1 != nil || err2 != nil {
			// Skip rows with invalid dates
			continue
		}

		// Calculate days (inclusive)
		days := int(endDate.Sub(startDate).Hours()/24) + 1

		trips = append(trips, Trip{
			Start: startDate,
			End:   endDate,
			Days:  days,
		})
	}

	return trips, nil
}

// addMonths adds months to a date
func addMonths(t time.Time, months int) time.Time {
	year, month, day := t.Date()
	month += time.Month(months)

	// Normalize year and month
	for month > 12 {
		month -= 12
		year++
	}
	for month < 1 {
		month += 12
		year--
	}

	// Handle day overflow (e.g., Jan 31 - 1 month = Dec 31, not Dec 30)
	maxDay := time.Date(year, month+1, 0, 0, 0, 0, 0, t.Location()).Day()
	if day > maxDay {
		day = maxDay
	}

	return time.Date(year, month, day, t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), t.Location())
}

// calculateDaysInWindow calculates total days in a rolling window ending on endDate
func calculateDaysInWindow(trips []Trip, windowStart, windowEnd time.Time) int {
	totalDays := 0

	for _, trip := range trips {
		// Check if trip overlaps with window
		if trip.End.Before(windowStart) || trip.Start.After(windowEnd) {
			continue
		}

		// Calculate overlap
		overlapStart := maxTime(trip.Start, windowStart)
		overlapEnd := minTime(trip.End, windowEnd)

		// Calculate days in overlap (inclusive)
		daysInOverlap := int(overlapEnd.Sub(overlapStart).Hours()/24) + 1

		totalDays += daysInOverlap
	}

	return totalDays
}

// maxTime returns the later of two times
func maxTime(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}

// minTime returns the earlier of two times
func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

// outputJSON outputs results as JSON
func outputJSON(trips []Trip, config Config) {
	type jsonTrip struct {
		Start        string `json:"start"`
		End          string `json:"end"`
		Days         int    `json:"days"`
		DaysInWindow int    `json:"daysInWindow"`
		DaysRemaining int   `json:"daysRemaining"`
	}

	type jsonStatus struct {
		TargetDate       string `json:"targetDate"`
		LastTripEnd      string `json:"lastTripEnd"`
		DaysSinceLastTrip int   `json:"daysSinceLastTrip"`
		WindowStart      string `json:"windowStart"`
		WindowEnd        string `json:"windowEnd"`
		TotalDaysOutside int    `json:"totalDaysOutside"`
		DaysRemaining    int    `json:"daysRemaining"`
		Status           string `json:"status"`
	}

	type jsonOutput struct {
		Config struct {
			WindowMonths int `json:"windowMonths"`
			AbsenceLimit int `json:"absenceLimit"`
		} `json:"config"`
		Trips  []jsonTrip `json:"trips"`
		Status jsonStatus `json:"status"`
	}

	var output jsonOutput
	output.Config.WindowMonths = config.WindowMonths
	output.Config.AbsenceLimit = config.AbsenceLimit

	// Build trip analysis
	for _, trip := range trips {
		windowStart := addMonths(trip.End, -config.WindowMonths)
		totalDaysInWindow := calculateDaysInWindow(trips, windowStart, trip.End)
		remainingDays := config.AbsenceLimit - totalDaysInWindow

		output.Trips = append(output.Trips, jsonTrip{
			Start:        trip.Start.Format("02.01.2006"),
			End:          trip.End.Format("02.01.2006"),
			Days:         trip.Days,
			DaysInWindow: totalDaysInWindow,
			DaysRemaining: remainingDays,
		})
	}

	// Build status
	var targetDate time.Time
	if config.CustomDate != "" {
		var err error
		targetDate, err = parseDate(config.CustomDate)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: Invalid date format for --date parameter.\n")
			os.Exit(1)
		}
	} else {
		targetDate = time.Now()
	}

	windowStart := addMonths(targetDate, -config.WindowMonths)
	lastTrip := trips[len(trips)-1]
	daysInUK := int(targetDate.Sub(lastTrip.End).Hours() / 24)
	totalDaysOutside := calculateDaysInWindow(trips, windowStart, targetDate)
	remainingDays := config.AbsenceLimit - totalDaysOutside
	warningThreshold := int(math.Min(30, math.Ceil(float64(config.AbsenceLimit)*0.15)))

	statusStr := "ok"
	if remainingDays < 0 {
		statusStr = "exceeded"
	} else if remainingDays < warningThreshold {
		statusStr = "caution"
	}

	output.Status = jsonStatus{
		TargetDate:       targetDate.Format("02.01.2006"),
		LastTripEnd:      lastTrip.End.Format("02.01.2006"),
		DaysSinceLastTrip: daysInUK,
		WindowStart:      windowStart.Format("02.01.2006"),
		WindowEnd:        targetDate.Format("02.01.2006"),
		TotalDaysOutside: totalDaysOutside,
		DaysRemaining:    remainingDays,
		Status:           statusStr,
	}

	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(output); err != nil {
		fmt.Fprintf(os.Stderr, "Error encoding JSON: %v\n", err)
		os.Exit(1)
	}
}

// displayTripAnalysis displays per-trip analysis
func displayTripAnalysis(trips []Trip, config Config) {
	fmt.Println()
	fmt.Println(strings.Repeat("=", 90))
	fmt.Printf("UK ABSENCE CALCULATOR - Rolling %d-Month Window Analysis\n", config.WindowMonths)
	fmt.Println(strings.Repeat("=", 90))
	fmt.Println()
	fmt.Printf("Allowed absence: %d days in any rolling %d-month period\n\n", config.AbsenceLimit, config.WindowMonths)
	fmt.Println(strings.Repeat("-", 90))
	fmt.Printf("%-12s | %-12s | %-6s | %-20s | %-12s\n",
		"Trip Start", "Trip End", "Days", fmt.Sprintf("Days in %dmo Window", config.WindowMonths), "Days Remaining")
	fmt.Println(strings.Repeat("-", 90))

	for _, trip := range trips {
		windowStart := addMonths(trip.End, -config.WindowMonths)
		totalDaysInWindow := calculateDaysInWindow(trips, windowStart, trip.End)
		remainingDays := config.AbsenceLimit - totalDaysInWindow

		fmt.Printf("%-12s | %-12s | %6d | %20d | %12d\n",
			trip.Start.Format("02.01.2006"),
			trip.End.Format("02.01.2006"),
			trip.Days,
			totalDaysInWindow,
			remainingDays)

		// Warning if over limit
		if remainingDays < 0 {
			fmt.Printf("%s ⚠️  WARNING: Exceeded %d-day limit by %d days!\n",
				strings.Repeat(" ", 12), config.AbsenceLimit, int(math.Abs(float64(remainingDays))))
		}
	}

	fmt.Println(strings.Repeat("-", 90))
	fmt.Printf("\nNote: The %d-month window ends on each trip's end date and starts %d months before.\n",
		config.WindowMonths, config.WindowMonths)
	fmt.Println("Days in window include all days from trips that overlap with that window.\n")
}

// displayCurrentStatus displays current or estimated status
func displayCurrentStatus(trips []Trip, config Config) {
	fmt.Println(strings.Repeat("=", 90))

	var targetDate time.Time
	var err error

	if config.CustomDate != "" {
		targetDate, err = parseDate(config.CustomDate)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: Invalid date format for --date parameter. Use format: dd.mm.yyyy\n")
			os.Exit(1)
		}
		fmt.Printf("ESTIMATED STATUS - As of %s\n", targetDate.Format("02.01.2006"))
	} else {
		targetDate = time.Now()
		fmt.Println("CURRENT STATUS - As of Today")
	}

	fmt.Println(strings.Repeat("=", 90))
	fmt.Println()

	windowStart := addMonths(targetDate, -config.WindowMonths)
	lastTrip := trips[len(trips)-1]
	daysInUK := int(targetDate.Sub(lastTrip.End).Hours() / 24)

	if config.CustomDate != "" {
		fmt.Printf("Estimated date: %s\n", targetDate.Format("02.01.2006"))
	} else {
		fmt.Printf("Today's date: %s\n", targetDate.Format("02.01.2006"))
	}
	fmt.Printf("Last trip ended: %s\n", lastTrip.End.Format("02.01.2006"))
	fmt.Printf("Days in UK since last trip: %d days\n", daysInUK)
	fmt.Printf("Rolling %d-month window: %s to %s\n\n",
		config.WindowMonths, windowStart.Format("02.01.2006"), targetDate.Format("02.01.2006"))

	totalDaysOutside := calculateDaysInWindow(trips, windowStart, targetDate)
	remainingDays := config.AbsenceLimit - totalDaysOutside

	// Calculate warning threshold (15% of limit or 30 days, whichever is smaller)
	warningThreshold := int(math.Min(30, math.Ceil(float64(config.AbsenceLimit)*0.15)))

	fmt.Println(strings.Repeat("-", 90))
	fmt.Printf("Days spent outside UK (last %d months): %d days\n", config.WindowMonths, totalDaysOutside)
	fmt.Printf("Days remaining (out of %d):            %d days\n", config.AbsenceLimit, remainingDays)
	fmt.Println(strings.Repeat("-", 90))

	if remainingDays < 0 {
		fmt.Printf("\n⚠️  WARNING: You have EXCEEDED the %d-day limit by %d days!\n",
			config.AbsenceLimit, int(math.Abs(float64(remainingDays))))
	} else if remainingDays < warningThreshold {
		fmt.Printf("\n⚠️  CAUTION: You have less than %d days remaining in your allowance.\n", warningThreshold)
	} else {
		fmt.Printf("\n✓ You are within the %d-day limit.\n", config.AbsenceLimit)
	}

	fmt.Println()
}
