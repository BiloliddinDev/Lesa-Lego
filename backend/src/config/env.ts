import { cleanEnv, str, port, url } from 'envalid';
import dotenv from 'dotenv';

dotenv.config();

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  PORT: port({ default: 5000 }),
  MONGODB_URI: str(),
  BOT_TOKEN: str(),
  WEBAPP_URL: url(),
  JWT_SECRET: str(),
  JWT_EXPIRES_IN: str({ default: '7d' }),
});
