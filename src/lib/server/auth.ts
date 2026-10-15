import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { kvGet, kvSet } from "./kv";

export interface User {
  id: string;
  email: string;
  name: string;
  orgId: string;
  salt: string;
  hash: string;
  createdAt: string;
}

const COOKIE = "aldia_sesion";
const DAYS = 30;

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
const userKey = (email: string) => `usuarios/${createHmac("sha256", "aldia").update(normalizeEmail(email)).digest("hex")}`;

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}

export function checkPassword(password: string, u: Pick<User, "salt" | "hash">) {
  const a = Buffer.from(hashPassword(password, u.salt).hash, "hex");
  const b = Buffer.from(u.hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Clave para firmar las sesiones. Si no se configuró SESSION_SECRET, se genera una y se guarda. */
async function secret(): Promise<string> {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const saved = await kvGet<{ value: string }>("config/session-secret");
  if (saved) return saved.value;
  const value = randomBytes(32).toString("hex");
  await kvSet("config/session-secret", { value });
  return value;
}

export async function findUser(email: string) {
  return kvGet<User>(userKey(email));
}

export async function createUser(u: Omit<User, "salt" | "hash">, password: string) {
  if (await findUser(u.email)) throw new Error("Ya hay una cuenta con ese mail. Ingresá con tu contraseña.");
  const user: User = { ...u, email: normalizeEmail(u.email), ...hashPassword(password) };
  await kvSet(userKey(user.email), user);
  return user;
}

const sign = async (payload: string) => createHmac("sha256", await secret()).update(payload).digest("base64url");

export async function startSession(user: User) {
  const exp = Date.now() + DAYS * 864e5;
  const payload = Buffer.from(JSON.stringify({ e: user.email, x: exp })).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${await sign(payload)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DAYS * 86400,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = await sign(payload);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { e: string; x: number };
    if (Date.now() > x) return null;
    return await findUser(e);
  } catch {
    return null;
  }
}
