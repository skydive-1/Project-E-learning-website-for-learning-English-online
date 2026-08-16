FROM node:22-alpine

# Cài đặt curl, thư viện tương thích C/C++ và ffmpeg
RUN apk add --no-cache curl libc6-compat gcompat libstdc++ ffmpeg

# Tự động tải Shaka Packager binary cho Linux x64 vào /usr/local/bin
RUN curl -fsSL https://github.com/shaka-project/shaka-packager/releases/latest/download/packager-linux-x64 -o /usr/local/bin/shaka-packager \
    && chmod +x /usr/local/bin/shaka-packager

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose port
EXPOSE 5000

# Start command
CMD ["npm", "start"]
