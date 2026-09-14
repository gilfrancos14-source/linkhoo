import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import roomsRouter from './routes/rooms';
import categoriesRouter from './routes/categories';
import bannersRouter from './routes/banners';
import reservationsRouter from './routes/reservations';
import notificationsRouter from './routes/notifications';
import uploadRouter from './routes/upload';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/rooms', roomsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/banners', bannersRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/client-notifications', notificationsRouter);
app.use('/api/upload', uploadRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
