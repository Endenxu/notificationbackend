import express from 'express';
import Device from '../models/Device.js';
import { sendNotification } from '../services/oneSignal.js';

const router = express.Router();

// Register or update device
router.post('/devices', async (req, res) => {
  try {
    const { userId, playerId, deviceInfo } = req.body;
    
    const device = await Device.findOneAndUpdate(
      { userId },
      { userId, playerId, deviceInfo },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, device });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ success: false, error: 'Failed to register device' });
  }
});

// Send notification
router.post('/notify', async (req, res) => {
  try {
    const { userId, title, message } = req.body;
    
    const device = await Device.findOne({ userId });
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    const result = await sendNotification(device.playerId, title, message);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ success: false, error: 'Failed to send notification' });
  }
});

// Delete device
router.delete('/devices/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await Device.findOneAndDelete({ userId });
    res.json({ success: true, message: 'Device deleted' });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ success: false, error: 'Failed to delete device' });
  }
});

export default router;