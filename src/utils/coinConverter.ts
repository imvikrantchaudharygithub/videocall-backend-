import { COINS_PER_INR } from './constants';

export const inrToCoins = (inr: number): number => Math.floor(inr * COINS_PER_INR);

export const coinsToInr = (coins: number): number => coins / COINS_PER_INR;

export const ratePerMinToRatePerSecond = (ratePerMin: number): number => ratePerMin / 60;

export const secondsToCoins = (seconds: number, ratePerMinute: number): number => {
  return Math.ceil((seconds / 60) * ratePerMinute);
};

export const coinsToCallDurationSeconds = (coins: number, ratePerMinute: number): number => {
  return Math.floor((coins / ratePerMinute) * 60);
};
