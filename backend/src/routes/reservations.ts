import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('reservations').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/client', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const { data, error } = await supabase.from('reservations').select('*').eq('client_email', email).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const reservation = {
      id: 'res-' + Date.now(),
      client_name: req.body.clientName,
      client_email: req.body.clientEmail,
      client_phone: req.body.clientPhone,
      room_id: req.body.roomId,
      room_title: req.body.roomTitle,
      date_debut: req.body.dateDebut,
      date_fin: req.body.dateFin,
      montant: req.body.montant,
      message: req.body.message,
      statut: 'en_attente',
    };
    const { data, error } = await supabase.from('reservations').insert(reservation).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { statut } = req.body;
    if (statut !== 'confirmee' && statut !== 'annulee') {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { data, error } = await supabase.from('reservations').update({ statut, responded_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/check-conflict', async (req: Request, res: Response) => {
  try {
    const { room_id, date_debut, date_fin, exclude_id } = req.query;
    let query = supabase.from('reservations').select('*').eq('room_id', room_id).neq('statut', 'annulee');
    if (exclude_id) query = query.neq('id', exclude_id as string);
    const { data: reservations, error } = await query;
    if (error) throw error;

    const newStart = new Date(date_debut as string).getTime();
    const newEnd = new Date(date_fin as string).getTime();

    for (const r of reservations || []) {
      if (!r.date_debut || !r.date_fin) continue;
      const existingStart = new Date(r.date_debut).getTime();
      const existingEnd = new Date(r.date_fin).getTime();
      if (newStart < existingEnd && newEnd > existingStart) {
        return res.json({ hasConflict: true, conflictingReservation: r });
      }
    }
    res.json({ hasConflict: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
