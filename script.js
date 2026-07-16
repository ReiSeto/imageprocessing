// ====== UI ELEMENTS ======
const navImageTab = document.getElementById('navImageTab');
const navVideoTab = document.getElementById('navVideoTab');
const imageTabView = document.getElementById('imageTabView');
const videoTabView = document.getElementById('videoTabView');

const uploadInput = document.getElementById('uploadInput');
const processBtn = document.getElementById('processBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const gallery = document.getElementById('gallery');
const globalLoading = document.getElementById('globalLoading');
const progressText = document.getElementById('progressText');

const createVideoBtn = document.getElementById('createVideoBtn');
const downloadVideoBtn = document.getElementById('downloadVideoBtn');
const videoLoading = document.getElementById('videoLoading');
const videoPlayerContainer = document.getElementById('videoPlayerContainer');
const resultVideo = document.getElementById('resultVideo');

// ====== STATE ======
let imageQueue = []; 

// ====== TAB SWITCHING ======
navImageTab.addEventListener('click', () => {
    navImageTab.className = "px-6 py-3 tab-active text-lg transition";
    navVideoTab.className = "px-6 py-3 tab-inactive text-lg transition";
    imageTabView.style.display = 'block';
    videoTabView.style.display = 'none';
});

navVideoTab.addEventListener('click', () => {
    navVideoTab.className = "px-6 py-3 tab-active text-lg transition";
    navImageTab.className = "px-6 py-3 tab-inactive text-lg transition";
    imageTabView.style.display = 'none';
    videoTabView.style.display = 'block';
    
    const readyImages = imageQueue.filter(item => item.processedUrl);
    if (readyImages.length > 0) {
        createVideoBtn.disabled = false;
        createVideoBtn.innerText = `🎞️ Tạo Video (${readyImages.length} ảnh)`;
    } else {
        createVideoBtn.disabled = true;
        createVideoBtn.innerText = `🎞️ Cần xử lý ảnh ở Tab 1 trước`;
    }
});

// ====== IMAGE PROCESSING TAB ======
uploadInput.addEventListener('change', async (e) => {
    let files = Array.from(e.target.files);
    if (files.length === 0) return;

    if (files.length > 10) {
        alert("Vui lòng chỉ chọn tối đa 10 ảnh mỗi lần xử lý để đảm bảo tốc độ tốt nhất!");
        files = files.slice(0, 10);
    }

    processBtn.disabled = true;
    downloadZipBtn.style.display = 'none';
    createVideoBtn.disabled = true;
    
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
            document.getElementById(`spinner_${cardId}`).innerHTML = '<span class="animate-pulse text-indigo-400">Đang giải mã...</span>';
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
            document.getElementById(`spinner_${item.cardId}`).innerHTML = '<span class="text-red-500 font-bold">Lỗi</span>';
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
    
    for (const item of imageQueue) {
        if (item.processedUrl) {
            const base64Data = item.processedUrl.split(',')[1];
            folder.file(`${item.baseName}_edited.jpg`, base64Data, {base64: true});
        }
    }
    
    downloadZipBtn.innerText = '⏳ Đang nén...';
    downloadZipBtn.disabled = true;
    const content = await zip.generateAsync({type:"blob"});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = "Processed_Images.zip";
    link.click();
    
    downloadZipBtn.innerText = '📦 Tải ZIP';
    downloadZipBtn.disabled = false;
});

// ====== VIDEO GENERATION TAB ======
createVideoBtn.addEventListener('click', async () => {
    const readyImages = imageQueue.filter(item => item.processedUrl).map(item => item.processedUrl);
    if (readyImages.length === 0) return;
    
    createVideoBtn.disabled = true;
    videoLoading.classList.remove('hidden');
    videoPlayerContainer.classList.add('hidden');
    downloadVideoBtn.style.display = 'none';

    try {
        const videoBlob = await generateVideoFromImages(readyImages);
        const videoUrl = URL.createObjectURL(videoBlob);
        
        resultVideo.src = videoUrl;
        videoPlayerContainer.classList.remove('hidden');
        
        downloadVideoBtn.href = videoUrl;
        downloadVideoBtn.download = "MediaStudio_Slideshow.webm";
        downloadVideoBtn.style.display = 'inline-flex';
    } catch (e) {
        alert("Lỗi khi tạo video: " + e);
    }
    
    createVideoBtn.disabled = false;
    videoLoading.classList.add('hidden');
});

async function generateVideoFromImages(imageUrls) {
    return new Promise(async (resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 1080;
            canvas.height = 1350;
            const ctx = canvas.getContext('2d');
            
            // Chạy 30 FPS
            const stream = canvas.captureStream(30);
            
            let mimeType = 'video/webm';
            const mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType, videoBitsPerSecond: 5000000 });
            const chunks = [];
            
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };
            
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: mimeType });
                resolve(blob);
            };
            
            mediaRecorder.start();

            // Load tất cả ảnh
            const imgs = [];
            for (let url of imageUrls) {
                const img = new Image();
                await new Promise(r => { img.onload = r; img.src = url; });
                imgs.push(img);
            }
            
            const delay = ms => new Promise(r => setTimeout(r, ms));

            // Logic Render: Mỗi ảnh tĩnh 1.5s (45 frame), mờ dần 0.5s (15 frame) sang ảnh tiếp theo
            for (let i = 0; i < imgs.length; i++) {
                const currentImg = imgs[i];
                const nextImg = imgs[i + 1] || imgs[0]; // Ảnh cuối lặp về ảnh đầu
                
                // Trạng thái tĩnh
                for(let f = 0; f < 45; f++) {
                    ctx.globalAlpha = 1.0;
                    ctx.drawImage(currentImg, 0, 0, canvas.width, canvas.height);
                    await delay(33); // 1000/30 ms
                }
                
                // Trạng thái mờ dần (Crossfade)
                for(let f = 0; f < 15; f++) {
                    const alpha = f / 15;
                    ctx.globalAlpha = 1.0;
                    ctx.drawImage(currentImg, 0, 0, canvas.width, canvas.height);
                    ctx.globalAlpha = alpha;
                    ctx.drawImage(nextImg, 0, 0, canvas.width, canvas.height);
                    await delay(33);
                }
            }
            
            mediaRecorder.stop();
        } catch (e) {
            reject(e);
        }
    });
}
