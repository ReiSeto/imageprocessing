const uploadInput = document.getElementById('uploadInput');
const processBtn  = document.getElementById('processBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const gallery     = document.getElementById('gallery');
const globalLoading = document.getElementById('globalLoading');
const progressText  = document.getElementById('progressText');

let imageQueue = [];

// ──────────────────────────────────────────────
// Upload handler
// ──────────────────────────────────────────────
uploadInput.addEventListener('change', async (e) => {
    let files = Array.from(e.target.files);
    if (!files.length) return;

    if (files.length > 10) {
        alert("Chỉ chọn tối đa 10 ảnh mỗi lần để đảm bảo tốc độ!");
        files = files.slice(0, 10);
    }

    processBtn.disabled = true;
    downloadZipBtn.style.display = 'none';
    imageQueue = [];
    gallery.innerHTML = '';

    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        const cardId = 'card_' + i;

        gallery.insertAdjacentHTML('beforeend', `
            <div id="${cardId}" class="image-card bg-white rounded-xl shadow p-2 flex flex-col h-full">
                <div class="relative pt-[125%] bg-gray-100 rounded-lg overflow-hidden mb-2">
                    <img id="img_${cardId}" class="absolute inset-0 w-full h-full object-cover" style="display:none">
                    <div id="spinner_${cardId}" class="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                        <span class="animate-pulse">Đang tải...</span>
                    </div>
                </div>
                <p class="text-xs text-gray-500 truncate mt-auto text-center font-medium" id="title_${cardId}">${file.name}</p>
            </div>`);

        let baseName = file.name.replace(/\.[^/.]+$/, '');

        if (/\.heic$/i.test(file.name) || file.type === 'image/heic') {
            document.getElementById(`spinner_${cardId}`).innerHTML =
                '<span class="animate-pulse text-indigo-400">Giải mã HEIC...</span>';
            try {
                const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 });
                file = Array.isArray(blob) ? blob[0] : blob;
            } catch (err) {
                document.getElementById(`spinner_${cardId}`).innerHTML =
                    '<span class="text-red-500">Lỗi HEIC</span>';
                continue;
            }
        }

        const originalUrl = await readFileAsDataURL(file);

        imageQueue.push({ baseName, originalUrl, processedUrl: null, cardId });

        document.getElementById(`img_${cardId}`).src = originalUrl;
        document.getElementById(`img_${cardId}`).style.display = 'block';
        document.getElementById(`spinner_${cardId}`).style.display = 'none';
    }

    if (imageQueue.length) processBtn.disabled = false;
});

function readFileAsDataURL(file) {
    return new Promise(resolve => {
        const r = new FileReader();
        r.onload = e => resolve(e.target.result);
        r.readAsDataURL(file);
    });
}

// ──────────────────────────────────────────────
// Process handler
// ──────────────────────────────────────────────
processBtn.addEventListener('click', async () => {
    if (!imageQueue.length) return;

    processBtn.disabled = true;
    uploadInput.disabled = true;
    globalLoading.classList.remove('hidden');
    progressText.innerText = `0/${imageQueue.length}`;

    for (let i = 0; i < imageQueue.length; i++) {
        const item = imageQueue[i];
        const spinner = document.getElementById(`spinner_${item.cardId}`);
        spinner.style.display = 'flex';
        spinner.style.backgroundColor = 'rgba(255,255,255,0.75)';
        spinner.innerHTML = '<div class="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>';

        await new Promise(r => setTimeout(r, 50));

        try {
            item.processedUrl = await processSingleImage(item.originalUrl);
            document.getElementById(`img_${item.cardId}`).src = item.processedUrl;
            spinner.style.display = 'none';
            const title = document.getElementById(`title_${item.cardId}`);
            title.innerText = '✅ ' + item.baseName;
            title.classList.add('text-green-600', 'font-bold');
        } catch (err) {
            spinner.innerHTML = '<span class="text-red-500 font-bold">Lỗi</span>';
        }

        progressText.innerText = `${i + 1}/${imageQueue.length}`;
    }

    globalLoading.classList.add('hidden');
    uploadInput.disabled = false;
    downloadZipBtn.style.display = 'inline-block';
});

// ──────────────────────────────────────────────
// Core: Image Processing
// ──────────────────────────────────────────────
function processSingleImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const TARGET_W = 1080, TARGET_H = 1350, RATIO = 4 / 5;
                let { width: w, height: h } = img;
                let sx = 0, sy = 0, sw = w, sh = h;

                if (w / h > RATIO) { sw = h * RATIO; sx = (w - sw) / 2; }
                else if (w / h < RATIO) { sh = w / RATIO; sy = (h - sh) / 2; }

                const canvas = document.createElement('canvas');
                canvas.width = TARGET_W; canvas.height = TARGET_H;
                const ctx = canvas.getContext('2d');

                ctx.filter = 'brightness(1.15) contrast(1.02) saturate(1.15)';
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H);

                let id = ctx.getImageData(0, 0, TARGET_W, TARGET_H);
                id = applySharpen(id, TARGET_W, TARGET_H);
                ctx.putImageData(id, 0, 0);

                resolve(canvas.toDataURL('image/jpeg', 0.95));
            } catch (e) { reject(e); }
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

function applySharpen(imageData, w, h) {
    const k = [0, -0.05, 0, -0.05, 1.20, -0.05, 0, -0.05, 0];
    const src = imageData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, b = 0;
            for (let ky = 0; ky < 3; ky++) {
                for (let kx = 0; kx < 3; kx++) {
                    const sy = Math.min(Math.max(y + ky - 1, 0), h - 1);
                    const sx = Math.min(Math.max(x + kx - 1, 0), w - 1);
                    const off = (sy * w + sx) * 4;
                    const wt  = k[ky * 3 + kx];
                    r += src[off]   * wt;
                    g += src[off+1] * wt;
                    b += src[off+2] * wt;
                }
            }
            const o = (y * w + x) * 4;
            dst[o]   = Math.min(Math.max(r, 0), 255);
            dst[o+1] = Math.min(Math.max(g, 0), 255);
            dst[o+2] = Math.min(Math.max(b, 0), 255);
            dst[o+3] = src[o+3];
        }
    }
    return out;
}

// ──────────────────────────────────────────────
// ZIP download
// ──────────────────────────────────────────────
downloadZipBtn.addEventListener('click', async () => {
    const zip = new JSZip();
    const folder = zip.folder('Processed_Images');

    for (const item of imageQueue) {
        if (item.processedUrl)
            folder.file(`${item.baseName}_edited.jpg`, item.processedUrl.split(',')[1], { base64: true });
    }

    downloadZipBtn.innerText = '⏳ Đang nén...';
    downloadZipBtn.disabled  = true;
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Processed_Images.zip';
    a.click();

    downloadZipBtn.innerText = '📦 Tải ZIP';
    downloadZipBtn.disabled  = false;
});
