FROM node:22-alpine

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
CMD ["npm", "run", "dev"]
