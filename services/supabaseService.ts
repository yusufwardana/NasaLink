
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config';
import { MessageTemplate, SheetConfig, DailyPlan } from '../types';

let supabase: any = null;

// Initialize Supabase Client
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

// --- HELPER: DATE CONVERSION ---
// App uses DD/MM/YYYY, DB uses YYYY-MM-DD
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

// --- DAILY PLANS (NEW) ---

export const fetchPlansFromSupabase = async (): Promise<DailyPlan[]> => {
    if (!supabase) return [];

    // Fetch last 3 months to keep payload light, or all if needed. 
    // Currently fetching all for simplicity.
    const { data, error } = await supabase
        .from('daily_plans')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        // Code 42P01: Relation does not exist (Table missing)
        if (error.code === '42P01') {
            console.warn("Supabase Table 'daily_plans' belum dibuat. Mohon jalankan script SQL di Supabase.");
            return [];
        }
        console.error("Supabase fetch plans error:", error.message || JSON.stringify(error));
        return [];
    }

    return (data || []).map((row: any) => ({
        id: row.id,
        date: fromDbDate(row.date),
        coName: row.co_name,
        
        // Target
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

        // Actual
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
};

export const savePlanToSupabase = async (plan: DailyPlan): Promise<void> => {
    if (!supabase) throw new Error("Supabase belum dikonfigurasi");

    // Helper to clean numbers
    const num = (val?: string) => parseInt((val || '0').replace(/[^0-9]/g, ''), 10);

    const dbRow = {
        id: plan.id,
        date: toDbDate(plan.date),
        co_name: plan.coName,

        // Target
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

        // Actual
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

    const { error } = await supabase
        .from('daily_plans')
        .upsert(dbRow);

    if (error) {
        console.error("Supabase save plan error:", error.message || JSON.stringify(error));
        throw new Error(error.message || "Gagal menyimpan data ke server.");
    }
};

// --- TEMPLATES ---

export const fetchTemplatesFromSupabase = async (): Promise<MessageTemplate[]> => {
    if (!supabase) return [];
    
    const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('label', { ascending: true });

    if (error) {
        if (error.code === '42P01') {
             console.warn("Table 'templates' does not exist.");
             return [];
        }
        console.error("Supabase fetch templates error:", error.message || JSON.stringify(error));
        throw error;
    }

    // Map snake_case (DB) to camelCase (App)
    return (data || []).map((row: any) => ({
        id: row.id,
        label: row.label,
        type: row.type,
        promptContext: row.prompt_context,
        content: row.content,
        icon: row.icon
    }));
};

export const saveTemplatesToSupabase = async (templates: MessageTemplate[]): Promise<void> => {
    if (!supabase) throw new Error("Supabase belum dikonfigurasi");

    // Map camelCase (App) to snake_case (DB)
    const dbRows = templates.map(t => ({
        id: t.id,
        label: t.label,
        type: t.type,
        prompt_context: t.promptContext,
        content: t.content,
        icon: t.icon
    }));

    // Upsert (Insert or Update)
    // Strategy: Delete all and re-insert to ensure full sync with Admin state.
    
    // 1. Delete all (Truncate-like approach for sync)
    const { error: deleteError } = await supabase
        .from('templates')
        .delete()
        .neq('id', 'placeholder_never_match'); 

    if (deleteError) console.error("Error clearing templates:", deleteError.message);

    // 2. Insert new state
    const { error } = await supabase
        .from('templates')
        .upsert(dbRows);

    if (error) {
        console.error("Supabase save templates error:", error.message || JSON.stringify(error));
        throw error;
    }
};

// --- APP SETTINGS (Spreadsheet Config) ---

export const fetchSettingsFromSupabase = async (): Promise<Partial<SheetConfig> | null> => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'sheet_config')
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
        // 42P01 is Table Missing
        if (error.code === '42P01') {
            console.warn("Table 'app_settings' does not exist.");
            return null;
        }
        console.error("Supabase fetch settings error:", error.message || JSON.stringify(error));
        return null;
    }

    if (data && data.value) {
        return data.value as SheetConfig;
    }
    return null;
};

export const saveSettingsToSupabase = async (config: SheetConfig): Promise<void> => {
    if (!supabase) throw new Error("Supabase belum dikonfigurasi");

    const { error } = await supabase
        .from('app_settings')
        .upsert({ 
            key: 'sheet_config', 
            value: config 
        });

    if (error) {
        console.error("Supabase save settings error:", error.message || JSON.stringify(error));
        throw error;
    }
};
