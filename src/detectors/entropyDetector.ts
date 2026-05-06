/**
 * Menghitung nilai Shannon Entropy dari sebuah string.
 * Semakin tinggi nilainya, semakin acak string tersebut.
 * 
 * @param text String yang akan dievaluasi (misal: token atau password)
 * @returns Nilai entropi dalam satuan bit/karakter
 */
export function calculateShannonEntropy(text: string): number {
    // Jika string kosong, entropinya 0
    if (!text || text.length === 0) {
        return 0;
    }

    const len = text.length;
    const charCounts = new Map<string, number>();

    // Hitung frekuensi (jumlah kemunculan) setiap karakter unik
    for (let i = 0; i < len; i++) {
        const char = text[i];
        const currentCount = charCounts.get(char) || 0;
        charCounts.set(char, currentCount + 1);
    }

    let entropy = 0;

    // Hitung probabilitas (p_i) dan terapkan rumus Shannon
    for (const count of charCounts.values()) {
        const p_i = count / len; 
        entropy -= p_i * Math.log2(p_i);
    }

    return entropy;
}

// Ambang batas (threshold) sesuai literatur Reaz & Wunder (2024)
const ENTROPY_THRESHOLD = 3.5; 
const MIN_LENGTH = 20;

export function isHighEntropySecret(text: string): boolean {
    // Filter 1: Abaikan jika terlalu pendek (menekan False Positive)
    if (text.length < MIN_LENGTH) {
        return false;
    }

    // Filter 2 & 3: Hitung Entropi dan Evaluasi dengan ambang batas
    const entropyValue = calculateShannonEntropy(text);
    return entropyValue >= ENTROPY_THRESHOLD;
}

// Regex ini menangkap teks di dalam tanda kutip tunggal ('...'), ganda ("..."), atau backtick (`...`)
// yang berada di sebelah kanan tanda sama dengan (=) atau titik dua (:)
const ASSIGNMENT_PATTERN = /[:=]\s*(['"`])(.*?)\1/g;

/**
 * Fungsi utama yang akan dipanggil oleh Detection Engine di extension.ts
 * Memindai satu baris kode, mengekstrak string-nya, lalu menghitung entropinya.
 */
export function scanLineForEntropy(lineText: string, lineNumber: number) {
    const findings = [];
    let match;

    // Looping jika ada lebih dari satu variabel dalam satu baris
    while ((match = ASSIGNMENT_PATTERN.exec(lineText)) !== null) {
        // match[2] adalah isi teks di dalam tanda kutip
        const extractedString = match[2]; 
        
        if (isHighEntropySecret(extractedString)) {
            // Hitung di kolom mana string ini berada agar garis merah/kuning posisinya akurat
            const startCol = match.index + match[0].indexOf(extractedString);
            const endCol = startCol + extractedString.length;

            findings.push({
                line: lineNumber,
                startCol: startCol,
                endCol: endCol,
                secret: extractedString,
                entropy: calculateShannonEntropy(extractedString).toFixed(3)
            });
        }
    }

    return findings;
}