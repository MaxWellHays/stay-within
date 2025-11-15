# Stay Within - Cross-platform Build Makefile

# Binary name
BINARY_NAME=stay-within
BUILD_DIR=build

# Version info (optional, can be overridden)
VERSION?=1.0.0

# Build flags
LDFLAGS=-ldflags "-s -w"

.PHONY: all clean build-macos-arm build-macos-intel build-windows build-linux test

# Default target: build all platforms
all: clean build-macos-arm build-macos-intel build-windows

# Clean build directory
clean:
	@echo "Cleaning build directory..."
	@rm -rf $(BUILD_DIR)
	@mkdir -p $(BUILD_DIR)

# Build for macOS Apple Silicon (M1/M2/M3)
build-macos-arm:
	@echo "Building for macOS Apple Silicon (ARM64)..."
	@GOOS=darwin GOARCH=arm64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-macos-arm64 .
	@echo "✓ Built: $(BUILD_DIR)/$(BINARY_NAME)-macos-arm64"

# Build for macOS Intel
build-macos-intel:
	@echo "Building for macOS Intel (AMD64)..."
	@GOOS=darwin GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-macos-amd64 .
	@echo "✓ Built: $(BUILD_DIR)/$(BINARY_NAME)-macos-amd64"

# Build for Windows 64-bit
build-windows:
	@echo "Building for Windows 64-bit..."
	@GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-windows-amd64.exe .
	@echo "✓ Built: $(BUILD_DIR)/$(BINARY_NAME)-windows-amd64.exe"

# Build for Linux (bonus)
build-linux:
	@echo "Building for Linux 64-bit..."
	@GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 .
	@echo "✓ Built: $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64"

# Build for current platform only
build:
	@echo "Building for current platform..."
	@go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) .
	@echo "✓ Built: $(BUILD_DIR)/$(BINARY_NAME)"

# Run tests
test:
	@echo "Running tests..."
	@go test -v ./...

# Install dependencies
deps:
	@echo "Installing dependencies..."
	@go mod tidy

# Run the application (for development)
run:
	@go run . trips.csv

# Display build information
info:
	@echo "Build Information:"
	@echo "  Binary Name: $(BINARY_NAME)"
	@echo "  Build Dir:   $(BUILD_DIR)"
	@echo "  Version:     $(VERSION)"
	@echo ""
	@echo "Available targets:"
	@echo "  make all              - Build for all platforms (macOS ARM64, macOS Intel, Windows)"
	@echo "  make build-macos-arm  - Build for macOS Apple Silicon"
	@echo "  make build-macos-intel - Build for macOS Intel"
	@echo "  make build-windows    - Build for Windows 64-bit"
	@echo "  make build-linux      - Build for Linux 64-bit"
	@echo "  make build            - Build for current platform"
	@echo "  make clean            - Clean build directory"
	@echo "  make test             - Run tests"
	@echo "  make run              - Run the application"

# Help target
help: info
