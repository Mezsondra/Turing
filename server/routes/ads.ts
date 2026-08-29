import { Router, Request, Response } from 'express';
import { db } from '../database/db.js';
import { loadVerifierKeys, verifyRewardCallback } from '../adReward.js';

const router = Router();

/**
 * AdMob rewarded-video server-side verification callback.
 *
 * Deliberately unauthenticated: Google calls it, and the signature is the
 * authentication. Configure the URL under the ad unit's "Server-side
 * verification" section in the AdMob console, and pass the player id as
 * `customData` when preparing the ad.
 *
 * Always answers 200 once the request has been dealt with, including for a
 * replay. Google retries anything else, and a retry of an already-credited
 * transaction is not a failure - it is the same reward arriving twice.
 */
router.get('/reward', async (req: Request, res: Response) => {
  try {
    // Verbatim from the request line: express's parsed query reorders and
    // re-encodes, and the signature is over the original bytes.
    const rawQuery = req.originalUrl.split('?')[1] || '';

    let keys = await loadVerifierKeys();
    let grant = verifyRewardCallback(rawQuery, (id) => keys.get(id));

    // Google rotates signing keys. A miss is far more likely to be a stale
    // cache than a forgery, so refetch once before giving up.
    if (!grant) {
      keys = await loadVerifierKeys(true);
      grant = verifyRewardCallback(rawQuery, (id) => keys.get(id));
    }

    if (!grant) {
      console.warn('Rejected an unverified reward callback');
      return res.status(403).send('invalid signature');
    }

    if (grant.rewardAmount > 0) {
      const credited = db.grantRewardRounds(grant.transactionId, grant.playerId, grant.rewardAmount);
      if (credited) {
        console.log(`Granted ${grant.rewardAmount} rounds to ${grant.playerId}`);
      }
    }

    res.status(200).send('ok');
  } catch (error) {
    // A 500 makes Google retry, which is what we want if the key fetch failed.
    console.error('Reward callback failed:', error);
    res.status(500).send('error');
  }
});

export default router;
