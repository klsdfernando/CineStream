/**
 * Image Cropper Component
 * Allows users to crop and resize profile photos
 */

const ImageCropper = {
    canvas: null,
    ctx: null,
    image: null,
    cropArea: { x: 0, y: 0, size: 200 },
    isDragging: false,
    isResizing: false,
    startX: 0,
    startY: 0,
    imageScale: 1,
    imageOffset: { x: 0, y: 0 },
    onComplete: null,

    /**
     * Open the cropper modal with an image
     */
    open(imageSrc, callback) {
        this.onComplete = callback;
        this.createModal();
        this.loadImage(imageSrc);
    },

    /**
     * Create the cropper modal DOM
     */
    createModal() {
        // Remove existing modal if any
        const existing = document.getElementById('image-cropper-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'image-cropper-modal';
        modal.className = 'cropper-modal';
        modal.innerHTML = `
            <div class="cropper-backdrop"></div>
            <div class="cropper-container">
                <div class="cropper-header">
                    <h3>Crop Profile Photo</h3>
                    <button class="cropper-close" id="cropper-close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="cropper-body">
                    <div class="cropper-canvas-wrapper">
                        <canvas id="cropper-canvas"></canvas>
                        <div class="crop-overlay" id="crop-overlay">
                            <div class="crop-area" id="crop-area">
                                <div class="crop-handle top-left"></div>
                                <div class="crop-handle top-right"></div>
                                <div class="crop-handle bottom-left"></div>
                                <div class="crop-handle bottom-right"></div>
                            </div>
                        </div>
                    </div>
                    <div class="cropper-controls">
                        <label>Zoom</label>
                        <input type="range" id="cropper-zoom" min="0.5" max="3" step="0.1" value="1">
                    </div>
                </div>
                <div class="cropper-footer">
                    <button class="btn-cropper-cancel" id="cropper-cancel">Cancel</button>
                    <button class="btn-cropper-save" id="cropper-save">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Apply
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup canvas
        this.canvas = document.getElementById('cropper-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Attach events
        this.attachEvents();

        // Animate in
        requestAnimationFrame(() => {
            modal.classList.add('active');
        });
    },

    /**
     * Load image onto canvas
     */
    loadImage(src) {
        this.image = new Image();
        this.image.onload = () => {
            // Set canvas size
            const maxSize = 400;
            const ratio = Math.min(maxSize / this.image.width, maxSize / this.image.height);
            this.canvas.width = this.image.width * ratio;
            this.canvas.height = this.image.height * ratio;

            // Center crop area
            const minDim = Math.min(this.canvas.width, this.canvas.height);
            this.cropArea = {
                x: (this.canvas.width - minDim * 0.8) / 2,
                y: (this.canvas.height - minDim * 0.8) / 2,
                size: minDim * 0.8
            };

            this.imageScale = 1;
            this.imageOffset = { x: 0, y: 0 };
            this.draw();
            this.updateCropOverlay();
        };
        this.image.src = src;
    },

    /**
     * Draw image on canvas
     */
    draw() {
        if (!this.image || !this.ctx) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Calculate scaled dimensions
        const scaledWidth = this.canvas.width * this.imageScale;
        const scaledHeight = this.canvas.height * this.imageScale;
        const offsetX = (this.canvas.width - scaledWidth) / 2 + this.imageOffset.x;
        const offsetY = (this.canvas.height - scaledHeight) / 2 + this.imageOffset.y;

        this.ctx.drawImage(this.image, offsetX, offsetY, scaledWidth, scaledHeight);
    },

    /**
     * Update crop overlay position
     */
    updateCropOverlay() {
        const cropAreaEl = document.getElementById('crop-area');
        if (cropAreaEl) {
            cropAreaEl.style.left = `${this.cropArea.x}px`;
            cropAreaEl.style.top = `${this.cropArea.y}px`;
            cropAreaEl.style.width = `${this.cropArea.size}px`;
            cropAreaEl.style.height = `${this.cropArea.size}px`;
        }
    },

    /**
     * Attach event listeners
     */
    attachEvents() {
        const cropArea = document.getElementById('crop-area');
        const zoomSlider = document.getElementById('cropper-zoom');
        const saveBtn = document.getElementById('cropper-save');
        const cancelBtn = document.getElementById('cropper-cancel');
        const closeBtn = document.getElementById('cropper-close');
        const backdrop = document.querySelector('.cropper-backdrop');

        // Crop area drag
        cropArea.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('crop-handle')) {
                this.isResizing = true;
                this.resizeHandle = e.target.className.split(' ')[1];
            } else {
                this.isDragging = true;
            }
            this.startX = e.clientX;
            this.startY = e.clientY;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.startX;
                const dy = e.clientY - this.startY;

                this.cropArea.x = Math.max(0, Math.min(this.canvas.width - this.cropArea.size, this.cropArea.x + dx));
                this.cropArea.y = Math.max(0, Math.min(this.canvas.height - this.cropArea.size, this.cropArea.y + dy));

                this.updateCropOverlay();
                this.startX = e.clientX;
                this.startY = e.clientY;
            } else if (this.isResizing) {
                const dx = e.clientX - this.startX;
                const dy = e.clientY - this.startY;
                const delta = (Math.abs(dx) > Math.abs(dy) ? dx : dy);

                let newSize = this.cropArea.size;
                let newX = this.cropArea.x;
                let newY = this.cropArea.y;

                if (this.resizeHandle.includes('right') || this.resizeHandle.includes('bottom')) {
                    newSize = this.cropArea.size + delta;
                } else {
                    newSize = this.cropArea.size - delta;
                    newX = this.cropArea.x + delta;
                    newY = this.cropArea.y + delta;
                }

                // Constrain size
                newSize = Math.max(50, Math.min(Math.min(this.canvas.width, this.canvas.height), newSize));

                // Keep within bounds
                if (newX >= 0 && newY >= 0 && newX + newSize <= this.canvas.width && newY + newSize <= this.canvas.height) {
                    this.cropArea.size = newSize;
                    if (this.resizeHandle.includes('left') || this.resizeHandle.includes('top')) {
                        this.cropArea.x = newX;
                        this.cropArea.y = newY;
                    }
                }

                this.updateCropOverlay();
                this.startX = e.clientX;
                this.startY = e.clientY;
            }
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.isResizing = false;
        });

        // Zoom
        zoomSlider.addEventListener('input', (e) => {
            this.imageScale = parseFloat(e.target.value);
            this.draw();
        });

        // Save
        saveBtn.addEventListener('click', () => this.save());

        // Cancel/Close
        cancelBtn.addEventListener('click', () => this.close());
        closeBtn.addEventListener('click', () => this.close());
        backdrop.addEventListener('click', () => this.close());
    },

    /**
     * Save cropped image
     */
    save() {
        // Create output canvas for final cropped image
        const outputSize = 200; // Target size in pixels
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = outputSize;
        outputCanvas.height = outputSize;
        const outputCtx = outputCanvas.getContext('2d');

        // Get the canvas and overlay positions to calculate offset
        // The crop-overlay fills the wrapper, but the canvas might be centered within it
        const overlay = document.getElementById('crop-overlay');
        const canvasRect = this.canvas.getBoundingClientRect();
        const overlayRect = overlay.getBoundingClientRect();

        // Canvas offset within the overlay (wrapper)
        const canvasOffsetX = canvasRect.left - overlayRect.left;
        const canvasOffsetY = canvasRect.top - overlayRect.top;

        // The crop area position is relative to the overlay
        // Convert it to be relative to the canvas
        const cropAreaOnCanvasX = this.cropArea.x - canvasOffsetX;
        const cropAreaOnCanvasY = this.cropArea.y - canvasOffsetY;

        // The image was scaled to fit in maxSize (400px) using the same ratio for width and height
        const maxSize = 400;
        const baseRatio = Math.min(maxSize / this.image.width, maxSize / this.image.height);

        // When zoom is applied, the image is drawn at:
        const scaledWidth = this.canvas.width * this.imageScale;
        const scaledHeight = this.canvas.height * this.imageScale;
        const imageDrawX = (this.canvas.width - scaledWidth) / 2 + this.imageOffset.x;
        const imageDrawY = (this.canvas.height - scaledHeight) / 2 + this.imageOffset.y;

        // Crop area position relative to where the image is drawn ON THE CANVAS
        const cropOnImageX = cropAreaOnCanvasX - imageDrawX;
        const cropOnImageY = cropAreaOnCanvasY - imageDrawY;
        const cropOnImageSize = this.cropArea.size;

        // The drawn image is scaled by: baseRatio * imageScale (compared to original)
        const totalScale = baseRatio * this.imageScale;

        // Convert to original image coordinates
        const srcX = cropOnImageX / totalScale;
        const srcY = cropOnImageY / totalScale;
        const srcSize = cropOnImageSize / totalScale;

        // Clamp values to valid range
        const clampedSrcX = Math.max(0, Math.min(srcX, this.image.width - srcSize));
        const clampedSrcY = Math.max(0, Math.min(srcY, this.image.height - srcSize));
        const clampedSrcSize = Math.min(srcSize, this.image.width - clampedSrcX, this.image.height - clampedSrcY);

        console.log('[ImageCropper] Crop debug:', {
            canvasOffset: { x: canvasOffsetX, y: canvasOffsetY },
            cropAreaOnCanvas: { x: cropAreaOnCanvasX, y: cropAreaOnCanvasY },
            imageDrawPos: { x: imageDrawX, y: imageDrawY },
            cropOnImage: { x: cropOnImageX, y: cropOnImageY },
            totalScale,
            src: { x: srcX, y: srcY, size: srcSize },
            clamped: { x: clampedSrcX, y: clampedSrcY, size: clampedSrcSize }
        });

        // Draw cropped area to output canvas
        outputCtx.drawImage(
            this.image,
            clampedSrcX, clampedSrcY, clampedSrcSize, clampedSrcSize,
            0, 0, outputSize, outputSize
        );

        // Compress to JPEG with quality 0.8 (usually results in 20-50KB)
        const compressedImage = outputCanvas.toDataURL('image/jpeg', 0.8);

        // Calculate approximate size
        const base64Length = compressedImage.length - 'data:image/jpeg;base64,'.length;
        const sizeKB = Math.round((base64Length * 0.75) / 1024);
        console.log(`[ImageCropper] Compressed image size: ~${sizeKB}KB`);

        // Callback with result
        if (this.onComplete) {
            this.onComplete(compressedImage);
        }

        this.close();
    },

    /**
     * Close the modal
     */
    close() {
        const modal = document.getElementById('image-cropper-modal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
        this.image = null;
        this.canvas = null;
        this.ctx = null;
    }
};

window.ImageCropper = ImageCropper;
