FROM node:20-alpine

WORKDIR /app

# Install ALL deps (incl. devDependencies) — needed to run `next build`.
# Do NOT set NODE_ENV=production here, or devDeps get skipped and the build fails.
COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
