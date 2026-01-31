import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const userId = formData.get('userId') as string;

        if (!file) {
            return new Response(
                JSON.stringify({ success: false, error: 'No file uploaded' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Sanitize filename
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop();
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `${userId || 'anonymous'}/${timestamp}_${cleanFileName}`;

        console.log(`Uploading file ${file.name} to path ${path}...`);

        // Upload file to 'cvs' bucket
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('cvs')
            .upload(path, file, {
                contentType: file.type,
                upsert: false
            });

        if (uploadError) {
            throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('cvs')
            .getPublicUrl(path);

        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    path: path,
                    url: publicUrl,
                    name: file.name,
                    size: file.size,
                    type: file.type
                }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error uploading CV:', error);
        return new Response(
            JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
