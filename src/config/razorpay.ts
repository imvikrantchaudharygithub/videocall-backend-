import Razorpay from 'razorpay';
import { ENV } from './env';

// Razorpay is optional at boot. If keys aren't configured (e.g. a video-call-only
// test deploy), don't instantiate — the constructor throws on empty key_id and
// would crash the whole server. Payment endpoints will no-op until keys are set.
let razorpay: Razorpay;

if (ENV.RAZORPAY_KEY_ID && ENV.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: ENV.RAZORPAY_KEY_ID,
    key_secret: ENV.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn('⚠️  Razorpay keys not set — payment features disabled.');
  razorpay = null as unknown as Razorpay;
}

export default razorpay;
