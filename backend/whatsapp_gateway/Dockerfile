FROM node:20-alpine

WORKDIR /app

# Install PM2 globally for process management & auto-restart inside Docker
RUN npm install -g pm2

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy server code
COPY server.js .

EXPOSE 3001

# Use PM2 to run server.js — auto-restarts if it crashes inside the container
CMD ["pm2-runtime", "server.js", "--name", "sree-trust-whatsapp-gateway"]
