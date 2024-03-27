# Sử dụng image cơ bản
FROM node:18

# Set thư mục làm việc
WORKDIR /app

# Copy package.json và package-lock.json
COPY package*.json ./

# Cài đặt dependencies
RUN npm install

# Copy mã nguồn của server vào trong image
COPY . .

# Mở cổng 5000 để truy cập ứng dụng
EXPOSE 5000

# Khởi chạy server
CMD ["node", "server.js"]
