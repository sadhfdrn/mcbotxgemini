FROM node:18-bullseye

WORKDIR /app

COPY package.json ./

# Install build tools for native modules
RUN apt-get update && \
    apt-get install -y python3 g++ make cmake && \
    npm install

COPY . .

# Optional dummy server to pass health checks on Koyeb
RUN npm install express

EXPOSE 3000

CMD ["node", "Slaydragon.js"]