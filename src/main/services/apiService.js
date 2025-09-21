export async function sendLinkToMapper({ voucherCode, driveLink }) {
  try {
    const apiKey = process.env.API_SECRET_KEY;
    const apiUrl = process.env.API_ENDPOINT;

    if (!apiKey || !apiUrl) {
      throw new Error('API key or endpoint is not configured in .env file.');
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        voucherCode: voucherCode,
        driveLink: driveLink,
      }),
    });

    if (!response.ok) {
      // Check if the response is JSON before trying to parse it
      const contentType = response.headers.get("content-type");
      let errorData;
      if (contentType && contentType.indexOf("application/json") !== -1) {
        errorData = await response.json();
        throw new Error(`API responded with status ${response.status}: ${errorData.message || 'Unknown JSON error'}`);
      } else {
        errorData = await response.text();
        throw new Error(`API responded with status ${response.status}: ${errorData}`);
      }
    }

    return { success: true, data: await response.json() };
  } catch (error) {
    console.error('Failed to send link to mapping service:', error);
    return { success: false, error: error.message };
  }
}