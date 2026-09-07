import "server-only";
import { createHash } from "node:crypto";
// 화면용 아이디를 Auth 내부 주소에 대응시킵니다. 비밀번호 원문은 저장하지 않습니다.
export function loginAddress(username: string) {
  const value = username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(value))
    throw new Error("INVALID_INPUT");
  return `${value}@login.juseyo.invalid`;
}
export function authPassword(password: string) {
  if (password.length < 5 || password.length > 200)
    throw new Error("INVALID_INPUT");
  return createHash("sha256")
    .update(`juseyo-login-v1:${password}`)
    .digest("hex");
}
