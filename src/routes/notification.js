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

router.post('/notify-file-upload', async (req, res) => {
  try {
    const { 
      receiverId,
      senderId,
      fileName,
      fileId,
      additionalData  // New additional data structure
    } = req.body;
    
    // Find receiver's device
    const receiverDevice = await Device.findOne({ userId: receiverId });
    if (!receiverDevice) {
      return res.status(404).json({ 
        success: false, 
        error: 'Receiver device not found' 
      });
    }

    // Find sender's info for the notification
    const senderDevice = await Device.findOne({ userId: senderId });
    
    // Prepare notification content
    const title = 'Document Authentication Required';
    const message = `A new document "${fileName}" requires your review`;
    
    // Send notification with complete data structure
    const result = await sendNotification(
      receiverDevice.playerId,
      title,
      message,
      {
        workflowId: additionalData.workflowId,
        fileId: additionalData.fileId,
        fileName: additionalData.fileName,
        uniqueCode: additionalData.uniqueCode,
        description: additionalData.description,
        uploadDate: additionalData.uploadDate,
        ownerDetails: additionalData.ownerDetails,
        type: 'file_authentication',
        senderId: senderId,
        senderName: senderDevice?.deviceInfo?.userName || 'Unknown User'
      }
    );

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error sending file upload notification:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send notification',
      details: error.message 
    });
  }
});

export default router;