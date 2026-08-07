import * as vscode from 'vscode';

// ===============================
// Konfigurasi Entropy
// ===============================
const CONFIG = {
    MIN_TOKEN_LENGTH: 20,
    ENTROPY_THRESHOLD: 4.0,
    HIGH_ENTROPY_CHARSETS: [
        /^[0-9a-zA-Z+/=]{20,}$/,
        /^[0-9a-fA-F]{20,}$/,
        /^[0-9a-zA-Z\-_]{20,}$/,
    ],
};

// ===============================
// Kata kunci variabel sensitif
// ===============================
const SECRET_CONTEXT = [
    "key",
    "apikey",
    "api_key",
    "secret",
    "password",
    "passwd",
    "pwd",
    "token",
    "jwt",
    "auth",
    "oauth",
    "access",
    "refresh",
    "session",
    "private",
    "credential",
    "client",
    "stripe",
    "slack",
    "aws",
    "google",
    "encryption",
];

// ===============================
// Shannon Entropy
// ===============================
export function calculateShannonEntropy(str: string): number {

    if (str.length === 0) {
        return 0;
    }

    const freq = new Map<string, number>();

    for (const ch of str) {
        freq.set(ch, (freq.get(ch) ?? 0) + 1);
    }

    let entropy = 0;

    for (const count of freq.values()) {
        const p = count / str.length;
        entropy -= p * Math.log2(p);
    }

    return entropy;
}

// ===============================
// Assignment Pattern
// ===============================
const ASSIGNMENT_PATTERN =
/([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*[^=]+)?\s*=\s*['"`]([^'"`\r\n]{20,})['"`]/g;


// ===============================
// Skip Context
// ===============================
const SKIP_KEYWORDS = [
    "import",
    "require",
    "from",
    "http://",
    "https://",
    "console.",
    "//",
    "/*",
    " * ",
    ".ts",
    ".js",
    ".json",
    ".png",
    ".jpg",
    ".svg",
    "describe(",
    "it(",
    "test(",
];

// ===============================
// Detector
// ===============================
export function detectWithEntropy(
    document: vscode.TextDocument

): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const lines = document.getText().split("\n");

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        const trimmed = line.trim();
        // Skip komentar, import, url, dsb.
        if (SKIP_KEYWORDS.some(k => trimmed.includes(k))) {
            continue;
        }

        ASSIGNMENT_PATTERN.lastIndex = 0;

        let match: RegExpExecArray | null;

        while ((match = ASSIGNMENT_PATTERN.exec(line)) !== null) {
            const variableName = match[1].toLowerCase();
            const token = match[2];

            // ===========================
            // Filter Context
            // ===========================
            if (!SECRET_CONTEXT.some(k => variableName.includes(k))) {
                continue;
            }
            // ===========================
            // Panjang minimum
            // ===========================
            if (token.length < CONFIG.MIN_TOKEN_LENGTH) {
                continue;
            }
            // ===========================
            // Charset
            // ===========================
            const validCharset =
                CONFIG.HIGH_ENTROPY_CHARSETS.some(r => r.test(token));
            if (!validCharset) {
                continue;
            }
            // ===========================
            // Shannon Entropy
            // ===========================
            const entropy = calculateShannonEntropy(token);
            if (entropy < CONFIG.ENTROPY_THRESHOLD) {
                continue;
            }
            // ===========================
            // Range
            // ===========================
            const tokenColumn = line.indexOf(token, match.index);
            if (tokenColumn === -1) {
                continue;
            }

            const range = new vscode.Range(
                new vscode.Position(lineNum, tokenColumn),
                new vscode.Position(
                    lineNum,
                    tokenColumn + token.length
                ),
            );

            const diag = new vscode.Diagnostic(
                range,
                `[CredGuard-CG009] Entropi Shannon tinggi (H = ${entropy.toFixed(2)} bit/char). Kemungkinan hardcoded credential.`,
                vscode.DiagnosticSeverity.Warning,
            );

            diag.source = "CredGuard";
            diag.code = {
                value: "CG009",
                target: vscode.Uri.parse(
                    "https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure"
                ),
            };
            diagnostics.push(diag);
        }
    }

    return diagnostics;
}