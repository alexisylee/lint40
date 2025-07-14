# lint40 README

A Comprehensive C linter enforcing course coding standards with contract generation and dual-mode checking

## Features

✅ **Two Modes**: Draft mode (basic checks) and Review mode (submission-ready validation)
✅ **Style Enforcement**: Curly braces spacing, 8-space indentation, operator spacing
✅ **Contract Generation**: Auto-generate function and file headers with templates
✅ **Code Quality Checks**: Prevent poor practices like global variables, excessive nesting, and style violations

## Usage

1. Install the extension
2. Open any `.c` file
3. Click the status bar to toggle between Draft/Review modes
4. Use `Ctrl+Shift+P` → "Generate Function Contract", "Generate File Header", or "Generate Struct Documentation" for templates

## Screenshots

![Status Bar](images/status.jpg)
![Linting Example in Draft Mode](images/d.png)
![Linting Example in Review Mode](images/review.png)
![Documentation Templace Example](images/template.png)

## Requirements

- VS Code 1.101.0 or higher
- C files (.c extension)

### 1.0.0

Initial release
