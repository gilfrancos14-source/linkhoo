import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { isValidMarket } from '../utils/market';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { market } = req.query;
    let query = supabase.from('rooms').select('*').order('created_at', { ascending: false });
    if (market && isValidMarket(market as string)) {
      query = query.eq('market', market);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('rooms').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Room not found' });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('rooms').insert(req.body).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('rooms').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { error } = await supabase.from('rooms').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { data: room, error: fetchError } = await supabase.from('rooms').select('disponible').eq('id', req.params.id).single();
    if (fetchError) throw fetchError;
    const { data, error } = await supabase.from('rooms').update({ disponible: !room.disponible }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
