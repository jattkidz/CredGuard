import * as vscode from 'vscode';
import { detectWithRegex }   from './detectors/regexDetector';
import { detectWithEntropy } from './detectors/entropyDetector';

// Tipe berkas yang dipindai
const SUPPORTED_LANGUAGES = [
    'javascript',
    'typescript',
    'python',
    'php',
    'dotenv',
];

// Debounce 300ms
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
        // Filter 2: file terlalu besar (>500KB)
        if (document.getText().length > 500_000) { return; }
        // Filter 3: tipe bahasa yang didukung
        if (!SUPPORTED_LANGUAGES.includes(document.languageId)) { return; }

        // Jalankan kedua modul deteksi
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

    console.log('CredGuard aktif — melindungi kode dari kebocoran kredensial.');
}

export function deactivate() {}