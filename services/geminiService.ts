import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || ''; // Assumed to be present in environment

const ai = new GoogleGenAI({ apiKey });

export const generateWhatsAppMessage = async (
  customerName: string,
  customerSegment: string,
  context: string,
  tone: 'formal' | 'casual' | 'friendly' = 'friendly'
): Promise<string> => {
  try {
    const prompt = `
      Bertindaklah sebagai agen asuransi/sales profesional yang ramah.
      Buatkan pesan WhatsApp (Bahasa Indonesia) untuk nasabah dengan detail berikut:
      
      Nama Nasabah: ${customerName}
      Segmen: ${customerSegment}
      Tujuan Pesan: ${context}
      Tone: ${tone}

      Panduan:
      - Gunakan sapaan yang sesuai (Bapak/Ibu jika formal, Kak/Mas/Mba jika casual).
      - Pesan harus singkat, padat, dan personal.
      - Jangan gunakan subject line (karena ini chat WhatsApp).
      - Sertakan call to action yang sopan di akhir.
      - Hanya berikan output teks pesan saja, tanpa tanda kutip atau penjelasan tambahan.
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
      Setiap objek harus memiliki properti: "name" (string), "phone" (string, formatkan ke +62), "segment" (tebak berdasarkan konteks atau default ke 'Prospect').
      
      Teks Mentah:
      ${rawText}

      Output hanya JSON valid saja tanpa markdown block.
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
