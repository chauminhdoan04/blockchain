# Dự án Quản lý Bò trên Blockchain (CowChain)

Dự án sử dụng React.js, Ethers.js và Hardhat.

## Hướng dẫn chạy dự án trên máy cá nhân (VS Code)

### 1. Cài đặt môi trường
Đảm bảo bạn đã cài đặt NodeJS. Sau đó mở Terminal trong VS Code và chạy:
```bash
npm install
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
```

### 2. Khởi chạy Blockchain nội bộ (Local Node)
Mở một Terminal mới và chạy:
```bash
npx hardhat node
```
*Lưu ý: Giữ Terminal này chạy xuyên suốt quá trình sử dụng.*

### 3. Triển khai Smart Contract
Mở thêm một Terminal nữa và chạy lệnh deploy:
```bash
npx hardhat run deploy.cjs --network localhost
```
Sau khi chạy xong, Terminal sẽ hiện ra một địa chỉ (Contract Address). Hãy copy địa chỉ này.

### 4. Cấu hình Frontend
Mở file `src/App.tsx` và tìm dòng:
```javascript
const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
```
Thay thế bằng địa chỉ bạn vừa copy ở Bước 3.

### 5. Chạy giao diện Web
Trong Terminal, chạy:
```bash
npm run dev
```
Mở trình duyệt truy cập `http://localhost:3000`.

### 6. Cấu hình MetaMask
- Thêm mạng mới: **Hardhat**
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Tiền tệ: `ETH`
- Import các bộ khóa bí mật (Private Key) từ Terminal bước 2 vào MetaMask để có 10000 ETH test.
