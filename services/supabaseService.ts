import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config';
import { MessageTemplate, SheetConfig } from '../types';

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

// --- TEMPLATES ---

export const fetchTemplatesFromSupabase = async (): Promise<MessageTemplate[]> => {
    if (!supabase) return [];
    
    const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('label', { ascending: true });

    if (error) {
        console.error("Supabase fetch templates error:", error);
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
    // Note: We use upsert for simplicity. To handle deletions properly, 
    // ideally we would delete items not in the list, but for this simple app
    // we'll just upsert all valid ones. If user deleted locally, we might need a sync strategy.
    // STRATEGY: Delete all and re-insert to ensure full sync with Admin state.
    
    // 1. Delete all (Truncate-like approach for sync)
    // Warning: This is destructive if multiple admins edit at once, but fine for single admin usage.
    const { error: deleteError } = await supabase
        .from('templates')
        .delete()
        .neq('id', 'placeholder_never_match'); // Delete all rows

    if (deleteError) console.error("Error clearing templates:", deleteError);

    // 2. Insert new state
    const { error } = await supabase
        .from('templates')
        .upsert(dbRows);

    if (error) {
        console.error("Supabase save templates error:", error);
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
        console.error("Supabase fetch settings error:", error);
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
        console.error("Supabase save settings error:", error);
        throw error;
    }
};