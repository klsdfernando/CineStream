/**
 * Report IPC Handlers
 * Handles bug report submissions via Supabase
 */

const { ipcMain } = require('electron');
const { supabase } = require('../services/supabase');

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

            // Insert into reports table
            const { data, error } = await supabase.from('reports').insert({
                name, subject, message,
                images: JSON.stringify(imageUrls),
            }).select().single();

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
     * Get all reports (for admin use)
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
