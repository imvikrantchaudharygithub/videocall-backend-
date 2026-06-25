import { ENV } from './env';

export const AGORA_CONFIG = {
  appId: ENV.AGORA_APP_ID,
  appCertificate: ENV.AGORA_APP_CERTIFICATE,
  tokenExpirationInSeconds: 3600,   // 1 hour
  privilegeExpirationInSeconds: 3600,
};
