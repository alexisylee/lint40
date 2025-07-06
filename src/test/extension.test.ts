import * as assert from 'assert';
import * as vscode from 'vscode';
import { Lint40Extension } from '../extension';

suite('lint40 Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start lint40 tests.');

    let extension: Lint40Extension;
    let testDocument: vscode.TextDocument;

    suiteSetup(async () => {
        // Create extension instance
        extension = new Lint40Extension();
        
        // Activate extension with a mock context
        const mockContext = {
            subscriptions: []
        } as any;
        extension.activate(mockContext);
    });

    suiteTeardown(() => {
        if (extension) {
            extension.dispose();
        }
    });

    async function createTestDocument(content: string): Promise<vscode.TextDocument> {
        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'c'
        });
        return doc;
    }

    async function getDiagnostics(content: string): Promise<vscode.Diagnostic[]> {
        const doc = await createTestDocument(content);

        extension.runLint(doc);

        // Wait a bit for diagnostics to be processed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const diagnostics = vscode.languages.getDiagnostics(doc.uri);
        console.log(diagnostics);
        return diagnostics;
    }

    test('Should flag lines over 80 characters', async () => {
        const longLine = 'int very_long_variable_name = some_very_long_function_name_that_exceeds_eighty_chars();';
        const diagnostics = await getDiagnostics(longLine);
        
        const lineLengthDiagnostics = diagnostics.filter(d => d.code === 'line-length');
        assert.strictEqual(lineLengthDiagnostics.length, 1);
        assert.ok(lineLengthDiagnostics[0].message.includes('exceeds 80 characters'));
    });

    test('Should not flag lines under 80 characters', async () => {
        const shortLine = 'int x = 5;';
        const diagnostics = await getDiagnostics(shortLine);
        
        const lineLengthDiagnostics = diagnostics.filter(d => d.code === 'line-length');
        assert.strictEqual(lineLengthDiagnostics.length, 0);
    });

    test('Should flag operators without spaces', async () => {
        const testCases = [
            'int x=5;',           // no spaces around =
            'if (x==y)',         // no spaces around ==
            'result = a+b;',     // no spaces around +
            'if (x!=NULL)'       // no spaces around !=
        ];

        for (const testCase of testCases) {
            const diagnostics = await getDiagnostics(testCase);
            const operatorDiagnostics = diagnostics.filter(d => d.code === 'operator-spacing');
            assert.ok(operatorDiagnostics.length > 0, `Should flag: ${testCase}`);
        }
    });

    test('Should flag operators with spaces on only one side', async () => {
        const testCases = [
            'int x= 5;',         // space after, not before
            'int x =5;',         // space before, not after
            'if (x== y)',        // space after, not before
            'if (x ==y)'         // space before, not after
        ];

        for (const testCase of testCases) {
            const diagnostics = await getDiagnostics(testCase);
            const operatorDiagnostics = diagnostics.filter(d => d.code === 'operator-spacing');
            assert.ok(operatorDiagnostics.length > 0, `Should flag: ${testCase}`);
        }
    });

    test('Should not flag operators with proper spacing', async () => {
        const testCases = [
            'int x = 5;',
            'if (x == y)',
            'result = a + b;',
            'if (x != NULL)',
            'if (x <= 10 && y >= 5)'
        ];

        for (const testCase of testCases) {
            const diagnostics = await getDiagnostics(testCase);
            const operatorDiagnostics = diagnostics.filter(d => d.code === 'operator-spacing');
            assert.strictEqual(operatorDiagnostics.length, 0, `Should not flag: ${testCase}`);
        }
    });

    test('Should not flag < and > in include statements', async () => {
        const testCases = [
            '#include <stdio.h>',
            '#include <stdint.h>',
            '#include <stdlib.h>'
        ];

        for (const testCase of testCases) {
            const diagnostics = await getDiagnostics(testCase);
            const operatorDiagnostics = diagnostics.filter(d => d.code === 'operator-spacing');
            assert.strictEqual(operatorDiagnostics.length, 0, `Should not flag: ${testCase}`);
        }
    });

    test('Should still flag < and > in comparisons', async () => {
        const testCases = [
            'if (x<5)',
            'while (i>0)',
            'result = (a<b);'
        ];

        for (const testCase of testCases) {
            const diagnostics = await getDiagnostics(testCase);
            const operatorDiagnostics = diagnostics.filter(d => d.code === 'operator-spacing');
            assert.ok(operatorDiagnostics.length > 0, `Should flag: ${testCase}`);
        }
    });

    test('Should handle multiple issues in one line', async () => {
        const testLine = 'if (x==y&&a<b) return x+y;';  // Multiple spacing issues
        const diagnostics = await getDiagnostics(testLine);
        
        const operatorDiagnostics = diagnostics.filter(d => d.code === 'operator-spacing');
        assert.ok(operatorDiagnostics.length >= 3, 'Should flag multiple operators');
    });

    test('random', async() => {
        const regex = /\b(if|for|while)\(/g;
        const lines = [
        "for(int i = 0; i < 5; i++)", // should match
        "for (int i = 0; i < 5; i++)", // should NOT match
        "if(x > 0)", // should match
        "if (x > 0)" // should NOT match
    ];

    for (const line of lines) {
        const match = regex.exec(line);
        console.log(`Testing: '${line}'`);
        console.log("Match:", match ? match[0] : "None");
    }
    });


});