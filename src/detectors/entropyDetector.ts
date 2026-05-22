import * as vscode from 'vscode';

// Konfigurasi modul entropy — sesuai BAB 3 Sub-bab 3.5.7
const CONFIG = {
    MIN_TOKEN_LENGTH : 20,
    ENTROPY_THRESHOLD: 4.0,  // bit/char — berdasarkan Reaz & Wunder (2024) [3]
    HIGH_ENTROPY_CHARSETS: [
        /^[0-9a-zA-Z+/=]{20,}$/,    // Base64
        /^[0-9a-fA-F]{20,}$/,        // Hex
        /^[0-9a-zA-Z\-_]{20,}$/,     // URL-safe Base64 / token umum
    ],
};

// Rumus: H(s) = -Σ p(x) × log₂(p(x))
// Sesuai BAB 3 Sub-bab 3.5.7 dan BAB 2 Sub-bab 2.2.5
export function calculateShannonEntropy(str: string): number {
    if (str.length === 0) { return 0; }

    const freq = new Map<string, number>();
    for (const char of str) {
        freq.set(char, (freq.get(char) ?? 0) + 1);
    }

    let entropy = 0;
    for (const count of freq.values()) {
        const p = count / str.length;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

// Pola assignment: const x = "nilai", key: 'nilai', KEY="nilai"
const ASSIGNMENT_PATTERN = /(?:=|:)\s*['"`]([^'"`\s]{20,})['"`]/g;

// Kata kunci baris yang dikecualikan
const SKIP_KEYWORDS = [
    'import', 'require', 'from', 'http://', 'https://',
    'console.', '//', '/*', ' * ', '.ts', '.js', '.json',
    '.png', '.jpg', '.svg', 'describe(', 'it(', 'test(',
];

export function detectWithEntropy(
    document: vscode.TextDocument
): vscode.Diagnostic[] {

    const diagnostics: vscode.Diagnostic[] = [];
    const lines = document.getText().split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line    = lines[lineNum];
        const trimmed = line.trimStart();

        // Filter konteks: lewati import, komentar, URL
        if (SKIP_KEYWORDS.some(kw => trimmed.includes(kw))) { continue; }

        ASSIGNMENT_PATTERN.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = ASSIGNMENT_PATTERN.exec(line)) !== null) {
            const token = match[1];

            // Filter 1: panjang minimum
            if (token.length < CONFIG.MIN_TOKEN_LENGTH) { continue; }

            // Filter 2: charset high-entropy
            const validCharset =
                CONFIG.HIGH_ENTROPY_CHARSETS.some(cs => cs.test(token));
            if (!validCharset) { continue; }

            // Filter 3: hitung & bandingkan entropy
            const entropy = calculateShannonEntropy(token);
            if (entropy < CONFIG.ENTROPY_THRESHOLD) { continue; }

            // Lolos semua filter → tandai sebagai CG009
            const tokenCol = line.indexOf(token, match.index);
            if (tokenCol === -1) { continue; }

            const range = new vscode.Range(
                new vscode.Position(lineNum, tokenCol),
                new vscode.Position(lineNum, tokenCol + token.length),
            );

            const diag = new vscode.Diagnostic(
                range,
                `[CredGuard-CG009] Entropi Shannon tinggi: H = ${entropy.toFixed(2)} bit/char (threshold ${CONFIG.ENTROPY_THRESHOLD}). Kemungkinan token/kunci rahasia hardcoded.`,
                vscode.DiagnosticSeverity.Warning,
            );
            diag.source = 'CredGuard';
            diag.code   = {
                value:  'CG009',
                target: vscode.Uri.parse('https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure'),
            };

            diagnostics.push(diag);
        }
    }

    return diagnostics;
}