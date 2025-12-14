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
    const isLantakur = (contact.flagLantakur || '').toLowerCase().includes('lantakur');
    
    // Deteksi Status
    const isInactive = flag.includes('do') || flag.includes('drop') || flag.includes('lunas') || flag.includes('tutup') || flag.includes('inactive');
    
    // Trouble Criteria
    const isTrouble = dpd > 0 || tunggakanRaw > 0 || status.includes('macet') || status.includes('menunggak') || flagMenunggak.includes('ctx') || flagMenunggak.includes('npf') || flagMenunggak.includes('xday');
    const isJatuhTempo = !!contact.tglJatuhTempo;
    
    // Tentukan Strategi Komunikasi untuk AI
    let strategyGuide = "";

    if (isTrouble) {
        if (dpd <= 3 && dpd > 0 && !flagMenunggak.includes('npf')) {
             strategyGuide = `STRATEGI: EARLY COLLECTION (SOFT REMINDER). Nasabah telat ${dpd} hari. Tagih ${tunggakanStr} dengan sangat SOPAN & POSITIF. Asumsikan lupa.`;
        } else if (flagMenunggak.includes('npf') || dpd > 30) {
             strategyGuide = `STRATEGI: HARD COLLECTION. Nasabah MACET PARAH (DPD ${dpd}). Tagih ${tunggakanStr} dengan TEGAS. Minta kepastian bayar HARI INI.`;
        } else {
             strategyGuide = `STRATEGI: STANDARD COLLECTION. Status: ${contact.flagMenunggak}. Tagih ${tunggakanStr}. Ingatkan kewajiban & tanyakan kendala.`;
        }
    } else if (isInactive) {
        strategyGuide = `STRATEGI: WINBACK. Mantan nasabah (Lunas: ${contact.tglLunas || 'Lama'}). Sapa hangat, tanyakan kabar, tawarkan gabung kembali.`;
    } else if (isJatuhTempo) {
        strategyGuide = `STRATEGI: REFINANCING. Nasabah Lancar mau lunas. Ucapkan selamat, tawarkan tambah modal (Pencairan Tahap Lanjut).`;
    } else if (isLantakur) {
        strategyGuide = `STRATEGI: EDUKASI MENABUNG. Nasabah Lancar tapi tabungan kurang. Apresiasi angsuran, ajak tambah tabungan sukarela.`;
    } else {
        strategyGuide = `STRATEGI: RELATIONSHIP MAINTENANCE. Sapaan hangat rutin untuk menjaga silaturahmi.`;
    }

    // --- 2. PREPARE DATA DETAIL ---
    let details = `
      Nama: ${contact.name}
      Status: ${contact.flag} | ${contact.flagMenunggak || 'Lancar'}
      Sentra: ${contact.sentra || '-'}
      CO: ${contact.co || 'Admin'}
      Produk: ${contact.produk || '-'}
      Angsuran: ${contact.angsuran || '-'}
      Tunggakan: ${contact.tunggakan || '-'}
      Sisa OS: ${contact.os || '-'}
      Tabungan: ${contact.saldoTabungan || '-'}
      DPD: ${dpd} hari
      Jatuh Tempo: ${contact.tglJatuhTempo || '-'}
      Tgl PRS: ${contact.tglPrs || '-'}
    `;

    // --- 3. CONSTRUCT PROMPT ---
    const prompt = `
      Bertindaklah sebagai Community Officer (CO) BTPN Syariah yang profesional namun sangat kekeluargaan (khas ibu-ibu sentra).
      Tugasmu: Buatkan pesan WhatsApp personal (Bahasa Indonesia).

      DATA NASABAH:
      ${details}

      PANDUAN STRATEGI:
      ${strategyGuide}

      INSTRUKSI USER: 
      "${context}"
      
      TONE: ${tone}

      Panduan Gaya Bahasa:
      - Sapaan "Ibu {Nama}".
      - Jangan kaku seperti robot. Gunakan bahasa lisan yang sopan, hangat, dan empati.
      - Output HANYA teks pesan (tanpa subject/penjelasan).
    `;

    // UPGRADE: Use Gemini 3 Pro with Thinking Mode
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
      }
    });

    return response.text || "Maaf, tidak dapat membuat pesan saat ini.";
  } catch (error) {
    console.error("Error generating message:", error);
    return "Maaf, terjadi kesalahan koneksi ke AI. Periksa API Key Anda.";
  }
};

export const generateBroadcastMessage = async (
  context: string,
  targetAudience: string,
  tone: 'formal' | 'casual' | 'friendly' = 'friendly',
  overrideApiKey?: string
): Promise<string> => {
  const apiKey = overrideApiKey || GEMINI_CONFIG.apiKey;
  if (!apiKey) return "Error: API Key missing.";

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      Bertindaklah sebagai CO BTPN Syariah. Buatkan SATU template pesan Broadcast WhatsApp.
      Target: ${targetAudience}
      Tujuan: ${context}
      Tone: ${tone}

      Aturan:
      1. WAJIB gunakan placeholder "{name}" untuk nama nasabah.
      2. Bahasa hangat, sopan, merangkul.
      3. Output HANYA teks pesan.
    `;

    // Broadcast uses fast model
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
    const prompt = `Ekstrak data kontak (JSON Array) dari teks ini. Properti: name, phone (format 62), flag, sentra. Teks:\n${rawText}`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return response.text || "[]";
  } catch (error) {
    return "[]";
  }
}