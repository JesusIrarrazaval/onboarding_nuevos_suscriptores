FROM node:22

# Establece la zona horaria
ENV TZ="America/Santiago"
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Crea el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copia los archivos de dependencias y los instala
COPY package*.json ./
ENV NODE_PATH=/usr/src/app/node_modules
RUN npm install --production

# Copia el resto del código fuente de la aplicación
COPY . .

# Comando por defecto al ejecutar el contenedor
CMD ["node", "main.js"]
