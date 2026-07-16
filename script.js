const uploadInput = document.getElementById('uploadInput');
const processBtn = document.getElementById('processBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const gallery = document.getElementById('gallery');
const globalLoading = document.getElementById('globalLoading');
const progressText = document.getElementById('progressText');

let imageQueue = []; 

uploadInput.addEventListener('change', async (e) => {
    let files = Array.from(e.target.files);
    if (files.length === 0) return;

    if (files.length > 10) {
        alert("Vui lòng chỉ chọn tối đa 10 ảnh mỗi lần xử lý để đảm bảo tốc độ tốt nhất!");
        files = files.slice(0, 10);
    }

    processBtn.disabled = true;
    downloadZipBtn.style.display = 'none';
    
    // Reset list
    imageQueue = [];
    gallery.innerHTML = '';
    
    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        const cardId = 'card_' + i;
        
        const cardHtml = `
            <div id="${cardId}" class="image-card bg-white rounded-xl shadow p-2 relative flex flex-col h-full">
                <div class="relative pt-[125%] bg-gray-100 rounded-lg overflow-hidden mb-2">
                    <img id="img_${cardId}" class="absolute inset-0 w-full h-full object-cover" style="display: none;">
                    <div id="spinner_${cardId}" class="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
                        <span class="animate-pulse">Đang tải...</span>
                    </div>
                </div>
                <p class="text-xs text-gray-500 truncate mt-auto text-center font-medium" id="title_${cardId}">${file.name}</p>
            </div>
        `;
        gallery.insertAdjacentHTML('beforeend', cardHtml);

        let baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        if (file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic') {
            document.getElementById(`spinner_${cardId}`).innerHTML = '<span class="animate-pulse text-indigo-400">Đang giải mã HEIC...</span>';
            try {
                const convertedBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.95 });
                file = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            } catch (err) {
                console.error(err);
                document.getElementById(`spinner_${cardId}`).innerHTML = '<span class="text-red-500">Lỗi HEIC</span>';
                continue; 
            }
        }

        const reader = new FileReader();
        const readerPromise = new Promise(resolve => {
            reader.onload = (ev) => resolve(ev.target.result);
        });
        reader.readAsDataURL(file);
        const originalUrl = await readerPromise;

        imageQueue.push({
            file: file,
            baseName: baseName,
            originalUrl: originalUrl,
            processedUrl: null,
            cardId: cardId
        });

        const imgEl = document.getElementById(`img_${cardId}`);
        imgEl.src = originalUrl;
        imgEl.style.display = 'block';
        document.getElementById(`spinner_${cardId}`).style.display = 'none';
    }

    if (imageQueue.length > 0) {
        processBtn.disabled = false;
    }
});

processBtn.addEventListener('click', async () => {
    if (imageQueue.length === 0) return;
    
    processBtn.disabled = true;
    uploadInput.disabled = true;
    globalLoading.classList.remove('hidden');
    progressText.innerText = `0/${imageQueue.length}`;
    
    for (let i = 0; i < imageQueue.length; i++) {
        const item = imageQueue[i];
        document.getElementById(`spinner_${item.cardId}`).style.display = 'flex';
        document.getElementById(`spinner_${item.cardId}`).style.backgroundColor = 'rgba(255,255,255,0.7)';
        document.getElementById(`spinner_${item.cardId}`).innerHTML = '<div class="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>';
        
        await new Promise(r => setTimeout(r, 50));
        
        try {
            item.processedUrl = await processSingleImage(item.originalUrl);
            
            const imgEl = document.getElementById(`img_${item.cardId}`);
            imgEl.src = item.processedUrl; 
            document.getElementById(`spinner_${item.cardId}`).style.display = 'none';
            document.getElementById(`title_${item.cardId}`).innerText = '✅ ' + item.baseName;
            document.getElementById(`title_${item.cardId}`).classList.add('text-green-600', 'font-bold');
            
        } catch (e) {
            console.error(e);
            document.getElementById(`spinner_${item.cardId}`).innerHTML = '<span class="text-red-500 font-bold">Lỗi xử lý</span>';
        }
        
        progressText.innerText = `${i + 1}/${imageQueue.length}`;
    }
    
    globalLoading.classList.add('hidden');
    uploadInput.disabled = false;
    downloadZipBtn.style.display = 'inline-block';
});

function processSingleImage(originalDataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const targetRatio = 4 / 5;
                const targetWidth = 1080;
                const targetHeight = 1350;

                let srcX = 0, srcY = 0, srcW = img.width, srcH = img.height;
                const currentRatio = srcW / srcH;

                if (currentRatio > targetRatio) {
                    srcW = srcH * targetRatio;
                    srcX = (img.width - srcW) / 2;
                } else if (currentRatio < targetRatio) {
                    srcH = srcW / targetRatio;
                    srcY = (img.height - srcH) / 2;
                }

                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');

                ctx.filter = 'brightness(1.15) contrast(1.02) saturate(1.15)';
                ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetWidth, targetHeight);
                
                let imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
                imageData = applySharpen(imageData, targetWidth, targetHeight);
                ctx.putImageData(imageData, 0, 0);

                // Use JPEG for faster zip processing and smaller size, quality 95%
                resolve(canvas.toDataURL('image/jpeg', 0.95)); 
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = reject;
        img.src = originalDataUrl;
    });
}

function applySharpen(imageData, w, h) {
    const side = 3;
    const halfSide = 1;
    const src = imageData.data;
    const output = new ImageData(w, h);
    const dst = output.data;

    const kernel = [
         0,    -0.05,     0,
        -0.05,  1.20, -0.05,
         0,    -0.05,     0
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
            dst[dstOff + 3] = src[dstOff + 3];
        }
    }
    return output;
}

downloadZipBtn.addEventListener('click', async () => {
    const zip = new JSZip();
    const folder = zip.folder("Processed_Images");
    
    let hasFiles = false;
    for (const item of imageQueue) {
        if (item.processedUrl) {
            const base64Data = item.processedUrl.split(',')[1];
            folder.file(`${item.baseName}_edited.jpg`, base64Data, {base64: true});
            hasFiles = true;
        }
    }
    
    if (hasFiles) {
        downloadZipBtn.innerText = '⏳ Đang nén ZIP...';
        downloadZipBtn.disabled = true;
        const content = await zip.generateAsync({type:"blob"});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = "Processed_Images.zip";
        link.click();
        
        downloadZipBtn.innerText = '📦 Tải Tất Cả (.ZIP)';
        downloadZipBtn.disabled = false;
    }
});
