/**
 * Auth IPC Handlers
 * Handles authentication via Supabase Auth from the renderer process
 */

const { ipcMain } = require('electron');
const { supabase } = require('../services/supabase');

function registerAuthHandlers() {
    /**
     * Sign Up - Create new user with Supabase Auth + profile
     */
    ipcMain.handle('auth:signup', async (_, { firstName, lastName, birthday, email, password }) => {
        try {
            if (!firstName || !lastName || !birthday || !email || !password) {
                return { error: 'All fields are required' };
            }
            if (password.length < 6) {
                return { error: 'Password must be at least 6 characters' };
            }

            // Create user in Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        birthday: birthday,
                    }
                }
            });

            if (authError) {
                if (authError.message.includes('already registered')) {
                    return { error: 'Email already registered' };
                }
                return { error: authError.message };
            }

            // Insert extended profile data
            const { error: profileError } = await supabase.from('profiles').upsert({
                id: authData.user.id,
                first_name: firstName,
                last_name: lastName,
                birthday: birthday,
                email: email,
            });

            if (profileError) {
                console.error('[Auth] Profile creation error:', profileError);
            }

            return {
                message: 'User created successfully',
                user: {
                    id: authData.user.id,
                    firstName,
                    lastName,
                    email,
                },
                token: authData.session?.access_token || null,
            };
        } catch (error) {
            console.error('[Auth] Signup error:', error);
            return { error: 'Failed to create user' };
        }
    });

    /**
     * Sign In - Login user via Supabase Auth
     */
    ipcMain.handle('auth:signin', async (_, { email, password }) => {
        try {
            if (!email || !password) {
                return { error: 'Email and password are required' };
            }

            const { data, error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                return { error: 'Invalid email or password' };
            }

            // Fetch profile data
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            return {
                message: 'Login successful',
                user: {
                    id: data.user.id,
                    firstName: profile?.first_name || '',
                    lastName: profile?.last_name || '',
                    email: data.user.email,
                    profilePic: profile?.profile_pic || null,
                    bio: profile?.bio || null,
                },
                token: data.session.access_token,
            };
        } catch (error) {
            console.error('[Auth] Signin error:', error);
            return { error: 'Login failed' };
        }
    });

    /**
     * Get current user profile
     */
    ipcMain.handle('auth:getUser', async () => {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();

            if (error || !user) {
                return { error: 'Not authenticated' };
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            return {
                user: {
                    id: user.id,
                    firstName: profile?.first_name || '',
                    lastName: profile?.last_name || '',
                    birthday: profile?.birthday || '',
                    email: user.email,
                    profilePic: profile?.profile_pic || null,
                    bio: profile?.bio || null,
                    createdAt: user.created_at,
                }
            };
        } catch (error) {
            console.error('[Auth] Get user error:', error);
            return { error: 'Failed to get user' };
        }
    });

    /**
     * Update user profile
     */
    ipcMain.handle('auth:updateProfile', async (_, { firstName, lastName, birthday, bio, profilePic }) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { error: 'Not authenticated' };

            const updates = {};
            if (firstName !== undefined) updates.first_name = firstName;
            if (lastName !== undefined) updates.last_name = lastName;
            if (birthday !== undefined) updates.birthday = birthday;
            if (bio !== undefined) updates.bio = bio;
            if (profilePic !== undefined) updates.profile_pic = profilePic;
            updates.updated_at = new Date().toISOString();

            const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);

            if (error) return { error: 'Failed to update profile' };

            // Fetch updated profile
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

            return {
                message: 'Profile updated successfully',
                user: {
                    id: user.id,
                    firstName: profile?.first_name,
                    lastName: profile?.last_name,
                    birthday: profile?.birthday,
                    email: user.email,
                    profilePic: profile?.profile_pic,
                    bio: profile?.bio,
                    createdAt: user.created_at,
                }
            };
        } catch (error) {
            console.error('[Auth] Update profile error:', error);
            return { error: 'Failed to update profile' };
        }
    });

    /**
     * Sign Out
     */
    ipcMain.handle('auth:signout', async () => {
        await supabase.auth.signOut();
        return { message: 'Logged out successfully' };
    });

    console.log('[IPC] Auth handlers registered');
}

module.exports = { registerAuthHandlers };
