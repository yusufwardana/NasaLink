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
    // Initialize AI client dynamically with the provided key
    const ai = new GoogleGenAI({ apiKey });

    // Build rich context from contact details
    let details = `
      Nama Nasabah: ${contact.name}
      Flag/Segmen: ${contact.flag}
      Sentra: ${contact.sentra || '-'}
      CO (Petugas): ${contact.co || 'Admin'}
    `;

    if (contact.produk) details += `\n      Produk: ${contact.produk}`;
    if (contact.plafon) details += `\n      Plafon: ${contact.plafon}`;
    if (contact.tglJatuhTempo) details += `\n      Tanggal Selesai Angsuran (Jatuh Tempo): ${contact.tglJatuhTempo}`;
    if (contact.status) details += `\n      Status Rekening: ${contact.status}`;

    const prompt = `
      Bertindaklah sebagai Community Officer (CO) / Petugas Bank BTPN Syariah yang profesional, hangat, dan kekeluargaan.
      Buatkan pesan WhatsApp (Bahasa Indonesia) untuk nasabah (Ibu-ibu di sentra) dengan detail berikut:
      
      DATA NASABAH:
      ${details}

      TUJUAN PESAN / KONTEKS: 
      ${context}
      
      TONE: ${tone}

      Panduan Khusus BTPN Syariah:
      - Gunakan sapaan "Ibu" diikuti nama nasabah.
      - PENTING: Jika konteksnya mengenai 'Jatuh Tempo', ITU ARTINYA nasabah sebentar lagi LUNAS/SELESAI angsurannya. 
      - Tujuannya adalah MENAWARKAN PENCAIRAN KEMBALI (Tambah Modal) atau mengucapkan selamat karena sebentar lagi lunas. JANGAN menagih hutang/memberi peringatan bayar, tapi berikan kabar gembira peluang lanjut siklus berikutnya.
      - Prinsip: Memberdayakan dan Tumbuh Bersama.
      - Pesan singkat, padat, personal, tanpa subject line.
      - Hanya berikan output teks pesan saja.
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