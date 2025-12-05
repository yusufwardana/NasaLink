import { GoogleGenAI } from "@google/genai";
import { Contact } from '../types';
import { GEMINI_CONFIG } from '../config';

export const generateWhatsAppMessage = async (
  contact: Contact, 
  context: string,
  tone: 'formal' | 'casual' | 'friendly' = 'friendly',
  overrideApiKey?: string
): Promise<string> => {
  const apiKey = overrideApiKey || GEMINI_CONFIG.apiKey;

  if (!apiKey) {
    console.error("Gemini API Key is missing.");
    return "Error: API Key AI belum disetting. Mohon input API Key di menu Setting (Admin) atau hubungi administrator.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // --- 1. ANALISIS KONDISI NASABAH (BUSINESS LOGIC) ---
    const flag = (contact.flag || '').toLowerCase();
    const status = (contact.status || '').toLowerCase();
    
    // Parse Financials
    let dpd = parseInt(contact.dpd || '0', 10);
    if (isNaN(dpd)) dpd = 0;

    let tunggakanRaw = parseInt((contact.tunggakan || '0').replace(/[^0-9]/g, ''), 10);
    if (isNaN(tunggakanRaw)) tunggakanRaw = 0;
    const tunggakanStr = contact.tunggakan || 'Rp 0';

    const flagMenunggak = (contact.flagMenunggak || '').toLowerCase();
    
    // Deteksi Status
    const isInactive = flag.includes('do') || flag.includes('drop') || flag.includes('lunas') || flag.includes('tutup') || flag.includes('inactive');
    
    // Trouble Criteria: DPD > 0 OR Tunggakan > 0 OR Flag Menunggak indicates trouble
    const isTrouble = dpd > 0 || tunggakanRaw > 0 || status.includes('macet') || status.includes('menunggak') || flagMenunggak.includes('ctx') || flagMenunggak.includes('npf') || flagMenunggak.includes('xday');
    
    const isJatuhTempo = !!contact.tglJatuhTempo;
    
    // Context Helper: Tanggal PRS
    const prsContext = contact.tglPrs ? `pada jadwal kumpulan tanggal ${contact.tglPrs}` : 'pada jadwal kumpulan kemarin';

    // Tentukan Strategi Komunikasi untuk AI
    let strategyGuide = "";

    if (isTrouble) {
        // KONDISI 1: NASABAH BERMASALAH (COLLECTION)
        
        // Cek tingkat keparahan berdasarkan DPD atau Flag Menunggak
        if (dpd <= 3 && dpd > 0 && !flagMenunggak.includes('npf')) {
             // Sub-Kondisi: EARLY COLLECTION (Baru Telat)
             strategyGuide = `
             STRATEGI: EARLY COLLECTION (SOFT REMINDER)
             - Nasabah ini BARU TELAT ${dpd} hari.
             - MASALAH: Belum membayar angsuran sebesar ${tunggakanStr} yang seharusnya masuk ${prsContext}.
             - Pendekatan: SANGAT SOPAN & POSITIF THINKING (Husnuzon).
             - Asumsikan nasabah LUPA hadir atau LUPA titip angsuran saat kumpulan tanggal ${contact.tglPrs || 'tersebut'}.
             - "Assalamualaikum Ibu, mohon maaf mengganggu. Sekadar mengingatkan angsuran tanggal ${contact.tglPrs || 'kemarin'} sebesar ${tunggakanStr} belum masuk..."
             - Hindari nada menagih yang keras/mengancam.
             `;
        } else if (flagMenunggak.includes('npf') || dpd > 30) {
            // Sub-Kondisi: NPF / MACET PARAH
             strategyGuide = `
             STRATEGI: HARD COLLECTION (PENAGIHAN SERIUS)
             - Nasabah ini BERMASALAH BERAT (Flag: ${contact.flagMenunggak}, DPD: ${dpd}).
             - Total Tunggakan: ${tunggakanStr}.
             - MASALAH UTAMA: Tidak ada pembayaran sejak jadwal PRS tanggal ${contact.tglPrs || 'lalu'}.
             - Fokus: DESAK PEMBAYARAN SEGERA.
             - Ingatkan kewajiban angsuran yang tertunggak dari jadwal PRS tersebut.
             - Minta kepastian waktu bayar hari ini.
             `;
        } else {
             // Sub-Kondisi: STANDARD COLLECTION (CTX / XDAY)
             strategyGuide = `
             STRATEGI: COLLECTION (PENAGIHAN TEGAS)
             - Nasabah ini statusnya ${contact.flagMenunggak || 'MENUNGGAK'}.
             - DPD: ${dpd} Hari.
             - POIN KUNCI: Tagih tunggakan sebesar ${tunggakanStr} yang belum terbayar dari jadwal kumpulan ${prsContext}.
             - Fokus: Ingatkan kewajiban membayar dengan tegas namun tetap profesional.
             - Tanyakan kendala kenapa tidak setor saat kumpulan tanggal ${contact.tglPrs || 'tersebut'}.
             `;
        }
    } else if (isInactive) {
        // KONDISI 2: WINBACK (MANTAN NASABAH)
        const lunasInfo = contact.tglLunas ? `sejak tanggal ${contact.tglLunas}` : "beberapa waktu lalu";
        strategyGuide = `
        STRATEGI: WINBACK (AJAK GABUNG KEMBALI)
        - Nasabah ini statusnya SUDAH LUNAS / KELUAR (${lunasInfo}).
        - Fokus: SILATURAHMI & RE-AKUISISI.
        - Sapa sebagai kawan lama, tanyakan kabar usaha dan keluarganya.
        - Informasikan bahwa BTPN Syariah terbuka jika beliau ingin mengajukan pembiayaan lagi.
        `;
    } else if (isJatuhTempo) {
        // KONDISI 3: REFINANCING (NASABAH LANCAR MAU LUNAS)
        strategyGuide = `
        STRATEGI: REFINANCING (TAWARAN TAMBAH MODAL)
        - Nasabah ini LANCAR dan angsuran akan segera selesai (Jatuh Tempo: ${contact.tglJatuhTempo}).
        - Fokus: APRESIASI & RETENSI.
        - Ucapkan terima kasih karena angsurannya lancar.
        - Tawarkan pencairan tahap berikutnya (Tambah Modal) untuk pengembangan usaha.
        `;
    } else {
        // KONDISI 4: MAINTENANCE (UMUM)
        strategyGuide = `
        STRATEGI: RELATIONSHIP MAINTENANCE
        - Fokus: Menjaga hubungan baik.
        - Sapaan hangat, tanyakan kabar sentra/kelompok.
        `;
    }

    // --- 2. PREPARE DATA DETAIL ---
    let details = `
      Nama Nasabah: ${contact.name}
      Status/Flag: ${contact.flag}
      Sentra: ${contact.sentra || '-'}
      CO (Petugas): ${contact.co || 'Admin'}
    `;

    if (contact.produk) details += `\n      Produk: ${contact.produk}`;
    if (contact.plafon) details += `\n      Plafon Terakhir: ${contact.plafon}`;
    if (contact.angsuran) details += `\n      Nominal Angsuran: ${contact.angsuran}`;
    if (contact.tunggakan) details += `\n      Total Tunggakan: ${contact.tunggakan}`;
    if (contact.os) details += `\n      Sisa Hutang (OS): ${contact.os}`;
    if (contact.saldoTabungan) details += `\n      Saldo Tabungan: ${contact.saldoTabungan}`;
    if (contact.dpd) details += `\n      Keterlambatan (DPD): ${dpd} hari`; 
    if (contact.flagMenunggak) details += `\n      Status Kolektabilitas: ${contact.flagMenunggak}`;
    if (contact.tglJatuhTempo) details += `\n      Tanggal Jatuh Tempo: ${contact.tglJatuhTempo}`;
    if (contact.tglLunas) details += `\n      Tanggal Pelunasan (Lunas): ${contact.tglLunas}`;
    if (contact.tglPrs) details += `\n      Jadwal Kumpulan (PRS): ${contact.tglPrs}`;

    // --- 3. CONSTRUCT PROMPT ---
    const prompt = `
      Bertindaklah sebagai Community Officer (CO) / Petugas Bank BTPN Syariah yang profesional, hangat, dan kekeluargaan.
      Buatkan pesan WhatsApp (Bahasa Indonesia) yang personal.

      DATA NASABAH:
      ${details}

      PANDUAN STRATEGI AI (WAJIB DIIKUTI):
      ${strategyGuide}

      KONTEKS / TUJUAN PESAN DARI USER: 
      "${context}"
      
      TONE: ${tone}

      Panduan Gaya Bahasa BTPN Syariah:
      - Gunakan sapaan "Ibu" diikuti nama nasabah.
      - Bahasa percakapan yang luwes, tidak kaku seperti robot, khas ibu-ibu pengajian/sentra.
      - Prinsip: Memberdayakan dan Tumbuh Bersama.
      - Pesan singkat, padat, personal, tanpa subject line.
      - Output hanya teks pesan saja.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Maaf, tidak dapat membuat pesan saat ini.";
  } catch (error) {
    console.error("Error generating message:", error);
    return "Maaf, terjadi kesalahan koneksi ke AI. Periksa API Key Anda.";
  }
};

export const generateBroadcastMessage = async (
  context: string,
  targetAudience: string, // e.g. "Semua Nasabah Sentra Mawar"
  tone: 'formal' | 'casual' | 'friendly' = 'friendly',
  overrideApiKey?: string
): Promise<string> => {
  const apiKey = overrideApiKey || GEMINI_CONFIG.apiKey;
  if (!apiKey) return "Error: API Key missing.";

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      Bertindaklah sebagai Community Officer (CO) BTPN Syariah.
      Buatkan SATU template pesan WhatsApp broadcast (Bahasa Indonesia) yang bersifat umum untuk dikirimkan ke banyak nasabah sekaligus.
      
      TARGET AUDIENCE: ${targetAudience}
      TUJUAN PESAN: ${context}
      TONE: ${tone}

      INSTRUKSI PENTING:
      1. Ini adalah pesan untuk Broadcast Massal.
      2. WAJIB gunakan placeholder "{name}" (persis, huruf kecil, kurung kurawal) di mana nama nasabah seharusnya berada.
         Contoh: "Assalamualaikum Ibu {name}, semoga sehat selalu..."
      3. JANGAN gunakan nama spesifik orang, JANGAN gunakan sapaan spesifik selain "{name}".
      4. Gaya bahasa hangat, sopan, khas ibu-ibu pengajian/sentra.
      5. Output hanya teks pesan saja.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "";
  } catch (error) {
    console.error("Error generating broadcast:", error);
    return "Maaf, gagal membuat draft broadcast.";
  }
};

export const extractContactsFromText = async (rawText: string, overrideApiKey?: string): Promise<string> => {
  const apiKey = overrideApiKey || GEMINI_CONFIG.apiKey;
  if (!apiKey) return "[]";

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      Ekstrak data kontak dari teks mentah berikut ini dan ubah menjadi format JSON Array.
      Setiap objek harus memiliki properti: "name", "phone" (format +62), "flag" (Gold/Silver/Platinum/Prospect), "sentra", "plafon".
      
      Teks Mentah:
      ${rawText}

      Output hanya JSON valid saja.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json"
        }
    });
    
    return response.text || "[]";
  } catch (error) {
    console.error("Error parsing contacts:", error);
    return "[]";
  }
}