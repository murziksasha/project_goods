import { Router } from 'express';
import * as controller from './controller';

export const eventsRouter = Router();

eventsRouter.get('/events/stream', controller.streamEvents);

