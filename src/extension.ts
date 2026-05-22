import * as vscode from 'vscode';
import { detectWithRegex }   from './detectors/regexDetector';
import { detectWithEntropy } from './detectors/entropyDetector';

// Tipe berkas yang dipindai sesuai BAB 3 Sub-bab 3.5.6
const SUPPORTED_LANGUAGES = [
    'javascript', 'typescript', 'python', 'php',
    'shellscript', 'dotenv', 'yaml', 'json', 'plaintext',
];

// Debounce 300ms sesuai BAB 3 Sub-bab 3.5.6
const DEBOUNCE_MS = 300;

export function activate(context: vscode.ExtensionContext) {

    const diagnosticCollection =
        vscode.languages.createDiagnosticCollection('credguard');
    context.subscriptions.push(diagnosticCollection);

    const debounceTimers = new Map<string, any>();

    // ── Fungsi inti: scan dokumen ─────────────────────────────
    function scanDocument(document: vscode.TextDocument): void {
        // Filter 1: hanya file dari disk
        if (document.uri.scheme !== 'file') { return; }
        // Filter 2: file terlalu besar (>500KB) — sesuai BAB 3 iterasi 3
        if (document.getText().length > 500_000) { return; }
        // Filter 3: tipe bahasa yang didukung
        if (!SUPPORTED_LANGUAGES.includes(document.languageId)) { return; }

        // Jalankan kedua modul deteksi (BAB 3 Gambar 3.4)
        const regexFindings   = detectWithRegex(document);
        const entropyFindings = detectWithEntropy(document);

        // Deduplikasi — satu posisi hanya 1 peringatan
        const seen  = new Set<string>();
        const unique = [...regexFindings, ...entropyFindings].filter(d => {
            const key = `${d.range.start.line}:${d.range.start.character}`;
            if (seen.has(key)) { return false; }
            seen.add(key);
            return true;
        });

        diagnosticCollection.set(document.uri, unique);
    }

    // ── Debounce saat mengetik ───────────────────────────────
    function scheduleScan(document: vscode.TextDocument): void {
        const key = document.uri.toString();
        const existing = debounceTimers.get(key);
        if (existing) { clearTimeout(existing); }

        const timer = setTimeout(() => {
            scanDocument(document);
            debounceTimers.delete(key);
        }, DEBOUNCE_MS);

        debounceTimers.set(key, timer);
    }

    // ── Event listeners ─────────────────────────────────────
    // Scan file yang aktif saat ekstensi pertama aktif
    if (vscode.window.activeTextEditor) {
        scanDocument(vscode.window.activeTextEditor.document);
    }

    context.subscriptions.push(
        // Pindah tab
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) { scanDocument(editor.document); }
        }),
        // Mengetik (dengan debounce)
        vscode.workspace.onDidChangeTextDocument(e => {
            scheduleScan(e.document);
        }),
        // Buka file baru
        vscode.workspace.onDidOpenTextDocument(doc => {
            scanDocument(doc);
        }),
        // Tutup file — hapus diagnostik
        vscode.workspace.onDidCloseTextDocument(doc => {
            diagnosticCollection.delete(doc.uri);
            debounceTimers.delete(doc.uri.toString());
        }),
    );

    // ── Command: Scan Manual (BAB 3 iterasi 3) ───────────────
    // Ctrl+Shift+P → "CredGuard: Scan File Sekarang"
    context.subscriptions.push(
        vscode.commands.registerCommand('credguard.scanNow', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage(
                    'CredGuard: Tidak ada file aktif untuk di-scan.'
                );
                return;
            }
            scanDocument(editor.document);
            const count =
                diagnosticCollection.get(editor.document.uri)?.length ?? 0;
            vscode.window.showInformationMessage(
                count > 0
                    ? `CredGuard: Ditemukan ${count} potensi kebocoran kredensial!`
                    : 'CredGuard: Tidak ada kredensial sensitif yang terdeteksi.'
            );
        })
    );

    console.log('CredGuard aktif — melindungi kode dari kebocoran kredensial.');
}

export function deactivate() {}