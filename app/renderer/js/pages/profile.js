/**
 * User Profile Dashboard Page
 */

const ProfilePage = {
    userData: null,

    async render() {
        const container = document.getElementById('main-content');
        const token = localStorage.getItem('authToken');

        if (!token) {
            // Not logged in, redirect to auth
            router.navigate('auth');
            return;
        }

        // Show loading
        container.innerHTML = `
            <div class="loading-screen">
                <div class="loading-spinner"></div>
                <p>Loading profile...</p>
            </div>
        `;

        // Fetch user data
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Failed to load profile');
            }

            const data = await response.json();
            this.userData = data.user;
        } catch (error) {
            console.error('Failed to load profile:', error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            router.navigate('auth');
            return;
        }

        this.renderContent(container);
        this.attachEventListeners();
    },

    renderContent(container) {
        const user = this.userData;
        const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
        const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        container.innerHTML = `
            <div class="profile-page">
                <div class="profile-header">
                    <h1>My Profile</h1>
                    <button class="btn-logout" id="btn-logout">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Logout
                    </button>
                </div>

                <div class="profile-content">
                    <!-- Profile Card -->
                    <div class="profile-card">
                        <div class="profile-avatar-section">
                            <div class="profile-avatar" id="profile-avatar">
                                ${user.profilePic
                ? `<img src="${user.profilePic}" alt="Profile">`
                : `<div class="avatar-initials">${initials}</div>`
            }
                            </div>
                            <button class="btn-change-avatar" id="btn-change-avatar">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                    <circle cx="12" cy="13" r="4"/>
                                </svg>
                                Change Photo
                            </button>
                            <input type="file" id="avatar-input" accept="image/*" style="display: none;">
                        </div>

                        <div class="profile-info">
                            <h2 class="profile-name">${user.firstName} ${user.lastName}</h2>
                            <p class="profile-email">${user.email}</p>
                            <p class="profile-member-since">Member since ${memberSince}</p>
                        </div>
                    </div>

                    <!-- Edit Form -->
                    <div class="profile-edit-section">
                        <h3>Edit Profile</h3>
                        <form class="profile-form" id="profile-form">
                            <div class="form-row">
                                <div class="form-group">
                                    <label>First Name</label>
                                    <input type="text" id="edit-firstname" value="${user.firstName || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label>Last Name</label>
                                    <input type="text" id="edit-lastname" value="${user.lastName || ''}" required>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Birthday</label>
                                <input type="date" id="edit-birthday" value="${user.birthday || ''}">
                            </div>

                            <div class="form-group">
                                <label>Bio</label>
                                <textarea id="edit-bio" placeholder="Tell us about yourself..." rows="4">${user.bio || ''}</textarea>
                            </div>

                            <div class="form-actions">
                                <button type="submit" class="btn-save" id="btn-save">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                        <polyline points="17 21 17 13 7 13 7 21"/>
                                        <polyline points="7 3 7 8 15 8"/>
                                    </svg>
                                    Save Changes
                                </button>
                            </div>

                            <p class="form-message" id="form-message"></p>
                        </form>
                    </div>
                </div>
            </div>
        `;
    },

    attachEventListeners() {
        // Logout button
        document.getElementById('btn-logout').addEventListener('click', () => {
            window.logoutUser();
        });

        // Change avatar button
        document.getElementById('btn-change-avatar').addEventListener('click', () => {
            document.getElementById('avatar-input').click();
        });

        // Avatar file input - opens cropper
        document.getElementById('avatar-input').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Reset file input so same file can be selected again
            e.target.value = '';

            // Convert to base64 and open cropper
            const reader = new FileReader();
            reader.onload = (event) => {
                const imageSrc = event.target.result;

                // Open cropper modal
                ImageCropper.open(imageSrc, async (croppedImage) => {
                    // croppedImage is already compressed JPEG base64
                    await this.updateProfile({ profilePic: croppedImage });

                    // Update avatar display
                    const avatarEl = document.getElementById('profile-avatar');
                    avatarEl.innerHTML = `<img src="${croppedImage}" alt="Profile">`;
                });
            };
            reader.readAsDataURL(file);
        });

        // Profile form
        document.getElementById('profile-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const firstName = document.getElementById('edit-firstname').value;
            const lastName = document.getElementById('edit-lastname').value;
            const birthday = document.getElementById('edit-birthday').value;
            const bio = document.getElementById('edit-bio').value;

            await this.updateProfile({ firstName, lastName, birthday, bio });
        });
    },

    async updateProfile(updates) {
        const token = localStorage.getItem('authToken');
        const messageEl = document.getElementById('form-message');
        const saveBtn = document.getElementById('btn-save');

        try {
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
            }

            const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update profile');
            }

            // Update local storage
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            const updatedUser = { ...storedUser, ...data.user };
            localStorage.setItem('user', JSON.stringify(updatedUser));

            // Update sidebar
            if (window.updateUserUI) window.updateUserUI();

            // Show success message
            if (messageEl) {
                messageEl.textContent = 'Profile updated successfully!';
                messageEl.className = 'form-message success';
                setTimeout(() => {
                    messageEl.textContent = '';
                }, 3000);
            }

            // Update local data
            this.userData = data.user;

        } catch (error) {
            console.error('Update error:', error);
            if (messageEl) {
                messageEl.textContent = error.message;
                messageEl.className = 'form-message error';
            }
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                    </svg>
                    Save Changes
                `;
            }
        }
    }
};

window.ProfilePage = ProfilePage;
