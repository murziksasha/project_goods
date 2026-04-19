import mongoose from 'mongoose';
import { env } from './env';

export const connectDatabase = () => mongoose.connect(env.mongoUri);
