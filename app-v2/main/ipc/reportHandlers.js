/**
 * Report IPC Handlers
 * Handles bug report submissions via Supabase
 */

const { ipcMain } = require('electron');
const { supabase } = require('../services/supabase');
const { getCurrentUser } = require('../services/identity');

function registerReportHandlers() {
    /**
     * Submit a new report
     */
    ipcMain.handle('report:submit', async (_, { name, subject, message, images }) => {
        try {
            if (!name || !subject || !message) {
                return { error: 'Name, subject, and message are required' };
            }

            let imageUrls = [];

            // Upload images to Supabase Storage if provided
            if (images && images.length > 0) {
                for (const image of images) {
                    const filename = `${Date.now()}-${image.name}`;
                    const { data, error } = await supabase.storage
                        .from('report-images')
                        .upload(`reports/${filename}`, Buffer.from(image.data, 'base64'), {
                            contentType: image.type || 'image/png',
                        });

                    if (!error && data) {
                        const { data: urlData } = supabase.storage
                            .from('report-images')
                            .getPublicUrl(`reports/${filename}`);
                        imageUrls.push(urlData.publicUrl);
                    }
                }
            }

            // Tag the report with its author so they can read it back later.
            // Anonymous reports can be written but not selected, so only ask
            // for the inserted row when we know RLS will return it.
            const user = await getCurrentUser();
            const row = {
                name, subject, message,
                images: JSON.stringify(imageUrls),
                user_id: user?.id || null
            };

            if (!user) {
                const { error } = await supabase.from('reports').insert(row);
                if (error) throw error;

                console.log(`[Reports] New anonymous report submitted: ${subject}`);
                return { success: true, message: 'Report submitted successfully' };
            }

            const { data, error } = await supabase.from('reports').insert(row).select().single();

            if (error) throw error;

            console.log(`[Reports] New report submitted: ${subject} (ID: ${data.id})`);

            return {
                success: true,
                id: data.id,
                message: 'Report submitted successfully'
            };
        } catch (error) {
            console.error('[Reports] Error submitting report:', error);
            return { error: 'Failed to submit report' };
        }
    });

    /**
     * Reports filed by the signed-in user. RLS scopes this to the author,
     * so cross-user admin listing must go through the Supabase dashboard.
     */
    ipcMain.handle('report:getAll', async () => {
        try {
            const { data, error } = await supabase.from('reports')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return (data || []).map(report => ({
                ...report,
                images: JSON.parse(report.images || '[]')
            }));
        } catch (error) {
            console.error('[Reports] Error fetching reports:', error);
            return [];
        }
    });

    console.log('[IPC] Report handlers registered');
}

module.exports = { registerReportHandlers };
