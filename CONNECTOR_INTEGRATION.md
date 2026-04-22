# How to run the Python connector service

1. Install dependencies:

```
pip install flask requests
```

2. Set required environment variables (see top of connector.py):

- MESHCTRL_PATH
- MESHCENTRAL_URL
- MESHCENTRAL_USER
- MESHCENTRAL_PASS
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, etc.
- (Optional) SECRET_TOKEN, BACKEND_CALLBACK_URL, SERVICE_PORT, SERVICE_HOST

3. Run the service:

```
python connector.py --serve
```

The service will listen on http://0.0.0.0:8000 by default.

# Backend integration

The backend calls the connector service via HTTP (see `src/integrations/connector.service.js`).

Set these environment variables in your backend:
- CONNECTOR_URL (default: http://localhost:8000)
- CONNECTOR_SECRET_TOKEN (if using SECRET_TOKEN)

# Example usage in backend

```
import { generateRdpLink } from '../integrations/connector.service';

const payload = { ... };
const result = await generateRdpLink(payload);
```
