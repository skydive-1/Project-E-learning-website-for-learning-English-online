FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 3001

# Run Vite and bind to host 0.0.0.0 so host browser can access it, and disable open browser in container
CMD ["npm", "run", "start", "--", "--host", "0.0.0.0", "--no-open"]
