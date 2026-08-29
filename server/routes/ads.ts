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

    // Unverified callbacks still answer 200, and grant nothing. Two reasons:
    // AdMob validates the URL from the console by pinging it unsigned, and a
    // rejection is never something Google should retry - it is a forgery or a
    // test, and neither improves on a second attempt. The signature is what
    // protects the grant; the status code was never doing that job.
    if (!grant) {
      const hadSignature = rawQuery.includes('&signature=');
      console.warn(
        hadSignature
          ? 'Reward callback failed verification - granting nothing'
          : 'Unsigned request to the reward callback (AdMob console check, or a probe)'
      );
      return res.status(200).send('ok');
    }

    if (grant.rewardAmount > 0) {
      const credited = db.grantRewardRounds(grant.transactionId, grant.playerId, grant.rewardAmount);
      if (credited) {
        console.log(`Granted ${grant.rewardAmount} rounds to ${grant.playerId}`);
      }
    }

    res.status(200).send('ok');
  } catch (error) {
    // The one case worth a retry: the key fetch or the database failed, so a
    // genuine reward may have been lost. 500 is what makes Google send it
    // again.
    console.error('Reward callback failed:', error);
    res.status(500).send('error');
  }
});

export default router;
