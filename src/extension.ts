import * as vscode from 'vscode';

const Parser = require('tree-sitter');
const C = require('tree-sitter-c');

type ParserType = typeof Parser;
type TreeType = any; 

export class Lint40Extension {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private statusBarItem: vscode.StatusBarItem;
    private isEnabled: boolean = true;
    private parser: any;
    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('lint40');
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.parser = new Parser();
        this.parser.setLanguage(C);
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
        // try {
        // console.log('Starting lintDocument for:', document.uri.toString());
        
        // const diagnostics: vscode.Diagnostic[] = [];
        // const text = document.getText();
        
    //     if (!text || text.trim().length === 0) {
    //         console.log('Empty document, skipping');
    //         this.diagnosticCollection.set(document.uri, []);
    //         return;
    //     }
        
    //     const tree = this.parser.parse(text);
        
    //     if (!tree || !tree.rootNode) {
    //         console.error('Failed to parse document');
    //         return;
    //     }
        
    //     console.log('Parse successful, checking operators...');
        
    //     this.checkOperatorSpacing(tree, document, diagnostics);
    //     this.checkBraceRules(tree, document, diagnostics);
    //     this.checkBraceSpacing(text, diagnostics);
    //     this.checkLineLength(text, diagnostics);
    //     this.checkBooleanComparisons(text, diagnostics, document);
    //     this.checkCommentStyle(text, diagnostics);
        
    //     this.diagnosticCollection.set(document.uri, diagnostics);
        
    // } catch (error) {
    //     console.error('Error in lintDocument:', error);
    //     this.diagnosticCollection.set(document.uri, []);
    // }
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        let prevLineEnds = true;
        
        const tree = this.parser.parse(text);
        this.checkOperatorSpacing(tree, document, diagnostics);
        this.checkBraceRules(tree, document, diagnostics);
        
        this.checkLineLength(text, diagnostics);
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
            this.checkPointerStyle(cleanLine, lineIndex, diagnostics);
            this.checkCommentStyle(line, lineIndex, diagnostics);
            this.checkBraceSpacing(cleanLine, lineIndex, diagnostics);
            this.checkCommaSpacing(cleanLine, lineIndex, diagnostics);
            this.checkForLoopSpacing(cleanLine, line, lineIndex, diagnostics);
            this.checkKeywordSpacing(cleanLine, lineIndex, diagnostics); // check if redundant
            this.checkBooleanComparisons(cleanLine, lineIndex, diagnostics);

            const cleanTrimmed = cleanLine.trim();
            prevLineEnds = /[;{})]\s*$/.test(cleanTrimmed);
        });

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private checkOperatorSpacing(tree: any, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const text = document.getText();
        
        const queries = [
            { name: 'init_declarator', query: '(init_declarator) @decl' },           // int x = 5;
            { name: 'assignment_expression', query: '(assignment_expression) @assign' }, // x = 5;
            { name: 'binary_expression', query: '(binary_expression) @binary' },        // x + y, a < b, etc.
            { name: 'conditional_expression', query: '(conditional_expression) @ternary' } // x ? y : z
        ];
        
        for (const queryInfo of queries) {
            console.log(`Checking ${queryInfo.name}...`);
            
            const query = new Parser.Query(C, queryInfo.query);
            const captures = query.captures(tree.rootNode);
            
            console.log(`Found ${queryInfo.name}:`, captures ? captures.length : 'none');
            
            for (const capture of captures) {
                console.log(`${queryInfo.name} text:`, capture.node.text);
                
                this.checkOperatorsInNode(capture.node, text, document, diagnostics);
            }
        }
    }

    private checkOperatorsInNode(node: any, text: string, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const operatorsNeedingSpaces = ['=', '+', '-', '*', '/', '%', '<', '>', '<=', '>=', '==', '!=', '&&', '||', '?', ':'];
        
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (!child) continue;
            
            const operatorText = child.text;
            
            if (this.shouldSkipOperator(child, operatorText, text)) {
                continue;
            }
            
            if (operatorsNeedingSpaces.includes(operatorText)) {
                console.log('Found operator:', operatorText);
                
                const operatorStart = this.positionToOffset(text, child.startPosition);
                const operatorEnd = this.positionToOffset(text, child.endPosition);
                
                const hasSpaceBefore = operatorStart > 0 && text[operatorStart - 1] === ' ';
                const hasSpaceAfter = operatorEnd < text.length && text[operatorEnd] === ' ';
                
                console.log(`Operator '${operatorText}' spacing - before:`, hasSpaceBefore, 'after:', hasSpaceAfter);
                
                if (!hasSpaceBefore || !hasSpaceAfter) {
                    const range = new vscode.Range(
                        document.positionAt(operatorStart),
                        document.positionAt(operatorEnd)
                    );
                    
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `Operator '${operatorText}' should have spaces on both sides`,
                        vscode.DiagnosticSeverity.Information
                    );
                    diagnostic.code = 'operator-spacing';
                    diagnostic.source = 'lint40';
                    diagnostics.push(diagnostic);
                }
            }
        }
    }

    private shouldSkipOperator(operatorNode: any, operatorText: string, text: string): boolean {
        if (['++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='].includes(operatorText)) {
            return true;
        }
        
        const parent = operatorNode.parent;
        if (parent?.type === 'unary_expression' && ['!', '+', '-'].includes(operatorText)) {
            return true;
        }
        
        if ((operatorText === '<' || operatorText === '>')) {
            let currentNode = operatorNode.parent;
            while (currentNode) {
                if (currentNode.type === 'preproc_include') {
                    return true;
                }
                currentNode = currentNode.parent;
            }
        }
        
        if (operatorText === '*') {
            let currentNode = operatorNode.parent;
            while (currentNode) {
                if (currentNode.type === 'pointer_declarator' || 
                    currentNode.type === 'parameter_declaration' || 
                    currentNode.type === 'declaration') {
                    return true;
                }
                currentNode = currentNode.parent;
            }
        }
        
        return false;
    }
    private checkBraceRules(tree: any, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const text = document.getText();
        
        const queries = [
            { name: 'function', query: '(function_definition) @func' },
            { name: 'control', query: '[(if_statement) (for_statement) (while_statement) (do_statement)] @ctrl' }
        ];
        
        for (const queryInfo of queries) {
            const query = new Parser.Query(C, queryInfo.query);
            const captures = query.captures(tree.rootNode);
            
            for (const capture of captures) {
                if (queryInfo.name === 'function') {
                    this.checkFunctionBraces(capture.node, text, document, diagnostics);
                } else {
                    this.checkControlBraces(capture.node, text, document, diagnostics);
                }
            }
        }
    }

    private checkFunctionBraces(node: any, text: string, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const body = this.findChildByType(node, 'compound_statement');
        if (!body) return;

        const funcLine = node.startPosition.row;
        const bracePos = body.startPosition;

        if (funcLine === bracePos.row) {
            const braceOffset = this.positionToOffset(text, bracePos);
            const range = new vscode.Range(
                document.positionAt(braceOffset),
                document.positionAt(braceOffset + 1)
            );
            
            const diagnostic = new vscode.Diagnostic(
                range,
                `Function opening brace should be on its own line (Linus style)`,
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = 'function-brace-style';
            diagnostic.source = 'lint40';
            diagnostics.push(diagnostic);
        }
    }

    private checkControlBraces(node: any, text: string, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const body = this.findChildByType(node, 'compound_statement');
        // no braces
        if (!body) {
            const ctrlOffset = this.positionToOffset(text, node.startPosition);
            const range = new vscode.Range(
                document.positionAt(ctrlOffset),
                document.positionAt(ctrlOffset + node.text.length)
            );
            
            const diagnostic = new vscode.Diagnostic(
                range,
                `Always use curly braces for control structures, even single statements`,
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = 'mandatory-braces';
            diagnostic.source = 'lint40';
            diagnostics.push(diagnostic);
            return;
        }

        const ctrlLine = node.startPosition.row;
        const bracePosition = body.startPosition;

        if (bracePosition.row !== ctrlLine) {
            const braceOffset = this.positionToOffset(text, bracePosition);
            const range = new vscode.Range(
                document.positionAt(braceOffset),
                document.positionAt(braceOffset + 1)
            );
            
            const diagnostic = new vscode.Diagnostic(
                range,
                `Control structure opening brace should be on the same line`,
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = 'control-brace-newline';
            diagnostic.source = 'lint40';
            diagnostics.push(diagnostic);
        } else {
            const braceOffset = this.positionToOffset(text, bracePosition);
            if (braceOffset > 0 && text[braceOffset - 1] !== ' ') {
                const range = new vscode.Range(
                    document.positionAt(braceOffset),
                    document.positionAt(braceOffset + 1)
                );
                
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Put a space before '{'`,
                    vscode.DiagnosticSeverity.Information
                );
                diagnostic.code = 'control-brace-spacing';
                diagnostic.source = 'lint40';
                diagnostics.push(diagnostic);
            }
        }
    }


    private findChildByType(node: any, type: string): any {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child && child.type === type) {
                return child;
            }
        }
        return null;
    }

    // convert tree-sitter position to string offset
    private positionToOffset(text: string, position: any): number {
        const lines = text.split('\n');
        let offset = 0;
        
        for (let i = 0; i < position.row; i++) {
            offset += lines[i].length + 1; // +1 for newline char
        }
        
        offset += position.column;
        return offset;
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
    private checkCommentStyle(line: string, lineIndex: number, diagnostics: vscode.Diagnostic[]) {
        const singleLineCommentRegex = /\/\//g;
        let match;

        while ((match = singleLineCommentRegex.exec(line)) !== null) {
            const range = new vscode.Range(lineIndex, match.index, lineIndex, match.index + 2);
            const diagnostic = new vscode.Diagnostic(
                range,
                `Replace // with /* */ comments. Check for commented-out code.`,
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = 'comment-style';
            diagnostic.source = 'lint40';
            diagnostics.push(diagnostic);
        }
    }
    private checkBraceSpacing(line: string, lineIndex: number, diagnostics: vscode.Diagnostic[]) {
        const spaceAfterOpenRegex = /\(\s+\S/g;
        let match;
        
        while ((match = spaceAfterOpenRegex.exec(line)) !== null) {
            const range = new vscode.Range(lineIndex, match.index, lineIndex, match.index + match[0].length);
            const diagnostic = new vscode.Diagnostic(
                range,
                `Remove space immediately after (`,
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = 'paren-spacing-after';
            diagnostic.source = 'lint40';
            diagnostics.push(diagnostic);
        }

        const spaceBeforeCloseRegex = /\S\s+\)/g;
        while ((match = spaceBeforeCloseRegex.exec(line)) !== null) {
            const range = new vscode.Range(lineIndex, match.index, lineIndex, match.index + match[0].length);
            const diagnostic = new vscode.Diagnostic(
                range,
                `Remove space immediately before )`,
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = 'paren-spacing-before';
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

    

    private checkBooleanComparisons(line: string, lineIndex: number, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        const boolComparisonRegex = /(\w+)\s*(==|!=)\s*(true|false)/g;
        let match;
        
        while ((match = boolComparisonRegex.exec(line)) !== null) {
            const varName = match[1];
            const operator = match[2];
            const boolValue = match[3];
            
            let suggestion;
            if ((operator === '==' && boolValue === 'false') || (operator === '!=' && boolValue === 'true')) {
                suggestion = `!${varName}`;
            } else if ((operator === '==' && boolValue === 'true') || (operator === '!=' && boolValue === 'false')) {
                suggestion = varName;
            }
            
            const range = new vscode.Range(lineIndex, match.index, lineIndex, match.index + match[0].length);
            const diagnostic = new vscode.Diagnostic(
                range,
                `Simplify boolean check: use '${suggestion}' instead of '${match[0]}'`,
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = 'boolean-comparison';
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