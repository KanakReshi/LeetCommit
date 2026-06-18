import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate';
import { register, login } from '../controllers/auth.controller';
import { githubLogin, githubCallback, refreshToken } from '../controllers/oauth.controller';

const router = Router();

const authSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
  }),
});

// Native Auth
router.post('/register', validate(authSchema), register);
router.post('/login', validate(authSchema), login);

// GitHub OAuth
router.get('/github', githubLogin);
router.get('/github/callback', githubCallback);

// Session Management
router.post('/refresh', refreshToken);

export default router;
