FROM node:22-alpine

# 1. Cài đặt các gói hệ thống: curl, thư viện tương thích C/C++, ffmpeg, Python 3 và pip
RUN apk add --no-cache curl libc6-compat gcompat libstdc++ ffmpeg python3 py3-pip

# 2. Tạo symlink python -> python3 để lệnh spawn('python', ...) trong Node.js chạy bình thường
RUN ln -sf /usr/bin/python3 /usr/bin/python

# 3. Tự động tải Shaka Packager binary cho Linux x64 vào /usr/local/bin
RUN curl -fsSL https://github.com/shaka-project/shaka-packager/releases/latest/download/packager-linux-x64 -o /usr/local/bin/shaka-packager \
    && chmod +x /usr/local/bin/shaka-packager

# Set working directory
WORKDIR /usr/src/app

# 4. Cài đặt Node dependencies (tận dụng Docker layer cache & deterministic build)
COPY package*.json ./
RUN npm ci

# 5. Cài đặt Python dependencies (tận dụng Docker layer cache)
COPY scripts/requirements.txt ./scripts/requirements.txt
RUN pip install --break-system-packages --no-cache-dir -r ./scripts/requirements.txt

# 6. Copy toàn bộ mã nguồn ứng dụng
COPY . .

# Expose port
EXPOSE 5000

# Start command
CMD ["npm", "start"]
