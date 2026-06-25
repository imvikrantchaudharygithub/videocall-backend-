import { Request, Response } from 'express';
import { HostProfile } from '../models/hostProfile.model';
import { User } from '../models/user.model';
import { CallerProfile } from '../models/callerProfile.model';
import { errorResponse, successResponse } from '../types';
import mongoose from 'mongoose';
import { getIO } from '../socket';
import redis from '../config/redis';
import { REDIS_KEYS } from '../utils/constants';

export const listHosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      online = 'true',
      tier,
      language,
      minRating,
      sort = 'online',
    } = req.query as Record<string, string>;

    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = { isApproved: true };
    if (online === 'true') filter.isOnline = true;
    if (tier) filter.currentTier = { $in: tier.split(',').map(Number) };
    if (language) filter.languages = { $in: language.split(',') };
    if (minRating) filter.ratingAvg = { $gte: parseFloat(minRating) };

    let sortObj: Record<string, 1 | -1> = { isOnline: -1, ratingAvg: -1 };
    if (sort === 'rating') sortObj = { ratingAvg: -1 };
    else if (sort === 'price_low') sortObj = { videoRatePerMin: 1 };
    else if (sort === 'price_high') sortObj = { videoRatePerMin: -1 };

    const [hosts, total] = await Promise.all([
      HostProfile.find(filter, '-bankDetails')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'displayName'),
      HostProfile.countDocuments(filter),
    ]);

    res.json(successResponse(hosts, {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    }));
  } catch (error) {
    console.error('listHosts error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getHostById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const host = await HostProfile.findOne({ userId: id }, '-bankDetails')
      .populate('userId', 'displayName');

    if (!host) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Host not found'));
      return;
    }
    res.json(successResponse(host));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const searchHosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query as { q: string };
    if (!q) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'Search query is required'));
      return;
    }

    const users = await User.find({
      userType: 'host',
      displayName: { $regex: q, $options: 'i' },
    }).select('_id');

    const userIds = users.map((u) => u._id);
    const hosts = await HostProfile.find({
      userId: { $in: userIds },
      isApproved: true,
    }, '-bankDetails').limit(20);

    res.json(successResponse(hosts));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const applyAsHost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bio, languages, tags } = req.body;
    await HostProfile.updateOne(
      { userId: req.userId },
      { $set: { bio, languages, tags, approvalStatus: 'pending' } },
      { upsert: true }
    );
    res.json(successResponse({ message: 'Host application submitted' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getApplicationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = await HostProfile.findOne({ userId: req.userId }).select('approvalStatus rejectionReason');
    res.json(successResponse(profile));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const uploadHostPhotos = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as (Express.Multer.File & { path: string })[];
    if (!files || files.length === 0) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'No photos uploaded'));
      return;
    }

    const photoUrls = files.map((f) => f.path);
    await HostProfile.updateOne(
      { userId: req.userId },
      { $push: { photoUrls: { $each: photoUrls } } }
    );
    res.json(successResponse({ photoUrls }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const updateBankDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountNumber, ifscCode, accountHolderName, upiId } = req.body;
    await HostProfile.updateOne(
      { userId: req.userId },
      { $set: { bankDetails: { accountNumber, ifscCode, accountHolderName, upiId } } }
    );
    res.json(successResponse({ message: 'Bank details updated' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const getFavourites = async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = await CallerProfile.findOne({ userId: req.userId });
    const favouriteIds = profile?.favouriteHosts ?? [];

    const hosts = await HostProfile.find(
      { userId: { $in: favouriteIds } },
      '-bankDetails'
    );
    res.json(successResponse(hosts));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const addFavourite = async (req: Request, res: Response): Promise<void> => {
  try {
    const hostId = req.params.hostId;
    const hostIdStr = Array.isArray(hostId) ? hostId[0] : hostId;
    await CallerProfile.updateOne(
      { userId: req.userId },
      { $addToSet: { favouriteHosts: new mongoose.Types.ObjectId(hostIdStr) } }
    );
    res.json(successResponse({ message: 'Added to favourites' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const removeFavourite = async (req: Request, res: Response): Promise<void> => {
  try {
    const hostId = req.params.hostId;
    const hostIdStr = Array.isArray(hostId) ? hostId[0] : hostId;
    await CallerProfile.updateOne(
      { userId: req.userId },
      { $pull: { favouriteHosts: new mongoose.Types.ObjectId(hostIdStr) } }
    );
    res.json(successResponse({ message: 'Removed from favourites' }));
  } catch (error) {
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

// REST presence — mirrors presenceSocket host:go-online / host:go-offline
export const goOnline = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!.toString();
    await redis.set(REDIS_KEYS.hostOnline(userId), '1', 'EX', 90);
    await HostProfile.updateOne({ userId: req.userId }, { $set: { isOnline: true } });
    try {
      getIO().emit('host:status-changed', { hostId: userId, isOnline: true });
    } catch { /* socket not initialized */ }
    res.json(successResponse({ isOnline: true }));
  } catch (error) {
    console.error('goOnline error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};

export const goOffline = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!.toString();
    await redis.del(REDIS_KEYS.hostOnline(userId));
    await HostProfile.updateOne({ userId: req.userId }, { $set: { isOnline: false } });
    try {
      getIO().emit('host:status-changed', { hostId: userId, isOnline: false });
    } catch { /* socket not initialized */ }
    res.json(successResponse({ isOnline: false }));
  } catch (error) {
    console.error('goOffline error:', error);
    res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
  }
};
