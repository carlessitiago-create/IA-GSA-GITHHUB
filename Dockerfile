FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build Vite (frontend)
RUN npm run build

EXPOSE 3000

# Use tsx for dev/prod simplicity if not explicitly building to cjs as framework says
CMD ["npm", "start"]
