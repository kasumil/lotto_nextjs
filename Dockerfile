# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4200

# Copy only necessary files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/ecosystem.config.js ./
COPY --from=builder /app/node_modules ./node_modules

# Install PM2 globally
RUN npm install -g pm2

# Expose port
EXPOSE 4100

# Start the application with PM2
WORKDIR /app
CMD ["pm2-runtime", "start", "ecosystem.config.js"]