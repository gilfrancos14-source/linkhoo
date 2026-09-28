import { FedaPay } from 'fedapay';
import { patchAxiosTimeout } from './fedapayHttp';

const env = (process.env.FEDAPAY_ENV || 'live').toLowerCase();
const isLive = env === 'live' || env === 'production';

const publicKey = process.env.FEDAPAY_PUBLIC_KEY;
const secretKey = process.env.FEDAPAY_SECRET_KEY;

if (!publicKey || !secretKey) {
  console.warn(
    '[fedapay] FEDAPAY_PUBLIC_KEY ou FEDAPAY_SECRET_KEY manquant. Les paiements premium ne fonctionneront pas.'
  );
}

if (secretKey) {
  FedaPay.setApiKey(secretKey);
}
FedaPay.setEnvironment(isLive ? 'live' : 'sandbox');
if (process.env.FEDAPAY_ACCOUNT_ID) {
  FedaPay.setAccountId(process.env.FEDAPAY_ACCOUNT_ID);
}

patchAxiosTimeout();

