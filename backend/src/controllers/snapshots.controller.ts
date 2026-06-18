import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { logger } from '../utils/logger';

export const saveSnapshot = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    const snapshotData = req.body; // Assume body matches the getFullProfileSnapshot output

    // Optional: We can prevent saving duplicate snapshots if the data hasn't changed since the last one.
    // For now, we simply save it to create a time-series.
    const snapshot = await prisma.snapshot.create({
      data: {
        user: { connect: { id: userId } },
        data: snapshotData,
      },
    });

    logger.info({ userId }, `Snapshot created successfully: ${snapshot.id}`);
    res.status(201).json({ success: true, data: snapshot });
  } catch (error) {
    next(error);
  }
};

export const listSnapshots = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;
    
    const limit = parseInt(req.query.limit as string) || 30; // Last 30 snapshots by default
    
    const snapshots = await prisma.snapshot.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.status(200).json({
      success: true,
      data: snapshots,
    });
  } catch (error) {
    next(error);
  }
};
