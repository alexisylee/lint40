import * as vscode from 'vscode';
import { ContractGenerator } from './contractGenerator';

const Parser = require('tree-sitter');
const C = require('tree-sitter-c');

type ParserType = typeof Parser;
type TreeType = any; 

enum LintMode {
    OFF = 'off',
    DRAFT = 'draft', 
    REVIEW = 'review'
}

export class Lint40Extension {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private statusBarItem: vscode.StatusBarItem;
    private currentMode : LintMode = LintMode.DRAFT;
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
        if (event.document.languageId === 'c' && this.currentMode !== LintMode.OFF) {
            this.lintDocument(event.document);
        }
        });

        // Listen for active editor changes
        const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.languageId === 'c' && this.currentMode !== LintMode.OFF) {
                this.lintDocument(editor.document);
            }
        });

        context.subscriptions.push(onDidChangeTextDocument, onDidChangeActiveTextEditor);

        if (vscode.window.activeTextEditor?.document.languageId === 'c' && this.currentMode !== LintMode.OFF) {
            this.lintDocument(vscode.window.activeTextEditor.document);
        }

        const generateFileHeaderCommand = vscode.commands.registerCommand('lint40.generateFileHeader', () => {
        if (vscode.window.activeTextEditor?.document.languageId === 'c') {
                ContractGenerator.generateFileHeader(vscode.window.activeTextEditor.document);
            }
        });
        context.subscriptions.push(generateFileHeaderCommand);
        
        const generateFuncContract = vscode.commands.registerCommand('lint40.generateFuncContract', () => {
            if (vscode.window.activeTextEditor?.document.languageId === 'c') {
                const text = vscode.window.activeTextEditor.document.getText();
                const tree = this.parser.parse(text);
                ContractGenerator.generateFuncContract(tree, vscode.window.activeTextEditor.document);
            }
        });
        context.subscriptions.push(generateFuncContract);

        const generateStructDoc = vscode.commands.registerCommand('lint40.generateStructDoc', () => {
            if (vscode.window.activeTextEditor?.document.languageId === 'c') {
                const text = vscode.window.activeTextEditor.document.getText();
                const tree = this.parser.parse(text);
                ContractGenerator.generateStructDoc(tree, vscode.window.activeTextEditor.document);
            }
        });
        context.subscriptions.push(generateStructDoc);
    }

    private setupStatusBar() {
        this.statusBarItem.command = 'lint40.toggle';
        this.updateStatusBar();
        this.statusBarItem.show();
    }

    // private updateStatusBar() {
    //     const enabledText = this.isEnabled ? '$(check)' : '$(x)';
    //     const modeText = this.isDraftMode ? 'Draft' : 'Review';
    //     this.statusBarItem.text = `lint40: ${enabledText} | ${modeText}`;
    //     this.statusBarItem.tooltip = `lint40 is ${this.isEnabled ? 'enabled' : 'disabled'}. Mode: ${modeText}. Click to toggle.`;
    // }
    private updateStatusBar() {
    let text: string;
    let tooltip: string;
    
    switch (this.currentMode) {
        case LintMode.DRAFT:
            text = 'lint40: $(check) Draft';
            tooltip = 'lint40 Draft Mode - basic checks only. Click to switch to Review.';
            break;
        case LintMode.REVIEW:
            text = 'lint40: $(check) Review';
            tooltip = 'lint40 Review Mode - all checks enabled. Click to turn off.';
            break;
        case LintMode.OFF:
            text = 'lint40: $(x) Off';
            tooltip = 'lint40 is disabled. Click to enable Draft mode.';
            break;
    }
    
    this.statusBarItem.text = text;
    this.statusBarItem.tooltip = tooltip;
}

    private toggle() {
        switch (this.currentMode) {
        case LintMode.DRAFT:
            this.currentMode = LintMode.REVIEW;
            break;
        case LintMode.REVIEW:
            this.currentMode = LintMode.OFF;
            break;
        case LintMode.OFF:
            this.currentMode = LintMode.DRAFT;
            break;
        }
        
        this.updateStatusBar();
        
        if (this.currentMode !== LintMode.OFF) {
            vscode.workspace.textDocuments.forEach(doc => {
                if (doc.languageId === 'c') {
                    this.lintDocument(doc);
                }
            });
        } else {
            this.diagnosticCollection.clear();
        }
    }

    // private toggleMode() {
    //     this.isDraftMode = !this.isDraftMode;
    //     this.updateStatusBar();
        
    //     vscode.workspace.textDocuments.forEach(doc => {
    //         if (doc.languageId === 'c') {
    //             this.lintDocument(doc);
    //         }
    //     });
    // }

    private stripComments(line: string): string {
        let cleaned = line.replace(/\/\/.*$/, '');
        cleaned = cleaned.replace(/\/\*.*?\*\//g, '');
        cleaned = cleaned.replace(/^\s*\*.*$/, '');
        return cleaned;
    }

    private lintDocument(document: vscode.TextDocument) {
        if (this.currentMode === LintMode.OFF) {
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        let prevLineEnds = true;
        
        const tree = this.parser.parse(text);

        if (this.currentMode === LintMode.REVIEW) {
            const trimmedlines = text.trim().split('\n');
            if (!text.trim().startsWith(`/*`) && trimmedlines.length > 0) {
                const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, trimmedlines[0].length),
                `This file is missing a header. Add documentation above.`,
                vscode.DiagnosticSeverity.Information
                );
                diagnostic.code = 'documentation';
                diagnostic.source = 'lint40';
                diagnostics.push(diagnostic);
                
                
            }
            this.checkDocumentation(tree, document, diagnostics);
            this.checkNestingDepth(tree, document, diagnostics);
        }

        this.checkOperatorSpacing(tree, document, diagnostics);
        this.checkBraceRules(tree, document, diagnostics);
        // this.checkGlobalVars(tree, document, diagnostics);
        
    
        lines.forEach((line, lineIndex) => {
            const cleanLine = this.stripComments(line);
            
            if (this.currentMode === LintMode.REVIEW) {
                const onlyWhitespaceRegex = /^\s+$/;
                if (line.match(onlyWhitespaceRegex)) {
                    const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `Blank lines should not contain spaces or tabs`,
                        vscode.DiagnosticSeverity.Information
                    );
                    diagnostic.code = 'blank-line-spaces';
                    diagnostic.source = 'lint40';
                    diagnostics.push(diagnostic);
                }
                this.checkCommentStyle(line, lineIndex, diagnostics);
                this.checkBooleanComparisons(cleanLine, lineIndex, diagnostics);
                this.checkTrailing(line, lineIndex, diagnostics);
                // more to come...
            }
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

            const tabRegex = /\t/g;
            let match;
            while ((match = tabRegex.exec(line)) !== null) {
                const range = new vscode.Range(lineIndex, match.index, lineIndex, match.index + 1);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Your code must not contain tab characters.`,
                    vscode.DiagnosticSeverity.Information
                );
                diagnostic.code = 'tab';
                diagnostic.source = 'lint40';
                diagnostics.push(diagnostic);
            }

            this.checkPointerStyle(cleanLine, lineIndex, diagnostics);
            this.checkBraceSpacing(cleanLine, lineIndex, diagnostics);
            this.checkCommaSpacing(cleanLine, lineIndex, diagnostics);
            this.checkForLoopSpacing(cleanLine, line, lineIndex, diagnostics);
            this.checkKeywordSpacing(cleanLine, lineIndex, diagnostics); // check if redundant

            
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
            const query = new Parser.Query(C, queryInfo.query);
            const captures = query.captures(tree.rootNode);
                    
            for (const capture of captures) {                
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
                const operatorStart = this.positionToOffset(text, child.startPosition);
                const operatorEnd = this.positionToOffset(text, child.endPosition);
                
                const hasSpaceBefore = operatorStart > 0 && (text[operatorStart - 1] === ' ' || text[operatorStart - 1] === '\n');
                const hasSpaceAfter = operatorEnd < text.length && (text[operatorEnd] === ' ' || text[operatorEnd] === '\n');
                                
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

    private checkGlobalVars(tree: any, document: vscode.TextDocument, diagnostics:vscode.Diagnostic[]) {
        const query = new Parser.Query(C, '(translation_unit (declaration) @global_decl)');
        const captures = query.captures(tree.rootNode);
        
        for (const capture of captures) {
            const n = capture.node;
            
            const isConst = n.text.includes('const');
            const isFunctionDecl = this.findChildByType(n, 'function_declarator');
            const isPointerDecl = this.findChildByType(n, 'pointer_declarator'); // might be buggy yet
            
            
            const hasInit = this.findChildByType(n, 'init_declarator');
            const hasDeclarator = this.findChildByType(n, 'declarator');
            const isLiteralInit = hasInit && /=\s*[\d"']/.test(hasInit.text);

            if ((hasInit || hasDeclarator) && !isConst && !isFunctionDecl && !isPointerDecl && !isLiteralInit) {
                const range = new vscode.Range(n.startPosition.row, n.startPosition.column, n.endPosition.row, n.endPosition.column);
                const diagnostic = new vscode.Diagnostic(
                    range, 
                    `Avoid global mutable variables. Use function parameters or local variables instead.`, 
                    vscode.DiagnosticSeverity.Information
                );
                diagnostic.code = 'global-variable';
                diagnostic.source = 'lint40';
                diagnostics.push(diagnostic);
            }
        }
    }

    private checkDocumentation(tree: any, document: vscode.TextDocument, diagnostics:vscode.Diagnostic[]) {
        const text = document.getText();
        
        const queries = [
            { name: 'function', query: '(function_definition) @func' },
            { name: 'struct', query: '(struct_specifier name: _ body: (field_declaration_list) @struct)'},
        ];
        
        for (const queryInfo of queries) {
            const query = new Parser.Query(C, queryInfo.query);
            const captures = query.captures(tree.rootNode);
            
            for (const capture of captures) {
                if (queryInfo.name === 'function') {
                    if (capture.node.startPosition.row > 0) {
                        const lineBefore = document.lineAt(capture.node.startPosition.row - 1).text.trim();
                        if (!lineBefore.endsWith('**/')) {
                            const funcLine = document.lineAt(capture.node.startPosition.row);
                            const range = new vscode.Range(capture.node.startPosition.row, 
                                0,
                                capture.node.startPosition.row,
                                funcLine.text.length);
                            const diagnostic = new vscode.Diagnostic(
                                range,
                                `This function is missing a contract.`,
                                vscode.DiagnosticSeverity.Information
                            );
                            diagnostic.code = 'documentation';
                            diagnostic.source = 'lint40';
                            diagnostics.push(diagnostic);
                        }
                    } else {
                        const funcLine = document.lineAt(capture.node.startPosition.row);
                        const range = new vscode.Range(capture.node.startPosition.row, 
                                0,
                                capture.node.startPosition.row,
                                funcLine.text.length);
                            const diagnostic = new vscode.Diagnostic(
                                range,
                                `This function is missing a contract.`,
                                vscode.DiagnosticSeverity.Information
                            );
                            diagnostic.code = 'documentation';
                            diagnostic.source = 'lint40';
                            diagnostics.push(diagnostic);
                    }
                    
                } else {
                    if (capture.node.startPosition.row > 0) {
                        const lineBefore = document.lineAt(capture.node.startPosition.row - 1).text.trim();
                        if (lineBefore !== '*/') {
                            const range = new vscode.Range(capture.node.startPosition.row, 
                                0,
                                capture.node.startPosition.row,
                                capture.node.endPosition.column);
                            const diagnostic = new vscode.Diagnostic(
                                range,
                                `This struct is missing documentation.`,
                                vscode.DiagnosticSeverity.Information
                            );
                            diagnostic.code = 'documentation';
                            diagnostic.source = 'lint40';
                            diagnostics.push(diagnostic);
                        }
                    } else {
                        const range = new vscode.Range(capture.node.startPosition.row, 
                                capture.node.startPosition.column,
                                capture.node.startPosition.row,
                                capture.node.endPosition.column);
                        const diagnostic = new vscode.Diagnostic(
                            range,
                            `This struct is missing documentation.`,
                            vscode.DiagnosticSeverity.Information
                        );
                        diagnostic.code = 'documentation';
                        diagnostic.source = 'lint40';
                        diagnostics.push(diagnostic);
                    }
                    
                }
            }
        }
    }

    private checkNestingDepth(tree: any, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const maxDepth = 3;
        
        const query = new Parser.Query(C, `
            [
                (if_statement) @control
                (for_statement) @control
                (while_statement) @control
                (do_statement) @control
                (switch_statement) @control
            ]
        `);
        
        const captures = query.captures(tree.rootNode);
        
        for (const capture of captures) {
            const controlNode = capture.node;
            const depth = this.calculateControlNestingDepth(controlNode);
            
            if (depth > maxDepth) {
                const range = new vscode.Range(
                    controlNode.startPosition.row,
                    controlNode.startPosition.column,
                    controlNode.startPosition.row,
                    controlNode.startPosition.column + 5
                );
                
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Control structure nesting depth of ${depth} exceeds maximum of ${maxDepth}. Consider refactoring.`,
                    vscode.DiagnosticSeverity.Information
                );
                diagnostic.code = 'excessive-nesting';
                diagnostic.source = 'lint40';
                diagnostics.push(diagnostic);
            }
        }
    }

    private calculateControlNestingDepth(node: any): number {
        let depth = 1;
        let currentNode = node.parent;
        const controlTypes = [
            'if_statement',
            'for_statement', 
            'while_statement',
            'do_statement',
            'switch_statement'
        ];

        while (currentNode) {
            if (controlTypes.includes(currentNode.type)) {
                depth++;
            }
            currentNode = currentNode.parent;
        }
        
        return depth;
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

    

    private checkBooleanComparisons(line: string, lineIndex: number, diagnostics: vscode.Diagnostic[]) {
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

    private checkTrailing(line: string, lineIndex: number, diagnostics: vscode.Diagnostic[]) {
        const trailingSpaceRegex = /\s+$/;
        let match = trailingSpaceRegex.exec(line);

        if (match){
            const range = new vscode.Range(lineIndex, match.index, lineIndex, line.length);
            const diagnostic = new vscode.Diagnostic(
                range,
                `Remove trailing whitespace`,
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = 'trailing-whitespace';
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