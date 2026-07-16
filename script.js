const uploadInput = document.getElementById('uploadInput');
const processBtn = document.getElementById('processBtn');
const originalPreview = document.getElementById('originalPreview');
const processedPreview = document.getElementById('processedPreview');
const downloadBtn = document.getElementById('downloadBtn');
const originalPlaceholder = document.getElementById('originalPlaceholder');
const processedPlaceholder = document.getElementById('processedPlaceholder');
const loading = document.getElementById('loading');

let currentImage = null;

uploadInput.addEventListener('change', async (e) => {
    let file = e.target.files[0];
    if (!file) return;

    // Xử lý riêng cho file HEIC (iPhone)
    if (file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic') {
        originalPlaceholder.style.display = 'block';
        originalPlaceholder.innerText = 'Đang giải mã ảnh HEIC, vui lòng đợi...';
        originalPreview.style.display = 'none';
        
        try {
            const convertedBlob = await heic2any({
                blob: file,
                toType: "image/jpeg",
                quality: 0.95
            });
            file = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            // Gán lại tên ảo để lúc lưu file tải về sẽ dùng tên này
            file.name = e.target.files[0].name.replace(/\.[^/.]+$/, ".jpg");
        } catch (error) {
            alert('Lỗi giải mã file HEIC: ' + error);
            originalPlaceholder.innerText = 'Chưa tải ảnh lên';
            return;
        }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            originalPreview.src = img.src;
            originalPreview.style.display = 'block';
            originalPlaceholder.style.display = 'none';
            
            processedPreview.style.display = 'none';
            processedPlaceholder.style.display = 'block';
            downloadBtn.style.display = 'none';
            
            processBtn.disabled = false;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

processBtn.addEventListener('click', () => {
    if (!currentImage) return;
    
    // Show loading UI
    loading.classList.remove('hidden');
    processedPlaceholder.style.display = 'none';
    
    // Timeout to let the browser render the spinner before blocking the thread
    setTimeout(() => {
        try {
            processImage();
        } catch (e) {
            alert('Lỗi xử lý ảnh: ' + e);
        }
        loading.classList.add('hidden');
    }, 50);
});

function processImage() {
    const targetRatio = 4 / 5;
    const targetWidth = 1080;
    const targetHeight = 1350;

    let srcX = 0, srcY = 0, srcW = currentImage.width, srcH = currentImage.height;
    const currentRatio = srcW / srcH;

    if (currentRatio > targetRatio) {
        // Ảnh rộng -> Cắt 2 bên
        srcW = srcH * targetRatio;
        srcX = (currentImage.width - srcW) / 2;
    } else if (currentRatio < targetRatio) {
        // Ảnh cao -> Cắt trên dưới
        srcH = srcW / targetRatio;
        srcY = (currentImage.height - srcH) / 2;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // Áp dụng CSS filters (Brightness +25%, Contrast +15%, Saturate +30%)
    ctx.filter = 'brightness(1.25) contrast(1.15) saturate(1.3)';
    
    // Vẽ ảnh lên canvas đồng thời crop và resize
    ctx.drawImage(currentImage, srcX, srcY, srcW, srcH, 0, 0, targetWidth, targetHeight);
    
    // Áp dụng Sharpening thông qua ma trận chập (Convolution Matrix)
    let imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    imageData = applySharpen(imageData, targetWidth, targetHeight);
    ctx.putImageData(imageData, 0, 0);

    // Xuất ra dạng base64 Data URL
    const dataUrl = canvas.toDataURL('image/png');
    processedPreview.src = dataUrl;
    processedPreview.style.display = 'block';

    // Chuẩn bị nút Download
    const originalName = uploadInput.files[0].name;
    const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    downloadBtn.href = dataUrl;
    downloadBtn.download = baseName + '_edited.png';
    downloadBtn.style.display = 'inline-block';
}

function applySharpen(imageData, w, h) {
    const side = 3;
    const halfSide = 1;
    const src = imageData.data;
    const output = new ImageData(w, h);
    const dst = output.data;

    // Kernel tăng cường độ nét mạnh (tương đương Sharpness +100%)
    const kernel = [
         0, -1,  0,
        -1,  5, -1,
         0, -1,  0
    ];

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const dstOff = (y * w + x) * 4;
            let r = 0, g = 0, b = 0;

            for (let cy = 0; cy < side; cy++) {
                for (let cx = 0; cx < side; cx++) {
                    const scy = Math.min(Math.max(y + cy - halfSide, 0), h - 1);
                    const scx = Math.min(Math.max(x + cx - halfSide, 0), w - 1);
                    const srcOff = (scy * w + scx) * 4;
                    const wt = kernel[cy * side + cx];

                    r += src[srcOff] * wt;
                    g += src[srcOff + 1] * wt;
                    b += src[srcOff + 2] * wt;
                }
            }

            dst[dstOff] = Math.min(Math.max(r, 0), 255);
            dst[dstOff + 1] = Math.min(Math.max(g, 0), 255);
            dst[dstOff + 2] = Math.min(Math.max(b, 0), 255);
            dst[dstOff + 3] = src[dstOff + 3]; // Giữ nguyên Alpha
        }
    }
    return output;
}
