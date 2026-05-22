const fs = require('fs');
const csv = require('csv-parser');

// =====================================================================
// 1. LOGIKA DETEKSI (Sesuai Hasil Tuning Ekstensi)
// =====================================================================
const PATTERN_DICTIONARY = [
    { id: 'CG001', pattern: /\bAKIA[0-9A-Z]{16,}\b/g },
    { id: 'CG002', pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
    { id: 'CG003', pattern: /\bsk_(live|test)_[0-9a-zA-Z]{24,}\b/g },
    { id: 'CG004', pattern: /\bghp_[0-9a-zA-Z]{36}\b/g },
    { id: 'CG005', pattern: /\bey[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b/g },
    { id: 'CG006', pattern: /-----BEGIN\s(RSA\s|EC\s|OPENSSH\s)?PRIVATE KEY-----/g },
    { id: 'CG007', pattern: /\b(db_password|password|passwd|pwd|secret|api_secret)\b\s*[:=]\s*['"][^'"]{8,}['"]/gi },
    { id: 'CG008', pattern: /\bxox[bpars]-[0-9A-Za-z\-]{10,}\b/g }
];

const CONFIG = {
    MIN_TOKEN_LENGTH: 20,
    ENTROPY_THRESHOLD: 4.0, 
    HIGH_ENTROPY_CHARSETS: [
        /^[0-9a-zA-Z+/=]{20,}$/,
        /^[0-9a-fA-F]{20,}$/,
        /^[0-9a-zA-Z\-_]{20,}$/
    ]
};

const ASSIGNMENT_PATTERN = /(?:=|:)\s*['"`]([^'"`\s]{20,})['"`]/g;
const SKIP_KEYWORDS = ['import ', 'require(', 'from ', 'http://', 'https://', 'console.', '//', '/*', ' * ', 'describe(', 'it(', 'test('];

function calculateShannonEntropy(str) {
    if (str.length === 0) return 0;
    const freq = {};
    for (const char of str) { freq[char] = (freq[char] || 0) + 1; }
    let entropy = 0;
    for (const key in freq) {
        const p = freq[key] / str.length;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

function runDetection(codeSnippet) {
    let isDetected = false;

    // Cek Regex
    for (const entry of PATTERN_DICTIONARY) {
        entry.pattern.lastIndex = 0;
        if (entry.pattern.test(codeSnippet)) {
            isDetected = true;
            return { isDetected };
        }
    }

    // Cek Entropy
    const lines = codeSnippet.split('\n');
    for (const line of lines) {
        const trimmed = line.trimStart();
        if (SKIP_KEYWORDS.some(kw => trimmed.includes(kw))) continue;

        ASSIGNMENT_PATTERN.lastIndex = 0;
        let match;
        while ((match = ASSIGNMENT_PATTERN.exec(line)) !== null) {
            const token = match[1];
            if (token.length < CONFIG.MIN_TOKEN_LENGTH) continue;
            const validCharset = CONFIG.HIGH_ENTROPY_CHARSETS.some(cs => cs.test(token));
            if (!validCharset) continue;
            
            const entropy = calculateShannonEntropy(token);
            if (entropy >= CONFIG.ENTROPY_THRESHOLD) {
                isDetected = true;
                return { isDetected };
            }
        }
    }
    return { isDetected };
}

// =====================================================================
// 2. MESIN EVALUASI (Membaca dengan Separator Semicolon ';')
// =====================================================================
let TP = 0, FP = 0, TN = 0, FN = 0;
let totalData = 0;

console.log("==================================================");
console.log("  PENGUJIAN AKURASI CREDGUARD (DATASET CSV)");
console.log("==================================================\n");

// Menggunakan separator ';' sesuai struktur berkas CSV Anda
fs.createReadStream('dataset.csv')
  .pipe(csv({ separator: ';' })) 
  .on('data', (row) => {
      // Memetakan ke kolom 'kode_sampel' dan 'kategori'
      const snippet = row['kode_sampel'];
      const labelRaw = row['kategori'];
      
      if (!snippet || !labelRaw) return; 

      const labelData = labelRaw.toString().toLowerCase().trim();
      
      // Jika kategori berisi 'positif', berarti ekspektasi data harus TERDETEKSI (true)
      const expected = (labelData === 'positif');
      
      const { isDetected } = runDetection(snippet);

      if (expected === true && isDetected === true) TP++;
      else if (expected === false && isDetected === true) FP++;
      else if (expected === false && isDetected === false) TN++;
      else if (expected === true && isDetected === false) FN++;
      
      totalData++;
  })
  .on('end', () => {
      console.log(`Berhasil memproses ${totalData} baris data dari dataset.csv.\n`);

      const Precision = (TP / (TP + FP)) * 100 || 0;
      const Recall    = (TP / (TP + FN)) * 100 || 0;
      const F1_Score  = 2 * ((Precision * Recall) / (Precision + Recall)) || 0;

      console.log("📊 HASIL CONFUSION MATRIX:");
      console.log(`   [TP] True Positive  : ${TP} (Kredensial asli yang berhasil dideteksi)`);
      console.log(`   [FP] False Positive : ${FP} (Kode aman yang keliru dideteksi)`);
      console.log(`   [TN] True Negative  : ${TN} (Kode aman yang berhasil dilewati)`);
      console.log(`   [FN] False Negative : ${FN} (Kredensial asli yang lolos/gagal dideteksi)\n`);

      console.log("📈 HASIL EVALUASI METRIK:");
      console.log(`   Precision : ${Precision.toFixed(2)} %`);
      console.log(`   Recall    : ${Recall.toFixed(2)} %`);
      console.log(`   F1-Score  : ${F1_Score.toFixed(2)} %\n`);
      console.log("==================================================");
  });