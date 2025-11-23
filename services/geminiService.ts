import { GoogleGenAI } from "@google/genai";
import { Contact } from '../types';

const apiKey = process.env.API_KEY || ''; 

const ai = new GoogleGenAI({ apiKey });

export const generateWhatsAppMessage = async (
  contact: Contact, // Changed to accept full Contact object
  context: string,
  tone: 'formal' | 'casual' | 'friendly' = 'friendly'
): Promise<string> => {
  try {
    // Build rich context from contact details
    let details = `
      Nama Nasabah: ${contact.name}
      Status/Segmen: ${contact.segment}
      Sentra: ${contact.sentra || '-'}
      CO (Petugas): ${contact.co || 'Admin'}
    `;

    if (contact.produk) details += `\n      Produk: ${contact.produk}`;
    if (contact.plafon) details += `\n      Plafon: ${contact.plafon}`;
    if (contact.tglJatuhTempo) details += `\n      Tanggal Jatuh Tempo: ${contact.tglJatuhTempo}`;
    if (contact.statusAsli) details += `\n      Status Rekening: ${contact.statusAsli}`;
    if (contact.flag) details += `\n      Flag: ${contact.flag}`;

    const prompt = `
      Bertindaklah sebagai Community Officer (CO) / Petugas Bank BTPN Syariah yang profesional namun kekeluargaan.
      Buatkan pesan WhatsApp (Bahasa Indonesia) untuk nasabah (Ibu-ibu di sentra) dengan detail berikut:
      
      DATA NASABAH:
      ${details}

      TUJUAN PESAN / KONTEKS: 
      ${context}
      
      TONE: ${tone}

      Panduan Khusus BTPN Syariah:
      - Gunakan sapaan "Ibu" diikuti nama nasabah.
      - Jika ada info 'Jatuh Tempo' atau 'Angsuran' dalam Tujuan Pesan, gunakan data tanggal jatuh tempo/plafon yang tersedia di atas secara cerdas (jangan kaku).
      - Prinsip: 'Tepat Waktu, Tepat Jumlah'.
      - Fokus pada silaturahmi, pemberdayaan, dan kekeluargaan.
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
    return "Maaf, terjadi kesalahan koneksi ke AI. Silakan coba lagi.";
  }
};

export const extractContactsFromText = async (rawText: string): Promise<string> => {
  try {
    const prompt = `
      Ekstrak data kontak dari teks mentah berikut ini dan ubah menjadi format JSON Array.
      Setiap objek harus memiliki properti: "name", "phone" (format +62), "segment", "sentra", "plafon".
      
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