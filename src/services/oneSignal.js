import axios from 'axios';

export const sendNotification = async (playerId, title, message, additionalData = {}) => {
  try {
    // Check if the required OneSignal configuration variables are set
    // If not, throw an error indicating that the configuration is missing
    if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
      throw new Error('OneSignal configuration missing');
    }

    // Validate the required input parameters
    // If any of the required parameters (playerId, title, message) are missing, throw an error
    if (!playerId || !title || !message) {
      throw new Error('Missing required notification parameters');
    }

    // Send a POST request to the OneSignal API to create a new notification
    // The request payload includes the OneSignal app ID, the player ID of the target device,
    // the notification content (message), title, and any additional data
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
          // Set the authorization header using the OneSignal REST API key
          'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Return the response data from the OneSignal API
    return response.data;
  } catch (error) {
    // If an error occurs during the request or if the OneSignal configuration is missing,
    // log the error and throw a new error indicating the failure to send the notification
    console.error('OneSignal API error:', error);
    throw new Error('Failed to send notification through OneSignal');
  }
};