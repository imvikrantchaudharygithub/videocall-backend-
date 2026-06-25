import express from 'express';
import { verifyToken, requireCaller, requireHost } from '../middlewares/auth';
import { verifyAdminToken } from '../middlewares/adminAuth';
import { otpRateLimiter, authRateLimiter } from '../middlewares/rateLimiter';
import { uploadAvatar as multerAvatar, uploadHostPhotos as multerHostPhotos } from '../middlewares/uploads';

// Controllers
import { sendOTP, verifyOTP, fastLogin, guestLogin, logout, devLogin } from '../controllers/authController';
import { getMe, updateMe, uploadAvatar, updateFcmToken, getMyStats, verifyAge } from '../controllers/userController';
import { getPrivacyPolicy, getTermsOfService } from '../controllers/legalController';
import {
  listHosts, getHostById, searchHosts, applyAsHost, getApplicationStatus,
  uploadHostPhotos, updateBankDetails, getFavourites, addFavourite, removeFavourite,
  goOnline, goOffline
} from '../controllers/hostController';
import { initiateCallHandler, acceptCall, declineCall, endCall, billingTick, switchCallType, getCallHistory, getActiveCall, getCallById } from '../controllers/callController';
import { joinQueue, leaveQueue, getQueuePosition } from '../controllers/queueController';
import { listGifts, sendGift } from '../controllers/giftController';
import { getBalance, getTransactions, getCoinPacks } from '../controllers/walletController';
import { createOrder, verifyPaymentHandler, razorpayWebhook } from '../controllers/paymentController';
import { getEarningsSummary, getEarningsHistory, requestWithdrawal, getWithdrawals, getWithdrawalById } from '../controllers/earningsController';
import { submitRating, getHostRatings } from '../controllers/ratingController';
import { submitReport, getMyReports } from '../controllers/reportController';
import { getNotifications, markRead, markAllRead } from '../controllers/notificationController';
import {
  listPublicPaymentPlans,
  listPaymentPlansAdmin, createPaymentPlan, updatePaymentPlan, deletePaymentPlan,
} from '../controllers/paymentPlanController';
import { claimDailyBonus, getDailyBonusStatus } from '../controllers/dailyBonusController';
import {
  listVipPlans, getMySubscription, subscribe, verifyVipPayment,
  claimDailyCoins as claimVipDailyCoins, cancel as cancelVip,
  listVipPlansAdmin, createVipPlan, updateVipPlan, deleteVipPlan,
  listVipSubscribers, getVipRevenue,
} from '../controllers/vipController';
import {
  getActiveEvent,
  listHappyHours, createHappyHour, updateHappyHour, deleteHappyHour,
} from '../controllers/happyHourController';
import { getWeeklyLeaderboard, getMyRank, getAdminLeaderboard } from '../controllers/leaderboardController';
import { conversationController } from '../controllers/conversationController';
import {
  adminLogin, getDashboardStats,
  listCallers, listHosts as adminListHosts, getUserDetail, banUser, adjustBalance, changeHostTier,
  getPendingHosts, approveHost, rejectHost,
  getActiveCalls, getCallLogs, forceEndCall,
  getRevenueOverview, getAllTransactions,
  getPendingWithdrawals, approveWithdrawal, rejectWithdrawal,
  listGiftsAdmin, createGift, updateGift, deleteGift,
  listTiers, updateTier,
  listCoinPacksAdmin, createCoinPack, updateCoinPack, deleteCoinPack,
  listReports, actionReport,
  broadcastNotification, getNotificationHistory,
  getSettings, updateSettings,
  getReferrals, getUserActivityStats, getUserActivityList,
} from '../controllers/adminController';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// LEGAL  /api/legal  (public — no auth required)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/legal/privacy-policy', getPrivacyPolicy);
router.get('/legal/terms-of-service', getTermsOfService);

// ─────────────────────────────────────────────────────────────────────────────
// AUTH  /api/auth
// ─────────────────────────────────────────────────────────────────────────────
router.post('/auth/send-otp', otpRateLimiter, sendOTP);                                    // 1
router.post('/auth/verify-otp', authRateLimiter, verifyOTP);                               // 2
router.post('/auth/fast-login', authRateLimiter, fastLogin);                               // 3
router.post('/auth/guest-login', authRateLimiter, guestLogin);                             // 3b
router.post('/auth/dev-login', devLogin);                                                  // 3c (DEV skip-auth)
router.post('/auth/refresh-token', authRateLimiter, fastLogin);                            // 4 (same as fast-login)
router.post('/auth/logout', verifyToken, logout);                                          // 5
router.post('/auth/claim-daily-bonus', verifyToken, claimDailyBonus);                      // 5b
router.get('/auth/daily-bonus-status', verifyToken, getDailyBonusStatus);                  // 5c

// ─────────────────────────────────────────────────────────────────────────────
// HAPPY HOUR  /api/happy-hour
// ─────────────────────────────────────────────────────────────────────────────
router.get('/happy-hour/active', getActiveEvent);                                             // HH-1

// ─────────────────────────────────────────────────────────────────────────────
// VIP  /api/vip
// ─────────────────────────────────────────────────────────────────────────────
router.get('/vip/plans', listVipPlans);                                                       // VIP-1
router.get('/vip/my-subscription', verifyToken, getMySubscription);                           // VIP-2
router.post('/vip/subscribe', verifyToken, requireCaller, subscribe);                         // VIP-3
router.post('/vip/verify', verifyToken, requireCaller, verifyVipPayment);                     // VIP-4
router.post('/vip/claim-daily-coins', verifyToken, claimVipDailyCoins);                       // VIP-5
router.post('/vip/cancel', verifyToken, cancelVip);                                           // VIP-6

// ─────────────────────────────────────────────────────────────────────────────
// USER  /api/users
// ─────────────────────────────────────────────────────────────────────────────
router.get('/users/me', verifyToken, getMe);                                               // 6
router.patch('/users/me', verifyToken, updateMe);                                          // 7
router.post('/users/me/avatar', verifyToken, multerAvatar, uploadAvatar);                  // 8
router.patch('/users/me/fcm-token', verifyToken, updateFcmToken);                         // 9
router.get('/users/me/stats', verifyToken, getMyStats);                                   // 10
router.post('/users/me/verify-age', verifyToken, verifyAge);

// ─────────────────────────────────────────────────────────────────────────────
// HOSTS  /api/hosts
// ─────────────────────────────────────────────────────────────────────────────
router.get('/hosts', verifyToken, requireCaller, listHosts);                              // 11
router.post('/host/online', verifyToken, requireHost, goOnline);                          // 11a
router.post('/host/offline', verifyToken, requireHost, goOffline);                        // 11b
router.get('/hosts/search', verifyToken, requireCaller, searchHosts);                     // 13
router.get('/hosts/:id', verifyToken, requireCaller, getHostById);                        // 12

// ─────────────────────────────────────────────────────────────────────────────
// FAVOURITES  /api/favourites
// ─────────────────────────────────────────────────────────────────────────────
router.get('/favourites', verifyToken, requireCaller, getFavourites);                     // 14
router.post('/favourites/:hostId', verifyToken, requireCaller, addFavourite);             // 15
router.delete('/favourites/:hostId', verifyToken, requireCaller, removeFavourite);        // 16

// ─────────────────────────────────────────────────────────────────────────────
// CALLS  /api/calls
// ─────────────────────────────────────────────────────────────────────────────
router.post('/calls/initiate', verifyToken, requireCaller, initiateCallHandler);          // 17
router.post('/calls/active', verifyToken, getActiveCall);                                 // 24 (using POST to avoid param conflict)
router.post('/calls/:id/accept', verifyToken, requireHost, acceptCall);                   // 18
router.post('/calls/:id/decline', verifyToken, requireHost, declineCall);                 // 19
router.post('/calls/:id/reject', verifyToken, requireHost, declineCall);                  // 19b (host app uses /reject)
router.post('/calls/:id/end', verifyToken, endCall);                                      // 20
router.post('/calls/:id/tick', verifyToken, requireCaller, billingTick);                  // 20b (caller app billing poll)
router.post('/calls/:id/switch-type', verifyToken, requireCaller, switchCallType);        // 21
router.get('/calls/history', verifyToken, getCallHistory);                                // 22
router.get('/calls/:id', verifyToken, getCallById);                                       // 23

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE  /api/queue
// ─────────────────────────────────────────────────────────────────────────────
router.post('/queue/join', verifyToken, requireCaller, joinQueue);                        // 25
router.delete('/queue/leave/:hostId', verifyToken, requireCaller, leaveQueue);            // 26
router.get('/queue/position/:hostId', verifyToken, requireCaller, getQueuePosition);      // 27

// ─────────────────────────────────────────────────────────────────────────────
// GIFTS  /api/gifts
// ─────────────────────────────────────────────────────────────────────────────
router.get('/gifts', verifyToken, listGifts);                                             // 30
router.post('/gifts/send', verifyToken, requireCaller, sendGift);                        // 31

// ─────────────────────────────────────────────────────────────────────────────
// WALLET  /api/wallet  +  COIN PACKS  /api/coin-packs
// ─────────────────────────────────────────────────────────────────────────────
router.get('/wallet/balance', verifyToken, getBalance);                                   // 32
router.get('/wallet/transactions', verifyToken, getTransactions);                         // 33
router.get('/coin-packs', getCoinPacks);                                                   // 34

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT PLANS  /api/payment-plans  (public — for payment website)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/payment-plans', listPublicPaymentPlans);                                      // 34b

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS  /api/payments
// ─────────────────────────────────────────────────────────────────────────────
router.post('/payments/create-order', verifyToken, requireCaller, createOrder);           // 35
router.post('/payments/verify', verifyToken, requireCaller, verifyPaymentHandler);        // 36
router.post('/payments/webhook', razorpayWebhook);                                        // 37

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATIONS (DM)  /api/conversations
// ─────────────────────────────────────────────────────────────────────────────
router.get('/conversations', verifyToken, conversationController.getConversations);               // DM-1
router.get('/conversations/unread', verifyToken, conversationController.getUnreadCount);          // DM-2
router.post('/conversations/start', verifyToken, conversationController.startConversation);       // DM-3
router.get('/conversations/:id/messages', verifyToken, conversationController.getMessages);       // DM-4
router.post('/conversations/:id/read', verifyToken, conversationController.markRead);             // DM-5
router.delete('/conversations/:id', verifyToken, conversationController.deleteConversation);      // DM-6

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD  /api/leaderboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/leaderboard/weekly', verifyToken, getWeeklyLeaderboard);                      // LB-1
router.get('/leaderboard/my-rank', verifyToken, requireHost, getMyRank);                   // LB-2

// ─────────────────────────────────────────────────────────────────────────────
// EARNINGS  /api/earnings  +  WITHDRAWALS  /api/withdrawals
// ─────────────────────────────────────────────────────────────────────────────
router.get('/earnings/summary', verifyToken, requireHost, getEarningsSummary);            // 38
router.get('/earnings/history', verifyToken, requireHost, getEarningsHistory);            // 39
router.post('/withdrawals/request', verifyToken, requireHost, requestWithdrawal);         // 40
router.get('/withdrawals', verifyToken, requireHost, getWithdrawals);                     // 41
router.get('/withdrawals/:id', verifyToken, requireHost, getWithdrawalById);              // 42

// ─────────────────────────────────────────────────────────────────────────────
// RATINGS  /api/ratings
// ─────────────────────────────────────────────────────────────────────────────
router.post('/ratings', verifyToken, requireCaller, submitRating);                        // 43
router.get('/ratings/host/:hostId', verifyToken, getHostRatings);                         // 44

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS  /api/reports
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reports', verifyToken, submitReport);                                        // 45
router.get('/reports/my', verifyToken, getMyReports);                                     // 46

// ─────────────────────────────────────────────────────────────────────────────
// HOST REGISTRATION  /api/host-registration
// ─────────────────────────────────────────────────────────────────────────────
router.post('/host-registration/apply', verifyToken, applyAsHost);                        // 47
router.get('/host-registration/status', verifyToken, getApplicationStatus);               // 48
router.post('/host-registration/photos', verifyToken, multerHostPhotos, uploadHostPhotos); // 49
router.patch('/host-registration/bank-details', verifyToken, requireHost, updateBankDetails); // 50

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS  /api/notifications
// ─────────────────────────────────────────────────────────────────────────────
router.get('/notifications', verifyToken, getNotifications);                               // 54
router.patch('/notifications/:id/read', verifyToken, markRead);                            // 55
router.patch('/notifications/read-all', verifyToken, markAllRead);                         // 56

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN  /api/admin  — All routes require admin JWT
// ─────────────────────────────────────────────────────────────────────────────
router.post('/admin/login', adminLogin);                                                   // 57

router.get('/admin/dashboard/stats', verifyAdminToken, getDashboardStats);                // 58

// User management
router.get('/admin/users/callers', verifyAdminToken, listCallers);                        // 59
router.get('/admin/users/hosts', verifyAdminToken, adminListHosts);                       // 60
router.get('/admin/users/:id', verifyAdminToken, getUserDetail);                          // 61
router.patch('/admin/users/:id/ban', verifyAdminToken, banUser);                          // 62
router.patch('/admin/users/:id/balance', verifyAdminToken, adjustBalance);                // 63
router.patch('/admin/users/:id/tier', verifyAdminToken, changeHostTier);                  // 64

// Host approval
router.get('/admin/hosts/pending', verifyAdminToken, getPendingHosts);                    // 65
router.patch('/admin/hosts/:id/approve', verifyAdminToken, approveHost);                  // 66
router.patch('/admin/hosts/:id/reject', verifyAdminToken, rejectHost);                    // 67

// Call management
router.get('/admin/calls/active', verifyAdminToken, getActiveCalls);                      // 68
router.get('/admin/calls/logs', verifyAdminToken, getCallLogs);                           // 69
router.post('/admin/calls/:id/force-end', verifyAdminToken, forceEndCall);                // 70

// Revenue
router.get('/admin/revenue/overview', verifyAdminToken, getRevenueOverview);              // 71
router.get('/admin/transactions', verifyAdminToken, getAllTransactions);                   // 72

// Payouts
router.get('/admin/withdrawals/pending', verifyAdminToken, getPendingWithdrawals);        // 73
router.patch('/admin/withdrawals/:id/approve', verifyAdminToken, approveWithdrawal);      // 74
router.patch('/admin/withdrawals/:id/reject', verifyAdminToken, rejectWithdrawal);        // 75

// Content management
router.get('/admin/gifts', verifyAdminToken, listGiftsAdmin);                             // 76
router.post('/admin/gifts', verifyAdminToken, createGift);                                // 77
router.patch('/admin/gifts/:id', verifyAdminToken, updateGift);                           // 78
router.delete('/admin/gifts/:id', verifyAdminToken, deleteGift);                           // 78b
router.get('/admin/tiers', verifyAdminToken, listTiers);                                  // 79
router.patch('/admin/tiers/:id', verifyAdminToken, updateTier);                           // 80
router.get('/admin/coin-packs', verifyAdminToken, listCoinPacksAdmin);                    // 81
router.post('/admin/coin-packs', verifyAdminToken, createCoinPack);                       // 82
router.patch('/admin/coin-packs/:id', verifyAdminToken, updateCoinPack);                  // 83
router.delete('/admin/coin-packs/:id', verifyAdminToken, deleteCoinPack);                  // 83b

// Reports
router.get('/admin/reports', verifyAdminToken, listReports);                              // 84
router.patch('/admin/reports/:id/action', verifyAdminToken, actionReport);                // 85

// Notifications
router.post('/admin/notifications/send', verifyAdminToken, broadcastNotification);        // 86
router.get('/admin/notifications/history', verifyAdminToken, getNotificationHistory);     // 87

// Referrals
router.get('/admin/referrals', verifyAdminToken, getReferrals);                            // 88a

// User Activity
router.get('/admin/stats/activity', verifyAdminToken, getUserActivityStats);               // 88b
router.get('/admin/users/activity', verifyAdminToken, getUserActivityList);                 // 88c

// Happy Hours
router.get('/admin/happy-hours', verifyAdminToken, listHappyHours);                           // HH-A1
router.post('/admin/happy-hours', verifyAdminToken, createHappyHour);                         // HH-A2
router.patch('/admin/happy-hours/:id', verifyAdminToken, updateHappyHour);                    // HH-A3
router.delete('/admin/happy-hours/:id', verifyAdminToken, deleteHappyHour);                   // HH-A4

// VIP Plans
router.get('/admin/vip/plans', verifyAdminToken, listVipPlansAdmin);                          // VIP-A1
router.post('/admin/vip/plans', verifyAdminToken, createVipPlan);                             // VIP-A2
router.patch('/admin/vip/plans/:id', verifyAdminToken, updateVipPlan);                        // VIP-A3
router.delete('/admin/vip/plans/:id', verifyAdminToken, deleteVipPlan);                       // VIP-A4
router.get('/admin/vip/subscribers', verifyAdminToken, listVipSubscribers);                   // VIP-A5
router.get('/admin/vip/revenue', verifyAdminToken, getVipRevenue);                            // VIP-A6

// Leaderboard
router.get('/admin/leaderboard', verifyAdminToken, getAdminLeaderboard);                    // LB-A1

// Conversations (admin moderation)
router.get('/admin/conversations', verifyAdminToken, conversationController.adminGetConversations); // DM-A1

// Settings
router.get('/admin/settings', verifyAdminToken, getSettings);                             // 88
router.patch('/admin/settings', verifyAdminToken, updateSettings);                        // 89

// Payment Plans (admin)
router.get('/admin/payment-plans', verifyAdminToken, listPaymentPlansAdmin);              // 90
router.post('/admin/payment-plans', verifyAdminToken, createPaymentPlan);                 // 91
router.patch('/admin/payment-plans/:id', verifyAdminToken, updatePaymentPlan);            // 92
router.delete('/admin/payment-plans/:id', verifyAdminToken, deletePaymentPlan);           // 93

export default router;
