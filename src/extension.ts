import * as vscode from 'vscode';

export class Lint40Extension {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private statusBarItem: vscode.StatusBarItem;
    private isEnabled: boolean = true;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('lint40');
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    }

    public activate(context: vscode.ExtensionContext) {
        // Register the diagnostic collection
        context.subscriptions.push(this.diagnosticCollection);

        // Setup status bar
        this.setupStatusBar();
        context.subscriptions.push(this.statusBarItem);

        // Register toggle command
        const toggleCommand = vscode.commands.registerCommand('lint40.toggle', () => {
            this.toggle();
        });
        context.subscriptions.push(toggleCommand);

        // Listen for document changes
        const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === 'c' && this.isEnabled) {
                this.lintDocument(event.document);
            }
        });

        // Listen for active editor changes
        const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.languageId === 'c' && this.isEnabled) {
                this.lintDocument(editor.document);
            }
        });

        context.subscriptions.push(onDidChangeTextDocument, onDidChangeActiveTextEditor);

        if (vscode.window.activeTextEditor?.document.languageId === 'c' && this.isEnabled) {
            this.lintDocument(vscode.window.activeTextEditor.document);
        }
    }

    private setupStatusBar() {
        this.statusBarItem.command = 'lint40.toggle';
        this.updateStatusBar();
        this.statusBarItem.show();
    }

    private updateStatusBar() {
        this.statusBarItem.text = `lint40: ${this.isEnabled ? '$(check)' : '$(x)'}`;
        this.statusBarItem.tooltip = `lint40 is ${this.isEnabled ? 'enabled' : 'disabled'}. Click to toggle.`;
    }

    private toggle() {
        this.isEnabled = !this.isEnabled;
        this.updateStatusBar();

        if (this.isEnabled) {
            vscode.workspace.textDocuments.forEach(doc => {
                if (doc.languageId === 'c') {
                    this.lintDocument(doc);
                }
            });
        } else {
            this.diagnosticCollection.clear();
        }
    }

    private stripComments(line: string): string {
        // Remove single-line comments
        let cleaned = line.replace(/\/\/.*$/, '');
        // Remove simple single-line block comments
        cleaned = cleaned.replace(/\/\*.*?\*\//g, '');
        return cleaned;
    }

    private lintDocument(document: vscode.TextDocument) {
        if (!this.isEnabled) {
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        let prevLineEnds = true;
        
        lines.forEach((line, lineIndex) => {
            const trimmed = this.stripComments(line.trim());
            const isEmpty = trimmed === "";
            
            if (isEmpty) {
                prevLineEnds = true;
                return;
            }
            
            
            if (prevLineEnds) {
                const leadingSpaces = line.match(/^ +/);
                if (leadingSpaces && leadingSpaces[0].length % 8 !== 0) {
                    const range = new vscode.Range(lineIndex, 0, lineIndex, leadingSpaces[0].length);
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `Each level of indentation must be eight (8) characters`,
                        vscode.DiagnosticSeverity.Information
                    );
                    diagnostic.code = 'indent-length';
                    diagnostic.source = 'lint40';
                    diagnostics.push(diagnostic);
                }
            }

            if (line.length > 80) {
                const range = new vscode.Range(lineIndex, 80, lineIndex, line.length);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Line exceeds 80 characters (${line.length} chars)`,
                    vscode.DiagnosticSeverity.Information
                );
                diagnostic.code = 'line-length';
                diagnostic.source = 'lint40';
                diagnostics.push(diagnostic);
            }

            if (line.includes('\t')) {
                const tabIndex = line.indexOf('\t');
                const range = new vscode.Range(lineIndex, tabIndex, lineIndex, tabIndex + 1);
                const diagnostic = new vscode.Diagnostic (
                    range,
                    `Your code must not contain tab characters.`,
                    vscode.DiagnosticSeverity.Information
                );
                diagnostic.code = 'tab';
                diagnostic.source = 'lint40';
                diagnostics.push(diagnostic);
            }

            const cleanLine = this.stripComments(line);
            this.checkOperatorSpacing(cleanLine, line, lineIndex, diagnostics);
            this.checkPointerStyle(cleanLine, lineIndex, diagnostics);
            this.checkCommaSpacing(cleanLine, lineIndex, diagnostics);
            this.checkForLoopSpacing(cleanLine, line, lineIndex, diagnostics);
            this.checkKeywordSpacing(cleanLine, lineIndex, diagnostics);
            this.checkBraceSpacing(cleanLine, lineIndex, diagnostics);

            const cleanTrimmed = cleanLine.trim();
            prevLineEnds = /[;{})]\s*$/.test(cleanTrimmed);
        });

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private checkOperatorSpacing(cleanLine: string, originalLine: string, lineIndex: number, diagnostics: vscode.Diagnostic[]) {
        const operatorRegex = /(\+\+|--|\+=|-=|\*=|\/=|==|!=|<=|>=|&&|\|\||=|<|>|\+|-|\*|\/|%|!)/g;
        let match;
        
        while ((match = operatorRegex.exec(cleanLine)) !== null) {
            const operator = match[1];
            const operatorStart = match.index;
            const operatorEnd = match.index + operator.length;

            // skip includes
            if ((operator === "<" || operator === ">") && originalLine.trim().startsWith("#include")) {
                continue;
            }

            if (['++', '--', '+=', '-=', '*=', '/='].includes(operator)) {
                continue;
            }

            if (operator === "!" || 
                (operator === "+" && (operatorStart === 0 || /[\(\s,=]/.test(cleanLine[operatorStart - 1]))) ||
                (operator === "-" && (operatorStart === 0 || /[\(\s,=]/.test(cleanLine[operatorStart - 1])))) {
                continue;
            }

            const hasSpaceBefore = operatorStart > 0 && cleanLine[operatorStart - 1] === ' ';
            const hasSpaceAfter = operatorEnd < cleanLine.length && cleanLine[operatorEnd] === ' ';
            
            if (operator === "*") {
                const beforeAsterisk = cleanLine.substring(0, operatorStart);
                if (/\b(int|char|float|double|FILE|void|size_t)\s+$/.test(beforeAsterisk)) {
                    continue; 
                }
            }

            // Flag if missing spaces on either side
            if (!hasSpaceBefore || !hasSpaceAfter) {
                const range = new vscode.Range(lineIndex, operatorStart, lineIndex, operatorEnd);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Operator '${operator}' should have spaces on both sides`,
                    vscode.DiagnosticSeverity.Information
                );
                diagnostic.code = 'operator-spacing';
                diagnostic.source = 'lint40';
                diagnostics.push(diagnostic);
            }
        }
    }

    private checkPointerStyle(cleanLine: string, lineIndex: number, diagnostics: vscode.Diagnostic[]) {
        const badPointerRegex = /\b(int|char|float|double|FILE|void|size_t)\*/g;
        let pointerMatch;
        
        while ((pointerMatch = badPointerRegex.exec(cleanLine)) !== null) {
            const matchStart = pointerMatch.index;
            const matchEnd = matchStart + pointerMatch[0].length;

            const range = new vscode.Range(lineIndex, matchStart, lineIndex, matchEnd);
            const diagnostic = new vscode.Diagnostic(
                range,
                `Declare pointers the Linux way: place the asterisk with the variable, not the type.`,
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = 'pointer-style';
            diagnostic.source = 'lint40';
            diagnostics.push(diagnostic);
        }
    }

    private checkCommaSpacing(cleanLine: string, lineIndex: number, diagnostics: vscode.Diagnostic[]) {
        const commaRegex = /,(?![\s\n])/g; 
        let commaMatch;
        
        while ((commaMatch = commaRegex.exec(cleanLine)) !== null && commaMatch.index + 1 !== cleanLine.length) {
            const commaStart = commaMatch.index;
            const commaEnd = commaStart + 1;

            const range = new vscode.Range(lineIndex, commaStart, lineIndex, commaEnd);
            const diagnostic = new vscode.Diagnostic(
                range,
                `Put a space after every comma.`,
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = 'comma-spacing';
            diagnostic.source = 'lint40';
            diagnostics.push(diagnostic);
        }
    }

    private checkForLoopSpacing(cleanLine: string, originalLine: string, lineIndex: number, diagnostics: vscode.Diagnostic[]) {
        const forLoopRegex = /for\s*\(([^)]*)\)/g;
        let semiMatch;
        
        while ((semiMatch = forLoopRegex.exec(cleanLine)) !== null) {
            const insideParens = semiMatch[1];
            const forStart = semiMatch.index;
            const parensStart = forStart + semiMatch[0].indexOf('(');

            let semiCount = 0;
            for (let i = 0; i < insideParens.length; i++) {
                if (insideParens[i] === ';') {
                    semiCount++;
                    const nextChar = insideParens[i + 1];
                    if (nextChar && nextChar !== ' ' && nextChar !== ')') {
                        const absoluteSemiPos = parensStart + 1 + i;
                        const range = new vscode.Range(lineIndex, absoluteSemiPos, lineIndex, absoluteSemiPos + 1);
                        const diagnostic = new vscode.Diagnostic(
                            range,
                            `Put a space after semicolons in 'for' loop headers.`,
                            vscode.DiagnosticSeverity.Information
                        );
                        diagnostic.code = 'for-semicolon-spacing';
                        diagnostic.source = 'lint40';
                        diagnostics.push(diagnostic);
                    }
                }
            }
        }
    }

    private checkKeywordSpacing(cleanLine: string, lineIndex: number, diagnostics: vscode.Diagnostic[]) {
        const spacingRegex = /\b(if|for|while)\(/g;
        let spaceMatch;
        
        while ((spaceMatch = spacingRegex.exec(cleanLine)) !== null) {
            const keyword = spaceMatch[1];
            const start = spaceMatch.index;

            const range = new vscode.Range(lineIndex, start, lineIndex, start + keyword.length + 1);
            const diagnostic = new vscode.Diagnostic(
                range,
                `Put a space between '${keyword}' and '('.`,
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = 'keyword-spacing';
            diagnostic.source = 'lint40';
            diagnostics.push(diagnostic);
        }
    }

    private checkBraceSpacing(cleanLine: string, lineIndex: number, diagnostics: vscode.Diagnostic[]) {
        const braceRegex = /\)\{/g;
        let braceMatch;
        
        while ((braceMatch = braceRegex.exec(cleanLine)) !== null) {
            const start = braceMatch.index + 1;
            const range = new vscode.Range(lineIndex, start, lineIndex, start + 1);
            const diagnostic = new vscode.Diagnostic(
                range,
                `Put a space before '{'.`,
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = 'braces-spacing';
            diagnostic.source = 'lint40';
            diagnostics.push(diagnostic);
        }
    }

    public dispose() {
        this.diagnosticCollection.dispose();
        this.statusBarItem.dispose();
    }

    // For testing
    public runLint(document: vscode.TextDocument) {
        this.lintDocument(document);
    }
}

// Extension activation function
export function activate(context: vscode.ExtensionContext) {
    const lint40 = new Lint40Extension();
    lint40.activate(context);
}

export function deactivate() {
    // Extension cleanup happens automatically via context.subscriptions
}