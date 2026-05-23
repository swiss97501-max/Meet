# Meeting Swiss — Production Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Browsers / Mobile Apps                │
│         (React Web + iOS + Android Clients)                  │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼───┐  ┌─────▼──┐  ┌─────▼──┐
   │Signaling│  │ WebRTC │  │ TURN   │
   │Server   │  │ SFU    │  │ Relay  │
   │(Socket) │  │(Media) │  │(NAT)   │
   └────┬───┘  └─────┬──┘  └─────┬──┘
        │            │            │
        └────────────┼────────────┘
                     │
        ┌────────────▼────────────┐
        │   Database (MySQL)      │
        │   - Rooms               │
        │   - Users               │
        │   - Recordings          │
        └─────────────────────────┘
```

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- AWS account (for deployment)
- SSL certificates (for HTTPS/WSS)

## 1. Local Development

### Setup

```bash
# Clone repository
git clone https://github.com/swiss97501-max/Meet.git
cd Meet

# Install dependencies
cd web && npm install
cd ../sfu-server && npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings
```

### Run Locally

**Terminal 1 - SFU Server:**
```bash
cd sfu-server
npm run dev
# Listening on http://localhost:3000
```

**Terminal 2 - Web App:**
```bash
cd web
npm run dev
# Listening on http://localhost:5173
```

**Terminal 3 - TURN Server (optional):**
```bash
docker run -d -p 3478:3478/udp -p 3478:3478/tcp coturn:latest
```

### Test

```bash
# Open browser
http://localhost:5173

# Create room and test with multiple tabs/devices
```

## 2. Docker Deployment

### Build Images

```bash
# SFU Server
docker build -t meeting-swiss-sfu:latest ./sfu-server

# Web App
docker build -t meeting-swiss-web:latest ./web

# TURN Server
docker build -t meeting-swiss-turn:latest ./turn-server
```

### Docker Compose

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: meeting_swiss
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"

  sfu:
    build: ./sfu-server
    environment:
      DATABASE_URL: mysql://root:root@mysql:3306/meeting_swiss
      NODE_ENV: production
      ANNOUNCED_IP: <YOUR_PUBLIC_IP>
    ports:
      - "3000:3000"
    depends_on:
      - mysql
    restart: unless-stopped

  web:
    build: ./web
    environment:
      VITE_SFU_URL: http://<YOUR_PUBLIC_IP>:3000
      NODE_ENV: production
    ports:
      - "5173:5173"
    depends_on:
      - sfu
    restart: unless-stopped

  turn:
    image: coturn:latest
    environment:
      RELAY_IP: <YOUR_PUBLIC_IP>
      EXTERNAL_IP: <YOUR_PUBLIC_IP>
    ports:
      - "3478:3478/udp"
      - "3478:3478/tcp"
    restart: unless-stopped

volumes:
  mysql_data:
```

**Deploy:**
```bash
docker-compose up -d
```

## 3. AWS Deployment

### Infrastructure Setup

**1. Create VPC**
```bash
aws ec2 create-vpc --cidr-block 10.0.0.0/16
```

**2. Create Subnets**
```bash
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.1.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.2.0/24 --availability-zone us-east-1b
```

**3. Create Security Groups**
```bash
# Web/SFU
aws ec2 create-security-group --group-name meeting-swiss-web --description "Web and SFU" --vpc-id vpc-xxx

aws ec2 authorize-security-group-ingress --group-id sg-xxx \
  --protocol tcp --port 80 --cidr 0.0.0.0/0 \
  --protocol tcp --port 443 --cidr 0.0.0.0/0 \
  --protocol tcp --port 3000 --cidr 0.0.0.0/0

# TURN
aws ec2 create-security-group --group-name meeting-swiss-turn --description "TURN server" --vpc-id vpc-xxx

aws ec2 authorize-security-group-ingress --group-id sg-yyy \
  --protocol udp --port 3478 --cidr 0.0.0.0/0 \
  --protocol tcp --port 3478 --cidr 0.0.0.0/0
```

**4. Launch EC2 Instances**

```bash
# Web/SFU Server
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.large \
  --key-name my-key \
  --security-group-ids sg-xxx \
  --subnet-id subnet-xxx \
  --user-data file://setup-web.sh

# TURN Server
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.medium \
  --key-name my-key \
  --security-group-ids sg-yyy \
  --subnet-id subnet-xxx \
  --user-data file://setup-turn.sh
```

**5. Create RDS Database**

```bash
aws rds create-db-instance \
  --db-instance-identifier meeting-swiss-db \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --master-username admin \
  --master-user-password <STRONG_PASSWORD> \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxx
```

**6. Setup Load Balancer**

```bash
aws elbv2 create-load-balancer \
  --name meeting-swiss-lb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx

aws elbv2 create-target-group \
  --name meeting-swiss-targets \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxx

aws elbv2 register-targets \
  --target-group-arn arn:aws:elasticloadbalancing:... \
  --targets Id=i-xxx Id=i-yyy
```

### SSL Certificate (ACM)

```bash
aws acm request-certificate \
  --domain-name meeting.swiss \
  --domain-name "*.meeting.swiss" \
  --validation-method DNS
```

### Monitoring (CloudWatch)

```bash
# Create alarms
aws cloudwatch put-metric-alarm \
  --alarm-name meeting-swiss-cpu \
  --alarm-description "Alert when CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

## 4. Kubernetes Deployment

### Prerequisites

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### Deploy

```bash
# Create namespace
kubectl create namespace meeting-swiss

# Create secrets
kubectl create secret generic meeting-swiss-secrets \
  --from-literal=db-password=<PASSWORD> \
  --from-literal=turn-password=<PASSWORD> \
  -n meeting-swiss

# Deploy MySQL
helm install mysql bitnami/mysql \
  --set auth.rootPassword=<PASSWORD> \
  -n meeting-swiss

# Deploy SFU
kubectl apply -f k8s/sfu-deployment.yaml -n meeting-swiss

# Deploy Web
kubectl apply -f k8s/web-deployment.yaml -n meeting-swiss

# Deploy TURN
kubectl apply -f k8s/turn-deployment.yaml -n meeting-swiss

# Create service
kubectl apply -f k8s/service.yaml -n meeting-swiss
```

### Scaling

```bash
# Scale SFU
kubectl scale deployment sfu --replicas=3 -n meeting-swiss

# Auto-scaling
kubectl autoscale deployment sfu --min=2 --max=10 -n meeting-swiss
```

## 5. Monitoring & Maintenance

### Health Checks

```bash
# Check SFU health
curl http://localhost:3000/health

# Check database
mysql -h <HOST> -u admin -p -e "SELECT 1"

# Check TURN
turnutils_uclient -v turn.example.com
```

### Logs

```bash
# SFU logs
docker logs meeting-swiss-sfu

# Web logs
docker logs meeting-swiss-web

# System logs
journalctl -u docker -f
```

### Backups

```bash
# Database backup
mysqldump -h <HOST> -u admin -p meeting_swiss > backup.sql

# Restore
mysql -h <HOST> -u admin -p meeting_swiss < backup.sql

# S3 backup
aws s3 cp backup.sql s3://meeting-swiss-backups/
```

## 6. Performance Tuning

### SFU Optimization

```typescript
// Increase worker threads
const worker = await mediasoup.createWorker({
  logLevel: 'warn',
  logTags: ['rtp', 'rtcp', 'rtx', 'bwe'],
  rtcMinPort: 40000,
  rtcMaxPort: 49999,
  numWorkers: 4, // Use multiple workers
});
```

### WebRTC Optimization

```typescript
// Adaptive bitrate
const params = sender.getParameters();
params.encodings[0].maxBitrate = 2500000; // 2.5 Mbps
await sender.setParameters(params);
```

### Database Optimization

```sql
-- Add indexes
CREATE INDEX idx_room_id ON rooms(id);
CREATE INDEX idx_user_id ON users(id);
CREATE INDEX idx_created_at ON rooms(created_at);

-- Optimize queries
ANALYZE TABLE rooms;
ANALYZE TABLE users;
```

## 7. Troubleshooting

### Common Issues

**Issue: No video/audio**
- Check TURN server connectivity
- Verify firewall rules
- Check browser console for errors

**Issue: High latency**
- Check network conditions
- Reduce bitrate
- Use regional TURN servers

**Issue: Connection drops**
- Implement reconnection logic
- Check server logs
- Monitor network stability

### Debug Mode

```bash
# Enable verbose logging
DEBUG=* npm run dev

# WebRTC stats
navigator.mediaDevices.getUserMedia({video: true})
  .then(stream => {
    const pc = new RTCPeerConnection();
    pc.addTrack(stream.getVideoTracks()[0]);
    setInterval(() => {
      pc.getStats().then(report => console.log(report));
    }, 1000);
  });
```

## 8. Security Checklist

- [ ] Enable HTTPS/WSS
- [ ] Use strong passwords
- [ ] Enable database encryption
- [ ] Configure firewall rules
- [ ] Enable logging and monitoring
- [ ] Regular security updates
- [ ] DDoS protection (Cloudflare)
- [ ] Rate limiting
- [ ] Input validation
- [ ] CORS configuration

## 9. Cost Estimation

### Monthly Costs (100 concurrent users)

| Component | Cost |
|-----------|------|
| EC2 (SFU) | $50 |
| EC2 (TURN) | $30 |
| RDS (MySQL) | $30 |
| Bandwidth | $50 |
| **Total** | **$160** |

### Scaling to 1000 concurrent users

| Component | Cost |
|-----------|------|
| EC2 (SFU x5) | $250 |
| EC2 (TURN x3) | $90 |
| RDS (db.t3.small) | $100 |
| Bandwidth | $500 |
| Load Balancer | $20 |
| **Total** | **$960** |

## References

- [mediasoup Documentation](https://mediasoup.org/)
- [WebRTC Best Practices](https://www.html5rocks.com/en/tutorials/webrtc/basics/)
- [AWS Deployment Guide](https://docs.aws.amazon.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
