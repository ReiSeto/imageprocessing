import streamlit as st
from PIL import Image, ImageEnhance
import io

# Cấu hình giao diện Streamlit
st.set_page_config(page_title="AI Image Enhancer", page_icon="📸", layout="centered")

st.title("📸 AI Image Enhancer - Tự Động Hậu Kỳ Ảnh")
st.markdown("Upload ảnh của bạn để tự động crop tỷ lệ 4:5, nâng độ phân giải (1080x1350) và hậu kỳ màu sắc rực rỡ.")

# Thiết lập tỷ lệ và kích thước chuẩn
TARGET_RATIO = 4 / 5
TARGET_WIDTH = 1080
TARGET_HEIGHT = 1350

def process_image(img):
    # 1. Crop to 4:5
    img_width, img_height = img.size
    current_ratio = img_width / img_height
    
    if current_ratio > TARGET_RATIO:
        new_width = int(img_height * TARGET_RATIO)
        left = (img_width - new_width) / 2
        right = left + new_width
        img = img.crop((left, 0, right, img_height))
    elif current_ratio < TARGET_RATIO:
        new_height = int(img_width / TARGET_RATIO)
        top = (img_height - new_height) / 2
        bottom = top + new_height
        img = img.crop((0, top, img_width, bottom))
    
    # 2. Resize với thuật toán Lanczos giữ chi tiết
    img = img.resize((TARGET_WIDTH, TARGET_HEIGHT), Image.Resampling.LANCZOS)
    
    # Chuyển đổi mode nếu cần
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    # 3. Enhancements (Hậu kỳ)
    img = ImageEnhance.Brightness(img).enhance(1.25)
    img = ImageEnhance.Contrast(img).enhance(1.15)
    img = ImageEnhance.Color(img).enhance(1.30)
    img = ImageEnhance.Sharpness(img).enhance(2.00)
    
    return img

uploaded_file = st.file_uploader("Chọn ảnh cần chỉnh sửa...", type=["jpg", "jpeg", "png", "webp"])

if uploaded_file is not None:
    # Hiển thị ảnh gốc
    original_image = Image.open(uploaded_file)
    
    st.subheader("Bản xem trước")
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("**Ảnh Gốc**")
        st.image(original_image, use_container_width=True)
    
    if st.button("🚀 Chỉnh Sửa Ảnh Ngay", type="primary"):
        with st.spinner("Đang xử lý hình ảnh, chờ một chút nhé..."):
            try:
                # Gọi hàm xử lý ảnh
                processed_image = process_image(original_image)
                
                with col2:
                    st.markdown("**Ảnh Đã Hậu Kỳ**")
                    st.image(processed_image, use_container_width=True)
                
                st.success("✅ Đã xử lý xong!")
                
                # Nút tải xuống
                buf = io.BytesIO()
                processed_image.save(buf, format="PNG")
                byte_im = buf.getvalue()
                
                st.download_button(
                    label="💾 Tải Ảnh Đã Xử Lý",
                    data=byte_im,
                    file_name=f"edited_{uploaded_file.name.split('.')[0]}.png",
                    mime="image/png"
                )
            except Exception as e:
                st.error(f"Đã có lỗi xảy ra: {e}")
