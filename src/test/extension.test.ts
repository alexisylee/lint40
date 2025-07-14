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
        
        // Trigger linting by simulating document change
        await vscode.window.showTextDocument(doc);
        
        // Wait a bit for diagnostics to be processed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const diagnostics = vscode.languages.getDiagnostics(doc.uri);
        return diagnostics;
    }

    // ========== BASIC LINE LENGTH TESTS ==========
    
    suite('Line Length Tests (Both Modes)', () => {
        test('Should flag lines over 80 characters', async () => {
            const longLine = 'int very_long_variable_name = some_very_long_function_name_that_exceeds_eighty_chars();';
            const diagnostics = await getDiagnostics(longLine);
            
            const lineLengthDiagnostics = diagnostics.filter(d => d.code === 'line-length');
            assert.strictEqual(lineLengthDiagnostics.length, 1);
            assert.ok(lineLengthDiagnostics[0].message.includes('exceeds 80 characters'));
        });

        test('Should not flag lines exactly 80 characters', async () => {
            const exactLine = 'a'.repeat(80);
            const diagnostics = await getDiagnostics(exactLine);
            
            const lineLengthDiagnostics = diagnostics.filter(d => d.code === 'line-length');
            assert.strictEqual(lineLengthDiagnostics.length, 0);
        });

        test('Should flag extremely long lines', async () => {
            const extremeLine = 'int ' + 'x'.repeat(200) + ' = 5;';
            const diagnostics = await getDiagnostics(extremeLine);
            
            const lineLengthDiagnostics = diagnostics.filter(d => d.code === 'line-length');
            assert.strictEqual(lineLengthDiagnostics.length, 1);
        });

        test('Should not flag short lines', async () => {
            const shortLine = 'int x = 5;';
            const diagnostics = await getDiagnostics(shortLine);
            
            const lineLengthDiagnostics = diagnostics.filter(d => d.code === 'line-length');
            assert.strictEqual(lineLengthDiagnostics.length, 0);
        });
    });

    // ========== TAB CHARACTER TESTS ==========

    suite('Tab Character Tests (Both Modes)', () => {
        test('Should flag tab characters', async () => {
            const tabLine = 'int\tx = 5;';
            const diagnostics = await getDiagnostics(tabLine);
            
            const tabDiagnostics = diagnostics.filter(d => d.code === 'tab');
            assert.strictEqual(tabDiagnostics.length, 1);
            assert.ok(tabDiagnostics[0].message.includes('tab characters'));
        });

        test('Should flag multiple tabs', async () => {
            const multiTabLine = 'int\t\tx\t= 5;';
            const diagnostics = await getDiagnostics(multiTabLine);
            
            const tabDiagnostics = diagnostics.filter(d => d.code === 'tab');
            assert.strictEqual(tabDiagnostics.length, 3);
        });

        test('Should not flag spaces', async () => {
            const spaceLine = '        int x = 5;';
            const diagnostics = await getDiagnostics(spaceLine);
            
            const tabDiagnostics = diagnostics.filter(d => d.code === 'tab');
            assert.strictEqual(tabDiagnostics.length, 0);
        });

    });

    // ========== INDENTATION TESTS ==========

    suite('Indentation Tests (Both Modes)', () => {
        test('Should flag incorrect 4-space indentation', async () => {
            const code = `int main() {
    int x = 5;
}`;
            const diagnostics = await getDiagnostics(code);
            
            const indentDiagnostics = diagnostics.filter(d => d.code === 'indent-length');
            assert.strictEqual(indentDiagnostics.length, 1);
            assert.ok(indentDiagnostics[0].message.includes('eight (8) characters'));
        });

        test('Should not flag correct 8-space indentation', async () => {
            const code = `int main() {
        int x = 5;
}`;
            const diagnostics = await getDiagnostics(code);
            
            const indentDiagnostics = diagnostics.filter(d => d.code === 'indent-length');
            assert.strictEqual(indentDiagnostics.length, 0);
        });

        test('Should flag nested indentation errors', async () => {
            const code = `int main() {
        if (x > 5) {
            int y = 10;
        }
}`;
            const diagnostics = await getDiagnostics(code);
            
            const indentDiagnostics = diagnostics.filter(d => d.code === 'indent-length');
            assert.strictEqual(indentDiagnostics.length, 1); // 12 spaces instead of 16
        });

        test('Should handle zero indentation correctly', async () => {
            const code = `int main() {
return 0;
}`;
            const diagnostics = await getDiagnostics(code);
            
            const indentDiagnostics = diagnostics.filter(d => d.code === 'indent-length');
            assert.strictEqual(indentDiagnostics.length, 0); // 0 is multiple of 8
        });
    });

    // ========== POINTER STYLE TESTS ==========

    suite('Pointer Style Tests (Both Modes)', () => {
        test('Should flag int* style', async () => {
            const code = 'int* ptr;';
            const diagnostics = await getDiagnostics(code);
            
            const pointerDiagnostics = diagnostics.filter(d => d.code === 'pointer-style');
            assert.strictEqual(pointerDiagnostics.length, 1);
        });

        test('Should not flag correct int *ptr style', async () => {
            const code = 'int *ptr;';
            const diagnostics = await getDiagnostics(code);
            
            const pointerDiagnostics = diagnostics.filter(d => d.code === 'pointer-style');
            assert.strictEqual(pointerDiagnostics.length, 0);
        });

        test('Should flag multiple pointer types', async () => {
            const code = `char* str;
double* value;`;
            const diagnostics = await getDiagnostics(code);
            
            const pointerDiagnostics = diagnostics.filter(d => d.code === 'pointer-style');
            assert.strictEqual(pointerDiagnostics.length, 2);
        });

        test('Should not flag multiplication', async () => {
            const code = 'int result = a * b;';
            const diagnostics = await getDiagnostics(code);
            
            const pointerDiagnostics = diagnostics.filter(d => d.code === 'pointer-style');
            assert.strictEqual(pointerDiagnostics.length, 0);
        });
    });

    // ========== COMMA SPACING TESTS ==========

    suite('Comma Spacing Tests (Both Modes)', () => {
        test('Should flag missing space after comma', async () => {
            const code = 'func(a,b,c);';
            const diagnostics = await getDiagnostics(code);
            
            const commaDiagnostics = diagnostics.filter(d => d.code === 'comma-spacing');
            assert.strictEqual(commaDiagnostics.length, 2);
        });

        test('Should not flag correct comma spacing', async () => {
            const code = 'func(a, b, c);';
            const diagnostics = await getDiagnostics(code);
            
            const commaDiagnostics = diagnostics.filter(d => d.code === 'comma-spacing');
            assert.strictEqual(commaDiagnostics.length, 0);
        });

        test('Should flag commas in declarations', async () => {
            const code = 'int a,b,c;';
            const diagnostics = await getDiagnostics(code);
            
            const commaDiagnostics = diagnostics.filter(d => d.code === 'comma-spacing');
            assert.strictEqual(commaDiagnostics.length, 2);
        });
    });

    // ========== KEYWORD SPACING TESTS ==========

    suite('Keyword Spacing Tests (Both Modes)', () => {
        test('Should flag if( without space', async () => {
            const code = 'if(x > 5) { }';
            const diagnostics = await getDiagnostics(code);
            
            const keywordDiagnostics = diagnostics.filter(d => d.code === 'keyword-spacing');
            assert.strictEqual(keywordDiagnostics.length, 1);
        });

        test('Should flag for( without space', async () => {
            const code = 'for(int i = 0; i < 10; i++) { }';
            const diagnostics = await getDiagnostics(code);
            
            const keywordDiagnostics = diagnostics.filter(d => d.code === 'keyword-spacing');
            assert.strictEqual(keywordDiagnostics.length, 1);
        });

        test('Should flag while( without space', async () => {
            const code = 'while(condition) { }';
            const diagnostics = await getDiagnostics(code);
            
            const keywordDiagnostics = diagnostics.filter(d => d.code === 'keyword-spacing');
            assert.strictEqual(keywordDiagnostics.length, 1);
        });

        test('Should not flag correct keyword spacing', async () => {
            const code = 'if (x > 5) { }';
            const diagnostics = await getDiagnostics(code);
            
            const keywordDiagnostics = diagnostics.filter(d => d.code === 'keyword-spacing');
            assert.strictEqual(keywordDiagnostics.length, 0);
        });
    });

    // ========== EDGE CASES ==========

    suite('Edge Cases', () => {
        test('Should handle empty files', async () => {
            const code = '';
            const diagnostics = await getDiagnostics(code);
            assert.strictEqual(diagnostics.length, 0);
        });

        test('Should handle single line files', async () => {
            const code = 'int x = 5;';
            const diagnostics = await getDiagnostics(code);
            
            // Should only check basic style, no major errors expected
            const majorErrors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
            assert.strictEqual(majorErrors.length, 0);
        });

        test('Should handle files with only comments', async () => {
            const code = `/* This is just a comment file
 * with multiple lines
 */`;
            const diagnostics = await getDiagnostics(code);
            
            // Should not flag major style issues in comment-only files
            const styleErrors = diagnostics.filter(d => 
                d.code === 'indent-length' || d.code === 'operator-spacing'
            );
            assert.strictEqual(styleErrors.length, 0);
        });

        test('Should handle function pointers', async () => {
            const code = 'void (*func_ptr)(int) = NULL;';
            const diagnostics = await getDiagnostics(code);
            
            // Should not flag this as incorrect pointer style
            const pointerDiagnostics = diagnostics.filter(d => d.code === 'pointer-style');
            assert.strictEqual(pointerDiagnostics.length, 0);
        });

        test('Should handle string literals with special characters', async () => {
            const code = 'char *str = "This string contains, commas and stuff";';
            const diagnostics = await getDiagnostics(code);
            
            // Should not flag commas within strings
            const commaDiagnostics = diagnostics.filter(d => d.code === 'comma-spacing');
            assert.strictEqual(commaDiagnostics.length, 0);
        });

        test('Should handle macros', async () => {
            const code = `#define MAX(a, b) ((a) > (b) ? (a) : (b))
#define VERY_LONG_MACRO_NAME_THAT_EXCEEDS_EIGHTY_CHARACTERS_LOL_LOL_LOL(a, b) ((a) + (b))`;
            const diagnostics = await getDiagnostics(code);
            
            // Should flag long line but handle macro syntax
            const lineLengthDiagnostics = diagnostics.filter(d => d.code === 'line-length');
            assert.strictEqual(lineLengthDiagnostics.length, 1);
        });

        test('Should handle typical student assignment code', async () => {
            const code = `#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
        if (argc != 2) {
                fprintf(stderr, "Usage: %s filename\\n", argv[0]);
                return 1;
        }
        
        FILE *fp = fopen(argv[1], "r");
        if (fp == NULL) {
                perror("fopen");
                return 1;
        }
        
        fclose(fp);
        return 0;
}`;
            const diagnostics = await getDiagnostics(code);
            
            // Should mostly pass basic style checks
            const majorIssues = diagnostics.filter(d => 
                d.severity === vscode.DiagnosticSeverity.Error
            );
            assert.strictEqual(majorIssues.length, 0);
        });

        test('Should handle files with common student mistakes', async () => {
            const code = `int main(){
    int x=5;
    if(x>5){
        printf("big");
    }
    return 0;
}`;
            const diagnostics = await getDiagnostics(code);
            
            // Should flag multiple style issues
            const styleIssues = diagnostics.filter(d => 
                d.code === 'operator-spacing' || 
                d.code === 'keyword-spacing' || 
                d.code === 'braces-spacing'
            );
            assert.ok(styleIssues.length > 0);
        });
    });
});