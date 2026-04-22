// Integration for communicating with the Python connector service
// Located at http://localhost:8000 by default

import axios from 'axios';

const CONNECTOR_URL = process.env.CONNECTOR_URL || 'http://localhost:8000';

/**
 * Calls the connector service to generate an RDP link and send email.
 * @param {object} bookingPayload - The booking payload matching connector.py's BookingPayload
 * @returns {Promise<object>} - The connector result
 */
export async function generateRdpLink(bookingPayload) {
  try {
    const resp = await axios.post(
      `${CONNECTOR_URL}/connector/generate-rdp`,
      bookingPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.CONNECTOR_SECRET_TOKEN
            ? { Authorization: `Bearer ${process.env.CONNECTOR_SECRET_TOKEN}` }
            : {}),
        },
      }
    );
    return resp.data;
  } catch (err) {
    if (err.response) {
      throw new Error(`Connector error: ${err.response.data.error || err.response.statusText}`);
    }
    throw err;
  }
}
