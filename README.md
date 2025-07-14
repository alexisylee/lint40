# lint40 README

A C linter enforcing course coding standards with contract generation and dual-mode checking

## Features

**Two Modes**: Draft mode (basic checks) and Review mode (submission-ready validation)<br>
**Style Enforcement**: Curly braces spacing, 8-space indentation, operator spacing<br>
**Contract Generation**: Auto-generate function and file headers with templates that include all necessary components and notes (for unexpected exits, memory allocation, etc)<br>
**Code Quality Checks**: Prevent poor practices like global variables, excessive nesting, and style violations


## Usage

1. Install the extension
2. Open any `.c` file
3. Click the status bar to toggle between Draft/Review modes
4. Use `Ctrl+Shift+P` → "Generate Function Contract", "Generate File Header", or "Generate Struct Documentation" for templates

<br><br/>
<div align="left">


<img src="images/status.png" alt="Status Bar" style="max-width: 400px; height: auto;"/>
<p><em>Status Bar Integration</em></p>

<br/>

<img src="images/d.png" alt="Linting Example in Draft Mode" style="max-width: 600px; height: auto;"/>
<p><em>Linting Example in Draft Mode</em></p>

<br/>

<img src="images/review.png" alt="Linting Example in Review Mode" style="max-width: 800px; height: auto;"/>
<p><em>Linting Example in Review Mode</em></p>

<br/>


<img src="images/contract.png" alt="Documentation Template Example" style="max-width: 300px; height: auto;"/>
<p><em>Documentation Template Example</em></p>

</div>

## Requirements

- VS Code 1.101.0 or higher
- C files (.c extension)

### 0.0.3
Description Fixes
