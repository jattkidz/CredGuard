import * as vscode from 'vscode';
// Impor modul entropi yang sudah kita buat
import { scanLineForEntropy } from './detectors/entropyDetector';

export function activate(context: vscode.ExtensionContext) {
    console.log('CredGuard: Mesin Hibrida (Regex + Entropy) Aktif! 🚀');

    // Buat wadah untuk menampung garis merah & kuning (Diagnostics)
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('credguard');
    context.subscriptions.push(diagnosticCollection);

    // Fungsi inti: SCANNER
    function scanDocument(document: vscode.TextDocument) {
        // Hanya scan file teks fisik
        if (document.uri.scheme !== 'file') {
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // ========================================================
        // MESIN 1: PATTERN MATCHING (REGEX) -> GARIS MERAH
        // ========================================================
        const awsRegex = /AKIA[0-9A-Z]{16}/g;
        let matchRegex;

        while ((matchRegex = awsRegex.exec(text)) !== null) {
            const startPos = document.positionAt(matchRegex.index);
            const endPos = document.positionAt(matchRegex.index + matchRegex[0].length);
            const range = new vscode.Range(startPos, endPos);

            const diagnostic = new vscode.Diagnostic(
                range,
                '⚠️ BAHAYA: Terdeteksi AWS Access Key! (Pola Regex)',
                vscode.DiagnosticSeverity.Error // Level Merah (Error)
            );
            diagnostic.code = { value: 'CG001', target: vscode.Uri.parse('https://aws.amazon.com/security') };
            diagnostics.push(diagnostic);
        }

        // ========================================================
        // MESIN 2: SHANNON ENTROPY -> GARIS KUNING
        // ========================================================
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            
            // Lempar isi baris ke file entropyDetector.ts
            const entropyFindings = scanLineForEntropy(line.text, i);
            
            for (const finding of entropyFindings) {
                const range = new vscode.Range(
                    new vscode.Position(finding.line, finding.startCol),
                    new vscode.Position(finding.line, finding.endCol)
                );

                const diagnostic = new vscode.Diagnostic(
                    range,
                    `[CredGuard Warning] Potensi token acak (Entropi: ${finding.entropy} bit/char). Pindahkan ke .env!`,
                    vscode.DiagnosticSeverity.Warning // Level Kuning (Warning)
                );
                diagnostics.push(diagnostic);
            }
        }

        // Tampilkan semua garis di editor
        diagnosticCollection.set(document.uri, diagnostics);
    }

    // Event Listener
    if (vscode.window.activeTextEditor) {
        scanDocument(vscode.window.activeTextEditor.document);
    }
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => scanDocument(doc)));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => scanDocument(event.document)));
}

export function deactivate() {}