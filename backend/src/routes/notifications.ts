import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// ── Admin notifications ──

router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('notifications').select('*').order('date', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/unread-count', async (_req: Request, res: Response) => {
  try {
    const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('read', false);
    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const notification = {
      id: 'notif-' + Date.now(),
      type: req.body.type,
      room_title: req.body.roomTitle,
      room_id: req.body.roomId,
      client_name: req.body.clientName,
      client_email: req.body.clientEmail,
      client_phone: req.body.clientPhone,
      message: req.body.message,
      reservation_id: req.body.reservationId,
    };
    const { data, error } = await supabase.from('notifications').insert(notification).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('notifications').update({ read: true }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/read-all', async (_req: Request, res: Response) => {
  try {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('read', false);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Client notifications ──

router.get('/client', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const { data, error } = await supabase.from('client_notifications').select('*').eq('client_email', email).order('date', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/client', async (req: Request, res: Response) => {
  try {
    const notification = {
      id: 'client-notif-' + Date.now(),
      type: req.body.type,
      room_title: req.body.roomTitle,
      room_id: req.body.roomId,
      client_email: req.body.clientEmail,
      message: req.body.message,
    };
    const { data, error } = await supabase.from('client_notifications').insert(notification).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/client/:id/read', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('client_notifications').update({ read: true }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
