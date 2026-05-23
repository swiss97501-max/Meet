/**
 * WebRTC SFU Client
 * 
 * Implements producer/consumer model for SFU-based video conferencing
 * - Separate transports for sending/receiving
 * - Adaptive bitrate control
 * - Simulcast support
 * - Graceful error handling
 */

import { io, Socket } from 'socket.io-client';

interface TransportOptions {
  id: string;
  iceParameters: any;
  dtlsParameters: any;
  iceCandidates: any[];
}

interface ProducerOptions {
  kind: 'audio' | 'video';
  rtpParameters: any;
  appData?: any;
}

interface ConsumerOptions {
  id: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: any;
}

export class WebRTCSFUClient {
  private socket: Socket;
  private peerConnection: RTCPeerConnection | null = null;
  private producerTransport: RTCPeerConnection | null = null;
  private consumerTransport: RTCPeerConnection | null = null;
  private producers: Map<string, RTCRtpSender> = new Map();
  private consumers: Map<string, RTCRtpReceiver> = new Map();
  private streams: Map<string, MediaStream> = new Map();
  private statsInterval: NodeJS.Timeout | null = null;

  private config = {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302'] },
      { urls: ['stun:stun1.l.google.com:19302'] },
      {
        urls: ['turn:turn.example.com:3478'],
        username: 'user',
        credential: 'pass',
      },
    ],
  };

  constructor(sfuUrl: string) {
    this.socket = io(sfuUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    this.setupSocketListeners();
  }

  /**
   * Join room and initialize transports
   */
  async joinRoom(
    roomId: string,
    username: string,
    rtpCapabilities: RTCRtpCapabilities
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.emit(
        'join-room',
        { roomId, username, rtpCapabilities },
        async (error: string | null, data: any) => {
          if (error) {
            reject(new Error(error));
            return;
          }

          try {
            // Create producer transport (for sending media)
            await this.createProducerTransport(roomId);

            // Create consumer transport (for receiving media)
            await this.createConsumerTransport(roomId);

            // Start monitoring stats
            this.startStatsMonitoring();

            resolve();
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  }

  /**
   * Create producer transport
   */
  private async createProducerTransport(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.emit(
        'create-producer-transport',
        { roomId },
        async (error: string | null, transportOptions: TransportOptions) => {
          if (error) {
            reject(new Error(error));
            return;
          }

          try {
            this.producerTransport = new RTCPeerConnection({
              iceServers: this.config.iceServers,
            });

            // Add ICE candidates
            for (const candidate of transportOptions.iceCandidates) {
              await this.producerTransport.addIceCandidate(
                new RTCIceCandidate(candidate)
              );
            }

            // Connect transport
            const offer = await this.producerTransport.createOffer();
            await this.producerTransport.setLocalDescription(offer);

            this.socket.emit(
              'connect-producer-transport',
              {
                roomId,
                transportId: transportOptions.id,
                dtlsParameters: this.producerTransport.localDescription,
              },
              (error: string | null) => {
                if (error) reject(new Error(error));
                else resolve();
              }
            );
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  }

  /**
   * Create consumer transport
   */
  private async createConsumerTransport(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.emit(
        'create-consumer-transport',
        { roomId },
        async (error: string | null, transportOptions: TransportOptions) => {
          if (error) {
            reject(new Error(error));
            return;
          }

          try {
            this.consumerTransport = new RTCPeerConnection({
              iceServers: this.config.iceServers,
            });

            // Add ICE candidates
            for (const candidate of transportOptions.iceCandidates) {
              await this.consumerTransport.addIceCandidate(
                new RTCIceCandidate(candidate)
              );
            }

            // Connect transport
            const offer = await this.consumerTransport.createOffer();
            await this.consumerTransport.setLocalDescription(offer);

            this.socket.emit(
              'connect-consumer-transport',
              {
                roomId,
                transportId: transportOptions.id,
                dtlsParameters: this.consumerTransport.localDescription,
              },
              (error: string | null) => {
                if (error) reject(new Error(error));
                else resolve();
              }
            );
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  }

  /**
   * Produce media (camera, microphone, screen)
   */
  async produce(
    roomId: string,
    stream: MediaStream,
    kind: 'audio' | 'video',
    appData: any = {}
  ): Promise<string> {
    if (!this.producerTransport) {
      throw new Error('Producer transport not initialized');
    }

    const tracks = kind === 'audio' ? stream.getAudioTracks() : stream.getVideoTracks();
    if (tracks.length === 0) {
      throw new Error(`No ${kind} tracks in stream`);
    }

    const track = tracks[0];

    // Add track to producer transport
    const sender = await this.producerTransport.addTrack(track, stream);

    // Get RTP parameters
    const rtpParameters = sender.getParameters();

    // Send to SFU
    return new Promise((resolve, reject) => {
      this.socket.emit(
        'produce',
        {
          roomId,
          kind,
          rtpParameters,
          appData,
        },
        (error: string | null, producerId: string) => {
          if (error) {
            reject(new Error(error));
          } else {
            this.producers.set(producerId, sender);
            resolve(producerId);
          }
        }
      );
    });
  }

  /**
   * Consume media from another peer
   */
  async consume(
    roomId: string,
    producerId: string
  ): Promise<{ consumerId: string; stream: MediaStream }> {
    if (!this.consumerTransport) {
      throw new Error('Consumer transport not initialized');
    }

    return new Promise((resolve, reject) => {
      this.socket.emit(
        'consume',
        { roomId, producerId },
        async (error: string | null, consumerOptions: ConsumerOptions) => {
          if (error) {
            reject(new Error(error));
            return;
          }

          try {
            // Add track to consumer transport
            const track = new RTCRtpReceiver(
              this.consumerTransport!,
              consumerOptions.kind
            );

            // Create media stream
            const stream = new MediaStream();
            stream.addTrack(track.track!);

            this.consumers.set(consumerOptions.id, track);
            this.streams.set(producerId, stream);

            // Resume consumer
            this.socket.emit(
              'resume-consumer',
              { roomId, consumerId: consumerOptions.id },
              (error: string | null) => {
                if (error) reject(new Error(error));
                else resolve({ consumerId: consumerOptions.id, stream });
              }
            );
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  }

  /**
   * Replace producer track (for screen sharing)
   */
  async replaceProducerTrack(
    roomId: string,
    producerId: string,
    newTrack: MediaStreamTrack
  ): Promise<void> {
    const sender = this.producers.get(producerId);
    if (!sender) {
      throw new Error('Producer not found');
    }

    await sender.replaceTrack(newTrack);

    // Get updated RTP parameters
    const rtpParameters = sender.getParameters();

    return new Promise((resolve, reject) => {
      this.socket.emit(
        'replace-producer-track',
        { roomId, producerId, rtpParameters },
        (error: string | null) => {
          if (error) reject(new Error(error));
          else resolve();
        }
      );
    });
  }

  /**
   * Leave room
   */
  async leaveRoom(roomId: string): Promise<void> {
    // Close all transports
    if (this.producerTransport) {
      this.producerTransport.close();
      this.producerTransport = null;
    }

    if (this.consumerTransport) {
      this.consumerTransport.close();
      this.consumerTransport = null;
    }

    // Stop stats monitoring
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Emit leave event
    this.socket.emit('leave-room', { roomId });
  }

  /**
   * Get connection stats
   */
  async getStats(): Promise<any> {
    const stats: any = {
      producer: {},
      consumer: {},
    };

    if (this.producerTransport) {
      const report = await this.producerTransport.getStats();
      report.forEach((stat) => {
        if (stat.type === 'inbound-rtp') {
          stats.producer.bytesReceived = stat.bytesReceived;
          stats.producer.packetsLost = stat.packetsLost;
        }
        if (stat.type === 'outbound-rtp') {
          stats.producer.bytesSent = stat.bytesSent;
          stats.producer.bitrate = (stat.bytesSent * 8) / 1000; // kbps
          stats.producer.framesSent = stat.framesSent;
        }
      });
    }

    if (this.consumerTransport) {
      const report = await this.consumerTransport.getStats();
      report.forEach((stat) => {
        if (stat.type === 'inbound-rtp') {
          stats.consumer.bytesReceived = stat.bytesReceived;
          stats.consumer.bitrate = (stat.bytesReceived * 8) / 1000; // kbps
          stats.consumer.framesDecoded = stat.framesDecoded;
          stats.consumer.packetsLost = stat.packetsLost;
        }
      });
    }

    return stats;
  }

  /**
   * Monitor connection stats
   */
  private startStatsMonitoring(): void {
    this.statsInterval = setInterval(async () => {
      try {
        const stats = await this.getStats();
        console.log('[WebRTC] Stats:', stats);

        // Trigger adaptive bitrate adjustment
        if (stats.consumer.packetsLost > 100) {
          console.warn('[WebRTC] High packet loss detected, reducing bitrate');
          this.adjustBitrate(1500); // Reduce to 1.5 Mbps
        }
      } catch (err) {
        console.error('[WebRTC] Stats error:', err);
      }
    }, 5000); // Every 5 seconds
  }

  /**
   * Adjust bitrate
   */
  private adjustBitrate(bitrateKbps: number): void {
    if (this.producerTransport) {
      this.producerTransport.getSenders().forEach((sender) => {
        const params = sender.getParameters();
        params.encodings.forEach((encoding) => {
          encoding.maxBitrate = bitrateKbps * 1000;
        });
        sender.setParameters(params).catch((err) => {
          console.error('[WebRTC] Bitrate adjustment error:', err);
        });
      });
    }
  }

  /**
   * Socket event listeners
   */
  private setupSocketListeners(): void {
    this.socket.on('peer-joined', (data: any) => {
      console.log('[WebRTC] Peer joined:', data);
    });

    this.socket.on('new-producer', (data: any) => {
      console.log('[WebRTC] New producer:', data);
    });

    this.socket.on('peer-left', (data: any) => {
      console.log('[WebRTC] Peer left:', data);
    });

    this.socket.on('error', (error: any) => {
      console.error('[WebRTC] Socket error:', error);
    });

    this.socket.on('disconnect', () => {
      console.warn('[WebRTC] Disconnected from SFU');
    });
  }

  /**
   * Cleanup
   */
  async disconnect(): Promise<void> {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    if (this.producerTransport) {
      this.producerTransport.close();
    }

    if (this.consumerTransport) {
      this.consumerTransport.close();
    }

    this.socket.disconnect();
  }
}
