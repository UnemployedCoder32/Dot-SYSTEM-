// supabase-config.js
// Centralized configuration for Supabase Cloud Database

const SUPABASE_URL = "https://yglmnkdlqnjqercuheva.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_L86rm2kWcb3zpQrCeLBwBA_PWNy6gIm";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.SupabaseDB = {
    client: _supabase,
    
    // Helper to get all app data
    async getData() {
        const { data, error } = await _supabase
            .from('app_state')
            .select('data')
            .eq('id', 'dotsystem_v1')
            .single();
            
        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
            console.error('📊 Supabase Load Error:', error.message);
            return null;
        }
        return data ? data.data : null;
    },

    // Helper to save all app data
    async saveData(payload) {
        const { error } = await _supabase
            .from('app_state')
            .upsert({ 
                id: 'dotsystem_v1', 
                data: payload,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        if (error) {
            console.error('📊 Supabase Save Error:', error.message);
            return false;
        }
        return true;
    }
};

console.log('✅ Supabase: Cloud Link Ready.');
