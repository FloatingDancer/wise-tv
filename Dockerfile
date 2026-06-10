FROM node:20-slim

WORKDIR /app

# Copy lockfiles and package.json
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm install
RUN npm install --prefix server
RUN npm install --prefix client

# Copy all files
COPY . .

# Build frontend React
RUN npm run build

# Expose port 7860 (Hugging Face default)
EXPOSE 7860
ENV PORT=7860

# Start backend server
CMD ["npm", "start"]
