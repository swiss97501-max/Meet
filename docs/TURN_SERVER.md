# TURN Server Setup Guide

## Overview

TURN (Traversal Using Relays around NAT) servers are essential for WebRTC to work in restrictive network environments. They relay media when direct peer-to-peer connections fail.

## Deployment Options

### 1. Self-Hosted coturn

**Installation (Ubuntu/Debian):**
```bash
sudo apt-get install coturn
```

**Configuration** (`/etc/coturn/turnserver.conf`):
```
# Network
listening-port=3478
listening-ip=0.0.0.0
relay-ip=<YOUR_PUBLIC_IP>
external-ip=<YOUR_PUBLIC_IP>

# Authentication
user=meeting:swiss2024
realm=meeting.swiss

# Performance
max-bps=0
bps-capacity=0
max-allocate-lifetime=3600

# Logging
log-file=/var/log/coturn/turnserver.log
verbose
```

**Start service:**
```bash
sudo systemctl start coturn
sudo systemctl enable coturn
```

**Verify:**
```bash
sudo netstat -tulpn | grep coturn
```

### 2. AWS EC2 with coturn

**Launch instance:**
- Ubuntu 22.04 LTS
- Security group: Allow UDP 3478, TCP 3478
- Elastic IP for static address

**Setup:**
```bash
#!/bin/bash
sudo apt-get update
sudo apt-get install -y coturn

# Configure
sudo tee /etc/coturn/turnserver.conf > /dev/null <<EOF
listening-port=3478
listening-ip=0.0.0.0
relay-ip=$(ec2-metadata --public-ipv4 | cut -d " " -f 2)
external-ip=$(ec2-metadata --public-ipv4 | cut -d " " -f 2)
user=meeting:swiss2024
realm=meeting.swiss
max-bps=0
log-file=/var/log/coturn/turnserver.log
verbose
EOF

sudo systemctl restart coturn
```

### 3. Docker Deployment

**Dockerfile:**
```dockerfile
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y coturn

COPY turnserver.conf /etc/coturn/

EXPOSE 3478/udp 3478/tcp

CMD ["turnserver", "-c", "/etc/coturn/turnserver.conf"]
```

**Docker Compose:**
```yaml
version: '3.8'

services:
  turn:
    build: .
    ports:
      - "3478:3478/udp"
      - "3478:3478/tcp"
    environment:
      - RELAY_IP=<YOUR_PUBLIC_IP>
      - EXTERNAL_IP=<YOUR_PUBLIC_IP>
    volumes:
      - ./turnserver.conf:/etc/coturn/turnserver.conf:ro
```

### 4. Commercial Services

**Recommended providers:**
- Twilio Network Traversal Service
- Xirsys
- Metered
- Cloudflare

**Advantages:**
- Global distribution
- Automatic scaling
- Built-in monitoring
- No infrastructure management

## Client Configuration

### Web Client

```typescript
const config = {
  iceServers: [
    // STUN servers (free, for NAT detection)
    { urls: ['stun:stun.l.google.com:19302'] },
    { urls: ['stun:stun1.l.google.com:19302'] },

    // TURN servers (for relay)
    {
      urls: ['turn:turn.example.com:3478'],
      username: 'meeting',
      credential: 'swiss2024',
    },
    {
      urls: ['turn:turn.example.com:3478?transport=tcp'],
      username: 'meeting',
      credential: 'swiss2024',
    },
  ],
};

const peerConnection = new RTCPeerConnection(config);
```

### iOS

```swift
let iceServers = [
  RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302"]),
  RTCIceServer(
    urls: ["turn:turn.example.com:3478"],
    username: "meeting",
    credential: "swiss2024"
  ),
]

let config = RTCConfiguration()
config.iceServers = iceServers
let peerConnection = peerConnectionFactory.peerConnection(with: config, constraints: constraints, delegate: self)
```

### Android

```kotlin
val iceServers = listOf(
  PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
  PeerConnection.IceServer.builder("turn:turn.example.com:3478")
    .setUsername("meeting")
    .setPassword("swiss2024")
    .createIceServer(),
)

val rtcConfig = PeerConnection.RTCConfiguration(iceServers)
val peerConnection = peerConnectionFactory.createPeerConnection(rtcConfig, observer)
```

## Monitoring & Troubleshooting

### Check TURN Server Status

```bash
# Check if listening
sudo netstat -tulpn | grep coturn

# Check logs
sudo tail -f /var/log/coturn/turnserver.log

# Test with turnutils
turnutils_uclient -v -n 10 -u meeting -w swiss2024 -e meeting.swiss turn.example.com
```

### Common Issues

**Issue: No candidates from TURN server**
- Check firewall rules (UDP/TCP 3478)
- Verify public IP configuration
- Check authentication credentials

**Issue: High latency**
- TURN server too far geographically
- Deploy regional TURN servers
- Use TCP fallback for restrictive networks

**Issue: Connection drops**
- Increase connection timeout
- Implement reconnection logic
- Monitor TURN server load

## Performance Tuning

### Bandwidth Optimization

```conf
# Limit per-connection bandwidth
max-bps=1000000  # 1 Mbps per connection

# Total capacity
bps-capacity=100000000  # 100 Mbps total
```

### Connection Limits

```conf
# Max concurrent allocations
max-allocate-lifetime=3600  # 1 hour

# Max connections per user
user-quota=100
```

### Scaling

**Multi-server setup:**
```
Load Balancer
├── TURN Server 1 (Region: US)
├── TURN Server 2 (Region: EU)
└── TURN Server 3 (Region: APAC)
```

**Kubernetes deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: turn-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: turn
  template:
    metadata:
      labels:
        app: turn
    spec:
      containers:
      - name: coturn
        image: coturn:latest
        ports:
        - containerPort: 3478
          protocol: UDP
        - containerPort: 3478
          protocol: TCP
        env:
        - name: RELAY_IP
          valueFrom:
            fieldRef:
              fieldPath: status.podIP
```

## Security Best Practices

1. **Change default credentials**
   ```conf
   user=meeting:YOUR_STRONG_PASSWORD
   ```

2. **Enable logging**
   ```conf
   log-file=/var/log/coturn/turnserver.log
   verbose
   ```

3. **Restrict access**
   - Use firewall rules
   - Implement rate limiting
   - Monitor for abuse

4. **Use TLS for signaling**
   - All signaling over HTTPS/WSS
   - Certificate validation

5. **Rotate credentials regularly**
   - Change TURN passwords monthly
   - Update clients with new credentials

## Cost Estimation

### Self-Hosted (AWS EC2)
- Instance: t3.medium (~$30/month)
- Bandwidth: ~$0.09/GB
- Total: ~$30-100/month (depending on usage)

### Commercial Services
- Twilio: $0.015 per 1000 minutes
- Xirsys: $0.004 per GB
- Metered: $0.01 per GB

## References

- [coturn Documentation](https://github.com/coturn/coturn)
- [RFC 5766 - TURN Protocol](https://tools.ietf.org/html/rfc5766)
- [WebRTC ICE Candidates](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate)
