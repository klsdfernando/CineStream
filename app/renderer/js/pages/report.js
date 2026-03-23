/**
 * Report a Problem Page - Submit bug reports and feedback
 */

const ReportPage = {
    selectedImages: [],

    async render() {
        const container = document.getElementById('main-content');

        container.innerHTML = `
            <div class="report-page fade-in">
                <div class="report-header">
                    <h1>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                            <line x1="4" y1="22" x2="4" y2="15"/>
                        </svg>
                        Report a Problem
                    </h1>
                    <p class="report-subtitle">Help us improve by reporting bugs, issues, or suggestions</p>
                </div>

                <form class="report-form" id="report-form">
                    <div class="form-group">
                        <label for="report-name">Your Name</label>
                        <input type="text" id="report-name" name="name" placeholder="Enter your name" required>
                    </div>

                    <div class="form-group">
                        <label for="report-subject">Subject</label>
                        <input type="text" id="report-subject" name="subject" placeholder="Brief description of the issue" required>
                    </div>

                    <div class="form-group">
                        <label for="report-message">Message</label>
                        <textarea id="report-message" name="message" rows="6" placeholder="Describe the problem in detail. Include steps to reproduce if applicable." required></textarea>
                    </div>

                    <div class="form-group">
                        <label>Screenshots (Optional - Max 3 images)</label>
                        <div class="image-upload-area" id="image-upload-area">
                            <input type="file" id="image-input" accept="image/*" multiple hidden>
                            <div class="upload-placeholder" id="upload-placeholder">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                    <polyline points="21 15 16 10 5 21"/>
                                </svg>
                                <p>Click or drag images here</p>
                                <span>PNG, JPG up to 10MB each</span>
                            </div>
                            <div class="image-previews" id="image-previews"></div>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="btn-submit" id="submit-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="22" y1="2" x2="11" y2="13"/>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                            </svg>
                            Submit Report
                        </button>
                    </div>
                </form>

                <div class="report-success hidden" id="report-success">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <h2>Report Submitted!</h2>
                    <p>Thank you for your feedback. We'll look into this issue.</p>
                    <button class="btn-new-report" id="btn-new-report">Submit Another Report</button>
                </div>
            </div>
        `;

        this.setupEventListeners();
    },

    setupEventListeners() {
        const form = document.getElementById('report-form');
        const imageInput = document.getElementById('image-input');
        const uploadArea = document.getElementById('image-upload-area');
        const uploadPlaceholder = document.getElementById('upload-placeholder');
        const newReportBtn = document.getElementById('btn-new-report');

        // Form submission
        form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Click to upload
        uploadPlaceholder.addEventListener('click', () => imageInput.click());

        // File input change
        imageInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            this.handleFileSelect(e.dataTransfer.files);
        });

        // New report button
        newReportBtn.addEventListener('click', () => this.resetForm());
    },

    handleFileSelect(files) {
        const fileArray = Array.from(files);
        const imageFiles = fileArray.filter(f => f.type.startsWith('image/'));

        // Limit to 3 images total
        const remaining = 3 - this.selectedImages.length;
        const toAdd = imageFiles.slice(0, remaining);

        this.selectedImages.push(...toAdd);
        this.updateImagePreviews();
    },

    updateImagePreviews() {
        const previewsContainer = document.getElementById('image-previews');
        const placeholder = document.getElementById('upload-placeholder');

        previewsContainer.innerHTML = '';

        this.selectedImages.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.createElement('div');
                preview.className = 'image-preview';
                preview.innerHTML = `
                    <img src="${e.target.result}" alt="Preview ${index + 1}">
                    <button type="button" class="remove-image" data-index="${index}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.3 5.71a1 1 0 0 0-1.42 0L12 10.59 7.12 5.71a1 1 0 0 0-1.42 1.42L10.59 12l-4.89 4.88a1 1 0 1 0 1.42 1.42L12 13.41l4.88 4.89a1 1 0 0 0 1.42-1.42L13.41 12l4.89-4.88a1 1 0 0 0 0-1.41z"/>
                        </svg>
                    </button>
                `;

                preview.querySelector('.remove-image').addEventListener('click', () => {
                    this.selectedImages.splice(index, 1);
                    this.updateImagePreviews();
                });

                previewsContainer.appendChild(preview);
            };
            reader.readAsDataURL(file);
        });

        // Show/hide placeholder based on image count
        if (this.selectedImages.length >= 3) {
            placeholder.style.display = 'none';
        } else {
            placeholder.style.display = 'flex';
        }
    },

    async handleSubmit(e) {
        e.preventDefault();

        const submitBtn = document.getElementById('submit-btn');
        const originalText = submitBtn.innerHTML;

        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <div class="loading-spinner-small"></div>
            Submitting...
        `;

        try {
            const formData = new FormData();
            formData.append('name', document.getElementById('report-name').value);
            formData.append('subject', document.getElementById('report-subject').value);
            formData.append('message', document.getElementById('report-message').value);

            // Append images
            this.selectedImages.forEach((file, index) => {
                formData.append(`image${index}`, file);
            });

            const response = await fetch(`${API_BASE_URL}/api/reports`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                // Show success state
                document.getElementById('report-form').classList.add('hidden');
                document.getElementById('report-success').classList.remove('hidden');
            } else {
                throw new Error(result.error || 'Failed to submit report');
            }
        } catch (error) {
            console.error('Failed to submit report:', error);
            alert('Failed to submit report. Please try again.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    },

    resetForm() {
        document.getElementById('report-form').classList.remove('hidden');
        document.getElementById('report-success').classList.add('hidden');
        document.getElementById('report-form').reset();
        this.selectedImages = [];
        this.updateImagePreviews();
    }
};

window.ReportPage = ReportPage;
