import * as vscode from 'vscode';

// Kamus pola regex — CG001–CG008
interface PatternEntry {
    id: string;
    name: string;
    pattern: RegExp;
    severity: vscode.DiagnosticSeverity;
    message: string;
    docUrl: string;
}

const PATTERN_DICTIONARY: PatternEntry[] = [
    {
        id: 'CG001', name: 'AWS Access Key ID',
        pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
        severity: vscode.DiagnosticSeverity.Error,
        message: '[CredGuard-CG001] AWS Access Key ID terdeteksi! Pindahkan ke process.env.AWS_ACCESS_KEY_ID.',
        docUrl: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html',
    },
    {
        id: 'CG002', name: 'Google Cloud API Key',
        pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
        severity: vscode.DiagnosticSeverity.Error,
        message: '[CredGuard-CG002] Google Cloud API Key terdeteksi! Gunakan Secret Manager atau variabel lingkungan.',
        docUrl: 'https://cloud.google.com/docs/authentication/api-keys',
    },
    {
        id: 'CG003', name: 'Stripe Secret Key',
        pattern: /\bsk_(live|test)_[0-9a-zA-Z]{24,}\b/g,
        severity: vscode.DiagnosticSeverity.Error,
        message: '[CredGuard-CG003] Stripe Secret Key terdeteksi! Jangan simpan di kode sumber.',
        docUrl: 'https://stripe.com/docs/keys#safe-keys',
    },
    {
        id: 'CG004', name: 'GitHub Personal Access Token',
        pattern: /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{36}\b/g,
        severity: vscode.DiagnosticSeverity.Error,
        message: '[CredGuard-CG004] GitHub PAT terdeteksi! Revoke token ini segera.',
        docUrl: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure',
    },
    {
        id: 'CG005', name: 'JSON Web Token (JWT)',
        pattern: /\bey[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b/g,
        severity: vscode.DiagnosticSeverity.Warning,
        message: '[CredGuard-CG005] JSON Web Token (JWT) terdeteksi! Token ini mungkin mengandung data sesi aktif.',
        docUrl: 'https://jwt.io/introduction',
    },
    {
        id: 'CG006', name: 'Private Key PEM',
        pattern: /-----(?:BEGIN|END)\s(?:RSA\s|DSA\s|EC\s|OPENSSH\s|PGP\s)?PRIVATE(?: KEY| KEY BLOCK)-----/g,
        severity: vscode.DiagnosticSeverity.Error,
        message: '[CredGuard-CG006] Private Key (PEM) terdeteksi! Kunci privat tidak boleh ada di kode sumber.',
        docUrl: 'https://owasp.org/www-community/vulnerabilities/Sensitive_Data_Exposure',
    },
    {
        id: 'CG007', name: 'Password Hardcoded',
        pattern: /\b(?:db_?password|adminpassword|userpassword|password|passwd|pwd|secret|sessionsecret|api_secret)\b\s*[:=]\s*['"]?[^'"\r\n]{8,}['"]?/gi,
        severity: vscode.DiagnosticSeverity.Warning,
        message: '[CredGuard-CG007] Password atau secret hardcoded terdeteksi! Gunakan variabel lingkungan.',
        docUrl: 'https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password',
    },
    {
        id: 'CG008', name: 'Slack Bot Token',
        pattern: /\bxox[bpars]-[0-9A-Za-z\-]{10,}\b/g,
        severity: vscode.DiagnosticSeverity.Error,
        message: '[CredGuard-CG008] Slack Token terdeteksi! Regenerasi token dari Slack API dashboard.',
        docUrl: 'https://api.slack.com/authentication/token-types',
    },
];

export function detectWithRegex(
    document: vscode.TextDocument
): vscode.Diagnostic[] {

    const text        = document.getText();
    const diagnostics: vscode.Diagnostic[] = [];

    for (const entry of PATTERN_DICTIONARY) {
        entry.pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = entry.pattern.exec(text)) !== null) {
            const startPos = document.positionAt(match.index);
            const endPos   = document.positionAt(match.index + match[0].length);
            const range    = new vscode.Range(startPos, endPos);

            const diagnostic       = new vscode.Diagnostic(range, entry.message, entry.severity);
            diagnostic.source      = 'CredGuard';
            diagnostic.code        = {
                value:  entry.id,
                target: vscode.Uri.parse(entry.docUrl),
            };
            diagnostics.push(diagnostic);
        }
    }

    return diagnostics;
}