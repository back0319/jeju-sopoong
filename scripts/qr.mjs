import QRCode from "qrcode";
const [url, file = "public/qr.png"] = process.argv.slice(2);
if (!url || !["http:", "https:"].includes(new URL(url).protocol))
  throw new Error("사용법: npm run qr -- https://서비스주소 public/qr.png");
await QRCode.toFile(file, url, { width: 1024, margin: 4 });
console.log(`QR 저장: ${file}`);
