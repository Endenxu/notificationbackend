import axios from 'axios';

export const sendNotification = async (playerId, title, message, additionalData = {}) => {
  try {
    if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
      throw new Error('OneSignal configuration missing');
    }

    // Validate inputs
    if (!playerId || !title || !message) {
      throw new Error('Missing required notification parameters');
    }

    const response = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      {
        app_id: process.env.ONESIGNAL_APP_ID,
        include_player_ids: [playerId],
        contents: { en: message },
        headings: { en: title },
        data: additionalData,
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