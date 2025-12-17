
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config';
import { MessageTemplate, SheetConfig, DailyPlan, Contact } from '../types';

let supabase: any = null;

if (SUPABASE_CONFIG.url && SUPABASE_CONFIG.key) {
    try {
        supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    } catch (e) {
        console.error("Failed to init Supabase:", e);
    }
}

export const isSupabaseConfigured = () => {
    return !!supabase;
};

const toDbDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
};

const fromDbDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
};

const cleanNumber = (val: string | number | undefined): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseInt(val.replace(/[^0-9-]/g, '') || '0', 10);
};

/**
 * Fetch all contacts using pagination ranges to bypass 1000-row limit
 */
export const fetchContactsFromSupabase = async (): Promise<Contact[]> => {
    if (!supabase) return [];

    let allRows: any[] = [];
    let from = 0;
    const step = 1000;
    let isDone = false;

    try {
        // Loop fetch until no more data is returned
        while (!isDone) {
            const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .range(from, from + step - 1); // Get rows e.g., 0-999, 1000-1999, etc.

            if (error) {
                console.warn("Supabase fetch contacts error at range", from, ":", error.message);
                break;
            }

            if (data && data.length > 0) {
                allRows = [...allRows, ...data];
                from += step;
                
                // If the returned batch is smaller than step, it means we hit the end
                if (data.length < step) {
                    isDone = true;
                }
            } else {
                isDone = true;
            }
        }

        // Map the accumulated rows to App Contact type
        return allRows.map((row: any) => ({
            id: row.id,
            name: row.name,
            phone: row.phone || '',
            flag: row.flag || 'Active',
            sentra: row.sentra || '',
            co: row.co || '',
            plafon: String(row.plafon || 0),
            os: String(row.os || 0),
            angsuran: String(row.angsuran || 0),
            tunggakan: String(row.tunggakan || 0),
            saldoTabungan: String(row.saldo_tabungan || 0),
            dpd: String(row.dpd || 0),
            produk: row.produk || '',
            tglJatuhTempo: row.tgl_jatuh_tempo || '', 
            tglPrs: row.tgl_prs || '',
            status: row.status || '',
            notes: row.notes || '',
            appId: row.app_id || '',
            cif: row.cif || '',
            tglLunas: row.tgl_lunas || '',
            flagMenunggak: row.flag_menunggak || '',
            flagLantakur: row.flag_lantakur || '',
            mapping: row.mapping || '',
            lastInteraction: row.last_interaction || ''
        }));
    } catch (e) {
        console.warn("Supabase connection failed (fetchContacts):", e);
        return [];
    }
};

export const saveContactToSupabase = async (contact: Contact): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");

    const dbRow = {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        flag: contact.flag,
        sentra: contact.sentra,
        co: contact.co,
        plafon: cleanNumber(contact.plafon),
        os: cleanNumber(contact.os),
        angsuran: cleanNumber(contact.angsuran),
        tunggakan: cleanNumber(contact.tunggakan),
        saldo_tabungan: cleanNumber(contact.saldoTabungan),
        dpd: cleanNumber(contact.dpd),
        produk: contact.produk,
        tgl_jatuh_tempo: contact.tglJatuhTempo,
        tgl_prs: contact.tglPrs,
        status: contact.status,
        notes: contact.notes,
        app_id: contact.appId,
        cif: contact.cif,
        tgl_lunas: contact.tglLunas,
        flag_menunggak: contact.flagMenunggak,
        flag_lantakur: contact.flagLantakur,
        mapping: contact.mapping,
        last_interaction: contact.lastInteraction
    };

    const { error } = await supabase
        .from('contacts')
        .upsert(dbRow);

    if (error) {
        throw new Error(`Gagal simpan kontak: ${error.message}`);
    }
};

export const saveContactsBatchToSupabase = async (contacts: Contact[]): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    if (contacts.length === 0) return;

    const dbRows = contacts.map(contact => ({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        flag: contact.flag,
        sentra: contact.sentra,
        co: contact.co,
        plafon: cleanNumber(contact.plafon),
        os: cleanNumber(contact.os),
        angsuran: cleanNumber(contact.angsuran),
        tunggakan: cleanNumber(contact.tunggakan),
        saldo_tabungan: cleanNumber(contact.saldoTabungan),
        dpd: cleanNumber(contact.dpd),
        produk: contact.produk,
        tgl_jatuh_tempo: contact.tglJatuhTempo,
        tgl_prs: contact.tglPrs,
        status: contact.status,
        notes: contact.notes,
        app_id: contact.appId,
        cif: contact.cif,
        tgl_lunas: contact.tglLunas,
        flag_menunggak: contact.flagMenunggak,
        flag_lantakur: contact.flagLantakur,
        mapping: contact.mapping,
        last_interaction: contact.lastInteraction
    }));

    const { error } = await supabase
        .from('contacts')
        .upsert(dbRows);

    if (error) {
        throw new Error(`Gagal batch update: ${error.message}`);
    }
};

export const deleteContactFromSupabase = async (id: string): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");

    const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(`Gagal hapus kontak: ${error.message}`);
    }
};

export const fetchPlansFromSupabase = async (): Promise<DailyPlan[]> => {
    if (!supabase) return [];

    try {
        const { data, error } = await supabase
            .from('daily_plans')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.warn("Supabase fetch plans error:", error.message);
            return [];
        }

        return (data || []).map((row: any) => ({
            id: row.id,
            date: fromDbDate(row.date),
            coName: row.co_name,
            swCurrentNoa: String(row.sw_current_noa || 0),
            swCurrentDisb: String(row.sw_current_disb || 0),
            swNextNoa: String(row.sw_next_noa || 0),
            swNextDisb: String(row.sw_next_disb || 0),
            colCtxNoa: String(row.col_ctx_noa || 0),
            colCtxOs: String(row.col_ctx_os || 0),
            colLantakurNoa: String(row.col_lantakur_noa || 0),
            colLantakurOs: String(row.col_lantakur_os || 0),
            fppbNoa: String(row.fppb_noa || 0),
            biometrikNoa: String(row.biometrik_noa || 0),
            actualSwNoa: String(row.actual_sw_noa || 0),
            actualSwDisb: String(row.actual_sw_disb || 0),
            actualSwNextNoa: String(row.actual_sw_next_noa || 0),
            actualSwNextDisb: String(row.actual_sw_next_disb || 0),
            actualCtxNoa: String(row.actual_ctx_noa || 0),
            actualCtxOs: String(row.actual_ctx_os || 0),
            actualLantakurNoa: String(row.actual_lantakur_noa || 0),
            actualLantakurOs: String(row.actual_lantakur_os || 0),
            actualFppbNoa: String(row.actual_fppb_noa || 0),
            actualBiometrikNoa: String(row.actual_biometrik_noa || 0),
            notes: row.notes || ''
        }));
    } catch (e) {
        console.warn("Supabase connection failed (fetchPlans):", e);
        return [];
    }
};

export const savePlanToSupabase = async (plan: DailyPlan): Promise<void> => {
    if (!supabase) return;

    const num = (val?: string) => cleanNumber(val);

    const dbRow = {
        id: plan.id,
        date: toDbDate(plan.date),
        co_name: plan.coName,
        sw_current_noa: num(plan.swCurrentNoa),
        sw_current_disb: num(plan.swCurrentDisb),
        sw_next_noa: num(plan.swNextNoa),
        sw_next_disb: num(plan.swNextDisb),
        col_ctx_noa: num(plan.colCtxNoa),
        col_ctx_os: num(plan.colCtxOs),
        col_lantakur_noa: num(plan.colLantakurNoa),
        col_lantakur_os: num(plan.colLantakurOs),
        fppb_noa: num(plan.fppbNoa),
        biometrik_noa: num(plan.biometrikNoa),
        actual_sw_noa: num(plan.actualSwNoa),
        actual_sw_disb: num(plan.actualSwDisb),
        actual_sw_next_noa: num(plan.actualSwNextNoa),
        actual_sw_next_disb: num(plan.actualSwNextDisb),
        actual_ctx_noa: num(plan.actualCtxNoa),
        actual_ctx_os: num(plan.actualCtxOs),
        actual_lantakur_noa: num(plan.actualLantakurNoa),
        actual_lantakur_os: num(plan.actualLantakurOs),
        actual_fppb_noa: num(plan.actualFppbNoa),
        actual_biometrik_noa: num(plan.actualBiometrikNoa),
        notes: plan.notes
    };

    try {
        const { error } = await supabase
            .from('daily_plans')
            .upsert(dbRow);

        if (error) {
            console.warn("Supabase save plan error:", error.message);
        }
    } catch (e) {
        console.warn("Supabase connection failed (savePlan):", e);
    }
};

export const fetchTemplatesFromSupabase = async (): Promise<MessageTemplate[]> => {
    if (!supabase) return [];
    
    try {
        const { data, error } = await supabase
            .from('templates')
            .select('*')
            .order('label', { ascending: true });

        if (error) {
            return [];
        }

        return (data || []).map((row: any) => ({
            id: row.id,
            label: row.label,
            type: row.type,
            promptContext: row.prompt_context,
            content: row.content,
            icon: row.icon
        }));
    } catch (e) {
        console.warn("Supabase connection failed (fetchTemplates):", e);
        return [];
    }
};

export const saveTemplatesToSupabase = async (templates: MessageTemplate[]): Promise<void> => {
    if (!supabase) return;

    try {
        const dbRows = templates.map(t => ({
            id: t.id,
            label: t.label,
            type: t.type,
            prompt_context: t.promptContext,
            content: t.content,
            icon: t.icon
        }));

        const { error: deleteError } = await supabase
            .from('templates')
            .delete()
            .neq('id', 'placeholder_never_match'); 

        const { error } = await supabase
            .from('templates')
            .upsert(dbRows);

        if (error) {
            console.warn("Supabase save templates error:", error.message);
        }
    } catch (e) {
        console.warn("Supabase connection failed (saveTemplates):", e);
    }
};

export const fetchSettingsFromSupabase = async (): Promise<Partial<SheetConfig> | null> => {
    if (!supabase) return null;

    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'sheet_config')
            .single();

        if (error) return null;

        if (data && data.value) {
            return data.value as SheetConfig;
        }
    } catch (e) {
        console.warn("Supabase connection failed (fetchSettings):", e);
    }
    return null;
};

export const saveSettingsToSupabase = async (config: SheetConfig): Promise<void> => {
    if (!supabase) return;

    try {
        const { error } = await supabase
            .from('app_settings')
            .upsert({ 
                key: 'sheet_config', 
                value: config 
            });

        if (error) {
            throw new Error(error.message);
        }
    } catch (e) {
        throw new Error("Gagal koneksi ke Supabase. Periksa internet.");
    }
};
