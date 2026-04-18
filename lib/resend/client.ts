import { Resend } from "resend";
import { env } from "@/lib/env";

let resendSingleton: Resend | null = null;

export function getResend(): Resend {
  if (!resendSingleton) {
    resendSingleton = new Resend(env.resendApiKey());
  }
  return resendSingleton;
}
