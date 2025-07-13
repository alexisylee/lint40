import * as vscode from 'vscode';
const Parser = require('tree-sitter');
const C = require('tree-sitter-c');


export class ContractGenerator {
    static async generateFileHeader(document: vscode.TextDocument): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== document) {
            return;
        }

        const firstLine = document.lineAt(0).text.trim();
        if (firstLine.startsWith('/**')) {
            vscode.window.showInformationMessage('File already has a header comment');
            return;
        }

        const fileName = document.fileName.split('/').pop() || 'unknown.c';
        const date = new Date().toLocaleDateString();
        
        const headerTemplate = 
        `/**************************************************************
 *
 *                     ${fileName}
 *
 *      Assignment: [ASSIGNMENT]
 *      Authors: [YOUR NAMES]
 *      Date: ${date}
 *
 *      [PURPOSE]
 *
 **************************************************************/

`;
        await editor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(0, 0), headerTemplate);
        });

        vscode.window.showInformationMessage('File header generated! Fill in the bracketed sections.');
    }

    static async generateFuncContract(tree: any, document: vscode.TextDocument): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== document) {
            return;
        }
        const query = new Parser.Query(C, '(function_definition) @func');
        const captures = query.captures(tree.rootNode);
        let contractsGenerated = 0;

        for (const capture of captures) {
            const funcNode = capture.node;
            
            if (funcNode.startPosition.row > 0) {
                const lineBefore = document.lineAt(funcNode.startPosition.row - 1).text.trim();
                if (lineBefore.endsWith('**/')) {
                    continue;
                }
            }

            let funcname;
            const declarator = this.findChildByType(funcNode, 'function_declarator');
            if (declarator) {
                const identifier = this.findChildByType(declarator, 'identifier');
                funcname = identifier ? identifier.text : 'unknown_function';
            }

            const params = this.extractParams(funcNode);
            let paramSection = params.length > 0 ? `` : `None`;
            for (const param of params) {
                    paramSection += `      ${param}: [DESCRIPTION]` + '\n *';
            }
            
            const extractedNotes = this.analyzeFunctionBody(funcNode);
            let notes = extractedNotes.length > 0 ? `` : `None`;
            for (const note of extractedNotes) {
                notes += `      [NOTE "${note}"]` + '\n *';
            }

            const contractTemplate = `/******* ${funcname} *******
 *
 * [PURPOSE]
 *
 * Parameters:
 *${paramSection}
 * Return: [RETURN]
 *
 * Expects: [EXPECTS]
 *
 * Notes:
 *${notes}
 *********${`*`.repeat(funcname.length)}********/`;
            await editor.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(funcNode.startPosition.row - 1, funcNode.startPosition.column), contractTemplate);
            });

            vscode.window.showInformationMessage('Function contracts generated! Fill in the bracketed sections.');
        }
    }

    static async generateStructDoc(tree: any, document: vscode.TextDocument): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== document) {
            return;
        }

        const query = new Parser.Query(C, '(struct_specifier) @struct');
        const captures = query.captures(tree.rootNode);
        let contractsGenerated = 0;

        for (const capture of captures) {
            const structNode = capture.node;
            
            if (structNode.startPosition.row > 0) {
                const lineBefore = document.lineAt(structNode.startPosition.row - 1).text.trim();
                if (lineBefore === '*/') {
                    continue;
                }
            }

            const name = structNode.name;
            let fields = ``;
            const fieldList = this.findChildByType(structNode, 'field_declaration_list');
            if (fieldList) {
                for (let i = 0; i < fieldList.childCount; i++) {
                    const child = fieldList.child(i);
                    if (child && child.type === 'field_declaration') {
                        fields += `      ${child.text.substring(0, child.text.length - 1)}: [DESCRIPTION]` + '\n *';
                    }
                }
            }

            const docTemplate = `/* ${name}
 *
 * [DESCRIPTION]
 *
 * Members:
 *${fields}
 * Invariants: [DESCRIBE INVARIANTS]
 *
 */`;
            await editor.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(structNode.startPosition.row - 1, structNode.startPosition.column), docTemplate);
            });

            vscode.window.showInformationMessage('Struct documentation generated! Fill in the bracketed sections.');

        }
    }

    private static extractParams(node: any): Array<string>  {
        const params: Array<string> = [];
        const declarator = this.findChildByType(node, 'function_declarator');
        if (declarator) {
            const paramList = this.findChildByType(declarator, 'parameter_list');
            if (paramList) {
                for (let i = 0; i < paramList.childCount; i++) {
                    const child = paramList.child(i);
                    if (child && child.type === 'parameter_declaration') {
                        params.push(child.text);
                    }
                }
            }
        }
        return params;
    }

    private static findChildByType(node: any, type: string): any {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child && child.type === type) {
                return child;
            }
        }
        return null;
    }

    private static stripComments(line: string): string {
        let cleaned = line.replace(/\/\/.*$/, '');
        cleaned = cleaned.replace(/\/\*.*?\*\//g, '');
        return cleaned;
    }

    private static analyzeFunctionBody(funcNode: any): string[] {
        let text = ``;
        for (const line of funcNode.text.split('\n')) {
            text = text + this.stripComments(line);
        }

        const assertMatches = text.match(/assert\s*\([^)]+\)/g) || [];
        const mallocMatches = text.match(/\b(malloc|calloc|realloc)\s*\([^)]+\)/g) || [];
        const freeMatches = text.match(/\bfree\s*\([^)]+\)/g) || [];
        const customMatches = text.match(/\b[A-Z][a-zA-Z]*_(new|free)\s*\([^)]*\)/g) || [];
        const exitMatches = text.match(/\b(exit|abort)\s*\([^)]+\)/g) || [];

        return [...assertMatches, ...mallocMatches, ...freeMatches, ...customMatches, ...exitMatches];
    }

    
}

