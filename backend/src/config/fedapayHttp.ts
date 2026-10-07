import axios from 'axios';

const FEDAPAY_TIMEOUT_MS = Number(process.env.FEDAPAY_TIMEOUT_MS || 15000);

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && emailRegex.test(value) && value.length <= 255;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label}: timeout après ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

/**
 * @param ms timeout local, pour les chemins qui ne doivent jamais retarder une
 * réponse (rattrapage arrière-plan de /boosts/mine : 2 s au lieu de 15 s).
 */
export function withFedapayTimeout<T>(promise: Promise<T>, ms: number = FEDAPAY_TIMEOUT_MS): Promise<T> {
  return withTimeout(promise, ms, 'FedaPay');
}

let axiosPatched = false;

export function patchAxiosTimeout(): void {
  if (axiosPatched) return;
  axiosPatched = true;
  const instance = axios.defaults as any;
  if (!instance.timeout || instance.timeout > FEDAPAY_TIMEOUT_MS) {
    instance.timeout = FEDAPAY_TIMEOUT_MS;
  }
}
