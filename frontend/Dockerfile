FROM node:20-alpine

WORKDIR /app

# Copy package dependencies
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application (for development we use npm run dev, but Docker needs this for production)
# For local dev we will mount the volume and use npm run dev
EXPOSE 3000

CMD ["npm", "run", "dev"]
