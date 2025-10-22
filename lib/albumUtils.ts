/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// Helper function to load an image and return it as an HTMLImageElement
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // Setting crossOrigin is good practice for canvas operations, even with data URLs
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(new Error(`Failed to load image: ${src.substring(0, 50)}...`));
        img.src = src;
    });
}

/**
 * Creates a single polaroid-style image from a source image and caption.
 * @param imageUrl The URL of the source image.
 * @param caption The text to write on the polaroid.
 * @returns A promise that resolves to a data URL of the generated polaroid image (JPEG format).
 */
async function createPolaroidImage(imageUrl: string, caption: string): Promise<string> {
    // Wait for external fonts to be loaded and ready. This is crucial for ensuring
    // custom fonts like 'Permanent Marker' are available for the canvas drawing context.
    // Without this, the canvas might render the text with a default (or invisible) font.
    await document.fonts.ready;
    
    const canvas = document.createElement('canvas');
    const scale = 2; // Render at 2x for better resolution

    // Dimensions based on the component's 3:4 aspect ratio
    const baseWidth = 320;
    const baseHeight = Math.round(baseWidth * 4 / 3);

    const polaroidWidth = baseWidth * scale;
    const polaroidHeight = baseHeight * scale;

    canvas.width = polaroidWidth;
    canvas.height = polaroidHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not get 2D canvas context');
    }

    // 1. Draw the polaroid frame background (approximates bg-neutral-100)
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, polaroidWidth, polaroidHeight);

    // 2. Load the source image
    const img = await loadImage(imageUrl);

    // 3. Define image container dimensions based on component's padding (p-4, pb-16)
    const p = 16 * scale;
    const pb = 64 * scale;

    const imageContainerX = p;
    const imageContainerY = p;
    const imageContainerWidth = polaroidWidth - (p * 2);
    const imageContainerHeight = polaroidHeight - p - pb;

    // Draw the dark background for the image (approximates bg-neutral-900)
    ctx.fillStyle = '#171717';
    ctx.fillRect(imageContainerX, imageContainerY, imageContainerWidth, imageContainerHeight);

    // 4. Calculate dimensions to draw image with "object-cover" behavior
    const imgAspectRatio = img.naturalWidth / img.naturalHeight;
    const containerAspectRatio = imageContainerWidth / imageContainerHeight;

    let drawWidth, drawHeight, drawX, drawY;
    if (imgAspectRatio > containerAspectRatio) {
        // Image is wider than container -> fit to height, crop width
        drawHeight = imageContainerHeight;
        drawWidth = drawHeight * imgAspectRatio;
        drawX = imageContainerX - (drawWidth - imageContainerWidth) / 2;
        drawY = imageContainerY;
    } else {
        // Image is taller or same aspect ratio -> fit to width, crop height
        drawWidth = imageContainerWidth;
        drawHeight = drawWidth / imgAspectRatio;
        drawX = imageContainerX;
        drawY = imageContainerY - (drawHeight - imageContainerHeight) / 2;
    }

    // Set a clipping region to ensure the image doesn't draw outside its container
    ctx.save();
    ctx.beginPath();
    ctx.rect(imageContainerX, imageContainerY, imageContainerWidth, imageContainerHeight);
    ctx.clip();

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    // Restore the context to remove the clipping mask, allowing text to be drawn normally
    ctx.restore();

    // 5. Draw the caption text
    ctx.fillStyle = '#000000'; // text-black
    const fontSize = 20 * scale; // Approximates text-lg
    ctx.font = `${fontSize}px 'Permanent Marker', cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Center the text in the bottom padding area
    const captionAreaY = polaroidHeight - pb;
    const captionY = captionAreaY + (pb - p) / 2;

    ctx.fillText(caption, polaroidWidth / 2, captionY);

    // Return as a high-quality JPEG data URL
    return canvas.toDataURL('image/jpeg', 1.0);
}

/**
 * Creates a single "photo album" page image from a collection of decade images.
 * @param imageData A record mapping decade strings to their image data URLs.
 * @returns A promise that resolves to a data URL of the generated album page (JPEG format).
 */
async function createAlbumPage(imageData: Record<string, string>): Promise<string> {
    const canvas = document.createElement('canvas');
    const scale = 1.5; // Scaling factor for higher resolution

    // High-resolution canvas for good quality (A4-like ratio)
    const canvasWidth = 2480 * scale;
    const canvasHeight = 3508 * scale;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not get 2D canvas context');
    }

    // 1. Draw the album page background
    ctx.fillStyle = '#fdf5e6'; // A warm, parchment-like color
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. Draw the title
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';

    ctx.font = `bold ${100 * scale}px 'Caveat', cursive`;
    ctx.fillText('Generated with Through Time', canvasWidth / 2, 150 * scale);

    ctx.font = `${50 * scale}px 'Roboto', sans-serif`;
    ctx.fillStyle = '#555';
    ctx.fillText('on Google AI Studio', canvasWidth / 2, 220 * scale);

    // 3. Load all the polaroid images concurrently
    const decades = Object.keys(imageData);
    const loadedImages = await Promise.all(
        Object.values(imageData).map(url => loadImage(url))
    );

    const imagesWithDecades = decades.map((decade, index) => ({
        decade,
        img: loadedImages[index],
    }));

    // 4. Define grid layout and draw each polaroid
    const grid = { cols: 3, rows: 3, padding: 80 * scale }; // 3x3 grid for 9 images
    const contentTopMargin = 300 * scale; // Space for the header
    const contentHeight = canvasHeight - contentTopMargin;
    const cellWidth = (canvasWidth - grid.padding * (grid.cols + 1)) / grid.cols;
    const cellHeight = (contentHeight - grid.padding * (grid.rows + 1)) / grid.rows;

    // Calculate polaroid dimensions to fit inside the grid cell with a margin
    const polaroidAspectRatio = 1.2; // height is 1.2 times width
    const maxPolaroidWidth = cellWidth * 0.9;
    const maxPolaroidHeight = cellHeight * 0.9;

    let polaroidWidth = maxPolaroidWidth;
    let polaroidHeight = polaroidWidth * polaroidAspectRatio;

    if (polaroidHeight > maxPolaroidHeight) {
        polaroidHeight = maxPolaroidHeight;
        polaroidWidth = polaroidHeight / polaroidAspectRatio;
    }

    const imageContainerWidth = polaroidWidth * 0.9;
    const imageContainerHeight = imageContainerWidth; // Classic square-ish photo area

    // Reverse the drawing order: draw bottom rows first so top rows are rendered on top
    const reversedImages = [...imagesWithDecades].reverse();
    reversedImages.forEach(({ decade, img }, reversedIndex) => {
        // Calculate the original index to determine grid position
        const index = imagesWithDecades.length - 1 - reversedIndex;

        const row = Math.floor(index / grid.cols);
        const col = index % grid.cols;

        // Calculate top-left corner of the polaroid within its grid cell
        const x = grid.padding * (col + 1) + cellWidth * col + (cellWidth - polaroidWidth) / 2;
        const y = contentTopMargin + grid.padding * (row + 1) + cellHeight * row + (cellHeight - polaroidHeight) / 2;
        
        ctx.save();
        
        // Translate context to the center of the polaroid for rotation
        ctx.translate(x + polaroidWidth / 2, y + polaroidHeight / 2);
        
        // Apply a slight, random rotation for a hand-placed look
        const rotation = (Math.random() - 0.5) * 0.1; // Radians (approx. +/- 2.8 degrees)
        ctx.rotate(rotation);
        
        // Draw a soft shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 35 * scale;
        ctx.shadowOffsetX = 5 * scale;
        ctx.shadowOffsetY = 10 * scale;
        
        // Draw the white polaroid frame (centered at the new origin)
        ctx.fillStyle = '#fff';
        ctx.fillRect(-polaroidWidth / 2, -polaroidHeight / 2, polaroidWidth, polaroidHeight);
        
        // Remove shadow for subsequent drawing
        ctx.shadowColor = 'transparent';
        
        // Calculate image dimensions to fit while maintaining aspect ratio
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        let drawWidth = imageContainerWidth;
        let drawHeight = drawWidth / aspectRatio;

        if (drawHeight > imageContainerHeight) {
            drawHeight = imageContainerHeight;
            drawWidth = drawHeight * aspectRatio;
        }

        // Calculate position to center the image within its container area
        const imageAreaTopMargin = (polaroidWidth - imageContainerWidth) / 2;
        const imageContainerY = -polaroidHeight / 2 + imageAreaTopMargin;
        
        const imgX = -drawWidth / 2; // Horizontally centered due to context translation
        const imgY = imageContainerY + (imageContainerHeight - drawHeight) / 2;
        
        ctx.drawImage(img, imgX, imgY, drawWidth, drawHeight);
        
        // Draw the handwritten caption
        ctx.fillStyle = '#222';
        ctx.font = `${60 * scale}px 'Permanent Marker', cursive`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const captionAreaTop = imageContainerY + imageContainerHeight;
        const captionAreaBottom = polaroidHeight / 2;
        const captionY = captionAreaTop + (captionAreaBottom - captionAreaTop) / 2;

        ctx.fillText(decade, 0, captionY);
        
        ctx.restore(); // Restore context to pre-transformation state
    });

    // Convert canvas to a high-quality JPEG and return the data URL
    return canvas.toDataURL('image/jpeg', 1.0);
}

export { createPolaroidImage, createAlbumPage };