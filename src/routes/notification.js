// routes.js
import express from 'express';
import Device from '../models/Device.js';
import { sendNotification } from '../services/oneSignal.js';
const router = express.Router();

// Middleware to validate requests
const validateRequest = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

// Sanitize user data
const sanitizeUserData = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.displayName,
    arabicDisplayName: user.arabicDisplayName
  };
};

// Register or update device
router.post('/devices', validateRequest, async (req, res) => {
  try {
    const { userId, playerId, deviceInfo } = req.body;
    
    if (!userId || !playerId || !deviceInfo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const sanitizedDeviceInfo = {
      platform: deviceInfo.platform,
      model: deviceInfo.model,
      version: deviceInfo.version
    };

    const device = await Device.findOneAndUpdate(
      { userId },
      { userId, playerId, deviceInfo: sanitizedDeviceInfo },
      { upsert: true, new: true }
    );
    
    res.json({ 
      success: true, 
      device: {
        userId: device.userId,
        playerId: device.playerId
      }
    });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to register device' 
    });
  }
});

// Send notification
router.post('/notify', validateRequest, async (req, res) => {
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

// Send file upload notification
router.post('/notify-file-upload', validateRequest, async (req, res) => {
  try {
    const { 
      receiverId,
      senderId,
      fileName,
      fileId,
      additionalData
    } = req.body;

    if (!receiverId || !senderId || !fileName || !fileId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const receiverDevice = await Device.findOne({ userId: receiverId });
    if (!receiverDevice) {
      return res.status(404).json({ 
        success: false, 
        error: 'Receiver device not found' 
      });
    }

    // Prepare notification data with workflow fields
    const notificationData = {
      workflowId: additionalData.workflowId,
      fileId: additionalData.fileId,
      fileName: additionalData.fileName,
      uniqueCode: additionalData.uniqueCode,
      description: additionalData.description,
      uploadDate: additionalData.uploadDate,
      ownerDetails: {
        ownerUser: sanitizeUserData(additionalData.ownerDetails?.ownerUser),
        authRequiredFromUser: sanitizeUserData(additionalData.ownerDetails?.authRequiredFromUser)
      },
      // Add necessary workflow flags
      authRequired: true,
      canForward: true,
      canChangeResponsibleByManager: true,
      canReject: true,
      status: 0,
      stepNumber: 1,
      id: fileId,
      notes: '',
      startDate: additionalData.uploadDate,
      fileUniqueCode: additionalData.uniqueCode,
      fileDescription: additionalData.description,
      fileOwnerName: additionalData.ownerDetails?.ownerUser?.displayName || '',
      fileOwnerArabicName: additionalData.ownerDetails?.ownerUser?.arabicDisplayName || '',
      responsibleName: additionalData.ownerDetails?.authRequiredFromUser?.displayName || '',
      responsibleArabicName: additionalData.ownerDetails?.authRequiredFromUser?.arabicDisplayName || ''
    };

    const title = 'Document Authentication Required';
    const message = `A new document "${fileName}" requires your review`;

    const result = await sendNotification(
      receiverDevice.playerId,
      title,
      message,
      notificationData
    );

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error sending file upload notification:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send notification' 
    });
  }
});

// Delete device
router.delete('/devices/:userId', validateRequest, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const result = await Device.findOneAndDelete({ userId });
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    res.json({ 
      success: true, 
      message: 'Device deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete device' 
    });
  }
});

export default router;

// oneSignal.js
import axios from 'axios';

const sanitizeNotificationData = (additionalData = {}) => {
  // Extract required fields
  const {
    workflowId,
    fileId,
    fileName,
    uniqueCode,
    description,
    uploadDate,
    ownerDetails,
    authRequired = true,
    canForward = true,
    canChangeResponsibleByManager = true,
    canReject = true,
    status = 0,
    stepNumber = 1,
    id,
    notes = '',
    fileUniqueCode,
    fileDescription,
    fileOwnerName,
    fileOwnerArabicName,
    responsibleName,
    responsibleArabicName
  } = additionalData;

  // Sanitize user data
  const sanitizeUser = (user) => user ? {
    id: user.id,
    displayName: user.displayName,
    arabicDisplayName: user.arabicDisplayName
  } : null;

  // Build sanitized data object
  const sanitizedData = {
    workflowId: workflowId || fileId,
    fileId,
    fileName,
    uniqueCode,
    description,
    uploadDate,
    ownerDetails: {
      ownerUser: sanitizeUser(ownerDetails?.ownerUser),
      authRequiredFromUser: sanitizeUser(ownerDetails?.authRequiredFromUser)
    },
    // Workflow flags
    authRequired,
    canForward,
    canChangeResponsibleByManager,
    canReject,
    status,
    stepNumber,
    // Additional workflow data
    id: id || workflowId || fileId,
    notes,
    startDate: uploadDate,
    // File details
    fileUniqueCode: fileUniqueCode || uniqueCode,
    fileDescription: fileDescription || description,
    fileOwnerName: fileOwnerName || ownerDetails?.ownerUser?.displayName || '',
    fileOwnerArabicName: fileOwnerArabicName || ownerDetails?.ownerUser?.arabicDisplayName || '',
    responsibleName: responsibleName || ownerDetails?.authRequiredFromUser?.displayName || '',
    responsibleArabicName: responsibleArabicName || ownerDetails?.authRequiredFromUser?.arabicDisplayName || ''
  };

  return sanitizedData;
};

export const sendNotification = async (playerId, title, message, additionalData = {}) => {
  try {
    // Validate OneSignal configuration
    if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
      throw new Error('OneSignal configuration missing');
    }

    // Validate required inputs
    if (!playerId || !title || !message) {
      throw new Error('Missing required notification parameters');
    }

    // Sanitize and prepare the notification data
    const sanitizedData = sanitizeNotificationData(additionalData);

    console.log('Sending notification with data:', JSON.stringify({
      playerId,
      title,
      message,
      sanitizedData
    }, null, 2));

    // Send notification through OneSignal
    const response = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      {
        app_id: process.env.ONESIGNAL_APP_ID,
        include_player_ids: [playerId],
        contents: { en: message },
        headings: { en: title },
        data: sanitizedData,
      },
      {
        headers: {
          'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('OneSignal API error:', error);
    throw new Error('Failed to send notification through OneSignal');
  }
};