import { ChangeDetectorRef, Component, inject, signal, effect, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { SrcObjectDirective } from './src-object.directive';
import { environment } from 'src/environments/environment';
import { io, Socket } from 'socket.io-client';

interface PeerDetail {
  id: string;
  displayName: string;
  stream: MediaStream;
  isHandRaised?: boolean;
  isCameraOn?: boolean;
  isMicOn?: boolean;
  isProf?: boolean;
}

@Component({
  selector: 'app-live-session',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, SrcObjectDirective],
  templateUrl: './live-session.component.html',
  styleUrls: ['./live-session.component.scss']
})
export class LiveSessionComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private cd = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  // Session state: 'lobby' | 'live'
  sessionState = signal<'lobby' | 'live'>('lobby');

  // Lobby form
  sessionName = '';
  displayName = '';
  enableAudio = true;
  enableVideo = true;

  // Live session metadata
  roomId = signal('');
  shareLink = signal('');
  copied = signal(false);
  isProf = signal(false);

  // Custom WebRTC Media Streams
  localStream: MediaStream | null = null;
  peers = new Map<
    string,
    {
      connection: RTCPeerConnection;
      stream: MediaStream;
      displayName: string;
      isHandRaised?: boolean;
      isCameraOn?: boolean;
      isMicOn?: boolean;
      isProf?: boolean;
    }
  >();
  peerList = signal<PeerDetail[]>([]);

  // Unique client ID for signaling
  clientId = (() => {
    let id = sessionStorage.getItem('live_session_client_id');
    if (!id) {
      if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
        id = 'user_' + window.crypto.randomUUID().substring(0, 8);
      } else {
        const rand = new Uint32Array(1);
        window.crypto.getRandomValues(rand);
        id = 'user_' + rand[0].toString(36);
      }
      sessionStorage.setItem('live_session_client_id', id);
    }
    return id;
  })();
  private ws: WebSocket | null = null;

  // RTC configuration with public STUN servers
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // Recent Session History
  recentSessions: { name: string; roomId: string; date: Date }[] = [];

  showGuestNamePrompt = signal(false);
  mediaWarning = signal('');

  // Scheduling properties
  scheduledMeetings: any[] = [];
  showScheduleForm = signal(false);
  
  newMeetingTitle = '';
  newMeetingTime = '';
  newMeetingDuration = 60;

  // Email Sharing & CSV Scanning properties (Backend SMTP)
  showEmailModal = signal(false);
  emailTargetMeeting = signal<any>(null);
  singleRecipientInput = signal('');
  recipientList = signal<string[]>([]);
  isSendingEmail = signal(false);
  emailSendStatus = signal<{ success?: boolean; message?: string } | null>(null);
  csvImportMessage = signal('');

  screenStream: MediaStream | null = null;
  isScreenSharing = false;

  // Chat Panel properties
  chatMessages: { senderName: string; text: string; time: string; isMe: boolean }[] = [];
  showChatPanel = signal(false);
  unreadChatCount = signal(0);
  chatInput = '';

  // Hand raising properties
  isHandRaised = false;

  // Host Controls properties (Professor settings)
  isRoomLocked = false;
  chatRestricted = false;
  screenShareRestricted = false;
  cameraRestricted = false;
  micRestricted = false;
  showHostPanel = signal(false);

  // Custom Confirmation Modal properties
  showConfirmModal = false;
  confirmModalTitle = '';
  confirmModalMessage = '';
  private confirmCallback: (() => void) | null = null;
  private warningTimeout: any = null;

  // Quiz & Game Session properties
  private socket: Socket | null = null;
  socketSessionId: number | null = null;
  showQuizPanel = signal(false);
  quizActiveTab = signal<'questions' | 'leaderboard' | 'debriefing'>('questions');
  modulesList = signal<any[]>([]);
  selectedModuleId: number | null = null;
  currentQuiz: any = null;
  quizState = signal<'inactive' | 'waiting' | 'active_question' | 'leaderboard' | 'ended'>('inactive');
  quizParticipants = signal<any[]>([]);
  activeQuestion = signal<any | null>(null);
  quizTimer = signal<number>(0);
  quizTimerInterval: any = null;
  selectedAnswer = signal<string | null>(null);
  hasSubmittedAnswer = signal(false);
  answerResult = signal<any | null>(null);
  quizLeaderboard = signal<any[]>([]);
  quizDebriefing = signal<string[]>([]);
  quizAnimateur = signal<string>('');
  quizParticipantRules = signal<string>('');
  quizTitle = signal<string>('');
  activeQuestionIndex = signal<number>(0);
  isGeneratingQuiz = signal(false);

  pendingAnswerResult = signal<any | null>(null);
  private autoProgressionTimeout1: any = null;
  private autoProgressionTimeout2: any = null;

  constructor() {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.displayName = user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.username;
      this.isProf.set(user.role === 'prof');
      this.enableAudio = true;
      this.enableVideo = true;
    } else {
      const savedName = localStorage.getItem('live_session_guest_name');
      if (savedName) {
        this.displayName = savedName;
      }
      // For invited guests: microphone and camera are disabled by default
      this.enableAudio = false;
      this.enableVideo = false;
    }

    // Auto-clear warnings after 4 seconds
    effect(() => {
      const warning = this.mediaWarning();
      if (warning) {
        if (this.warningTimeout) {
          clearTimeout(this.warningTimeout);
        }
        this.warningTimeout = setTimeout(() => {
          this.mediaWarning.set('');
          this.cd.detectChanges();
        }, 4000);
      }
    });
  }

  ngOnInit(): void {
    // Check if joining via a shared link (?room=xxx)
    this.route.queryParams.subscribe(params => {
      const roomFromUrl = params['room'];
      const savedSession = localStorage.getItem('active_live_session');
      let activeRoomId = '';
      if (savedSession) {
        activeRoomId = JSON.parse(savedSession).roomId;
      }

      if (roomFromUrl) {
        // If the URL room is different from the saved session, clear/override the saved session
        if (roomFromUrl !== activeRoomId) {
          localStorage.removeItem('active_live_session');
          this.cleanupSession();
          this.sessionState.set('lobby');
        }

        this.roomId.set(roomFromUrl);
        if (this.sessionState() === 'lobby') {
          // Check if user is logged in
          if (this.authService.isLoggedIn()) {
            this.joinSession(roomFromUrl);
          } else {
            // Show display name prompt for guests, unless they are refreshing/reconnecting the same session
            if (this.displayName && this.displayName.trim() && roomFromUrl === activeRoomId) {
              this.showGuestNamePrompt.set(false);
              this.joinSession(roomFromUrl);
            } else {
              this.showGuestNamePrompt.set(true);
            }
          }
        }
      } else {
        // No room in URL, try to restore saved session
        if (savedSession) {
          const session = JSON.parse(savedSession);
          this.roomId.set(session.roomId);
          this.sessionName = session.name;
          this.shareLink.set(this.buildShareLink(session.roomId));
          
          // Auto-start restored session media & signaling
          this.initializeWebRTCSession();
        }
      }
    });

    if (this.authService.isLoggedIn()) {
      this.loadScheduledMeetings();
      this.loadModulesList();
    }
  }

  private buildShareLink(room: string): string {
    return `${window.location.origin}/live-session?room=${room}`;
  }

  async joinAsGuest(): Promise<void> {
    if (this.displayName.trim()) {
      localStorage.setItem('live_session_guest_name', this.displayName.trim());
      this.showGuestNamePrompt.set(false);
      await this.joinSession(this.roomId());
    }
  }

  ngOnDestroy(): void {
    this.cleanupSession();
  }

  generateRoomId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const segments = [];
    const randBuffer = new Uint32Array(12);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(randBuffer);
    }
    let bufIndex = 0;
    for (let i = 0; i < 3; i++) {
      let segment = '';
      for (let j = 0; j < 4; j++) {
        const randVal = randBuffer[bufIndex++] || Math.floor(Math.random() * 10000);
        segment += chars.charAt(randVal % chars.length);
      }
      segments.push(segment);
    }
    return segments.join('-');
  }

  async startSession(): Promise<void> {
    if (!this.sessionName.trim()) {
      this.sessionName = 'Séance pédagogique';
    }

    const room = this.generateRoomId();

    try {
      // Create live session in the database
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/api/live/session`, {
          room_id: room,
          name: this.sessionName
        })
      );
    } catch (err: any) {
      console.error('Failed to create live session in database:', err);
      this.mediaWarning.set(err.error?.detail || 'Erreur serveur: impossible de créer la séance en base de données.');
      this.cd.detectChanges();
      return;
    }

    this.roomId.set(room);
    this.shareLink.set(this.buildShareLink(room));

    // Save active session metadata to localStorage
    localStorage.setItem('active_live_session', JSON.stringify({
      roomId: room,
      name: this.sessionName,
      shareLink: this.buildShareLink(room)
    }));

    // Add to history
    this.recentSessions.unshift({
      name: this.sessionName,
      roomId: room,
      date: new Date()
    });
    if (this.recentSessions.length > 5) {
      this.recentSessions.pop();
    }

    await this.initializeWebRTCSession();
  }

  async joinSession(roomId: string): Promise<void> {
    this.roomId.set(roomId);
    this.sessionName = 'Séance rejointe';
    this.shareLink.set(this.buildShareLink(roomId));

    localStorage.setItem('active_live_session', JSON.stringify({
      roomId: roomId,
      name: this.sessionName,
      shareLink: this.buildShareLink(roomId)
    }));

    await this.initializeWebRTCSession();
  }

  joinRoomId = '';

  joinExistingSession(): void {
    if (this.joinRoomId.trim()) {
      this.joinSession(this.joinRoomId.trim());
    }
  }

  // ========== WebRTC & SIGNALING ENGINE ==========

  private async initializeWebRTCSession(): Promise<void> {
    this.sessionState.set('live');
    this.showChatPanel.set(true);
    this.unreadChatCount.set(0);
    this.mediaWarning.set('');
    this.cd.detectChanges();

    try {
      // 1. Get user camera and microphone with graceful fallback
      try {
        // Always request both video and audio to get the tracks ready
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        // Apply initial lobby preferences to tracks
        if (this.localStream) {
          this.localStream.getAudioTracks().forEach(track => {
            track.enabled = this.enableAudio;
          });
          this.localStream.getVideoTracks().forEach(track => {
            track.enabled = this.enableVideo;
          });
        }
      } catch (mediaErr: any) {
        console.warn('Failed to acquire video and audio stream. Attempting fallback...', mediaErr);
        
        if (this.enableVideo) {
          // Fallback 1: Try audio only
          this.enableVideo = false;
          try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: true
            });
            
            // Apply audio preference to fallback stream
            if (this.localStream) {
              this.localStream.getAudioTracks().forEach(track => {
                track.enabled = this.enableAudio;
              });
            }
            this.mediaWarning.set("Impossible de démarrer la caméra (déjà utilisée par un autre programme ou bloquée). Connexion établie en audio uniquement.");
          } catch (audioErr: any) {
            console.warn('Failed to acquire audio-only stream. Attempting no-media fallback...', audioErr);
            // Fallback 2: Try no media (viewer only)
            this.enableAudio = false;
            this.localStream = null;
            this.mediaWarning.set("Impossible d'accéder à la caméra ou au microphone. Connexion établie en mode spectateur uniquement.");
          }
        } else if (this.enableAudio) {
          // If video was already disabled, try no media (viewer only)
          this.enableAudio = false;
          this.localStream = null;
          this.mediaWarning.set("Impossible d'accéder au microphone. Connexion établie en mode spectateur uniquement.");
        } else {
          this.localStream = null;
        }
      }

      // Render local user stream in local video tag
      const localVideoElement = document.getElementById('localVideo') as HTMLVideoElement;
      if (localVideoElement) {
        localVideoElement.srcObject = this.localStream;
      }

      // 2. Connect to WebSocket Signaling Server
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = environment.apiUrl.replace(/^https?:\/\//, '');
      
      const currentUser = this.authService.getCurrentUser();
      const role = currentUser ? (currentUser.role === 'prof' ? 'prof' : 'student') : 'guest';
      const userId = currentUser ? currentUser.id : '';
      
      let wsUrl = `${protocol}//${host}/api/live/ws/${this.roomId()}/${this.clientId}?name=${encodeURIComponent(this.displayName || 'Invité')}&role=${role}`;
      if (userId) {
        wsUrl += `&user_id=${userId}`;
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Send introduction packet
        this.sendSignalingMessage('introduce', null, { 
          displayName: this.displayName || 'Invité',
          isCameraOn: this.enableVideo || this.isScreenSharing,
          isMicOn: this.enableAudio,
          isProf: this.isProf()
        });
      };

      this.ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        const { type, senderId, payload } = message;

        switch (type) {
          case 'error':
            console.error('Signaling connection error:', message.message);
            this.mediaWarning.set(message.message || 'Erreur de connexion.');
            this.cleanupSession();
            localStorage.removeItem('active_live_session');
            this.sessionState.set('lobby');
            
            if (this.roomId() && !this.authService.isLoggedIn()) {
              this.showGuestNamePrompt.set(true);
            }
            
            this.cd.detectChanges();
            break;

          case 'chat':
            this.handleChatMessage(senderId, payload);
            break;

          case 'raise-hand':
            this.handleRaiseHand(senderId, payload.raised);
            break;

          case 'force-mute':
            // Students/guests mute locally when requested
            this.enableAudio = false;
            if (this.localStream) {
              this.localStream.getAudioTracks().forEach((track: MediaStreamTrack) => {
                track.enabled = false;
              });
            }
            this.mediaWarning.set("Votre micro a été coupé par l'organisateur.");
            this.broadcastMediaState();
            this.cd.detectChanges();
            break;

          case 'kick-participant':
            // Kick participant and show a warning in the lobby
            this.cleanupSession();
            localStorage.removeItem('active_live_session');
            this.sessionState.set('lobby');
            this.mediaWarning.set("Vous avez été retiré de la séance par l'organisateur.");
            this.cd.detectChanges();
            break;

          case 'restrict-chat':
            this.chatRestricted = payload.restricted;
            if (payload.restricted) {
              this.mediaWarning.set("L'utilisation du chat a été désactivée pour les étudiants.");
            } else {
              this.mediaWarning.set("L'utilisation du chat a été réactivée pour les étudiants.");
            }
            this.cd.detectChanges();
            break;

          case 'restrict-screen':
            this.screenShareRestricted = payload.restricted;
            if (payload.restricted) {
              if (this.isScreenSharing) {
                this.stopScreenShare();
              }
              this.mediaWarning.set("Le partage d'écran a été désactivé pour les étudiants.");
            } else {
              this.mediaWarning.set("Le partage d'écran a été réactivé pour les étudiants.");
            }
            this.cd.detectChanges();
            break;

          case 'room-locked':
            this.isRoomLocked = payload.locked;
            if (payload.locked) {
              this.mediaWarning.set("La séance a été verrouillée. Aucun nouveau participant ne peut rejoindre.");
            } else {
              this.mediaWarning.set("La séance a été déverrouillée.");
            }
            this.cd.detectChanges();
            break;

          case 'end-call-everyone':
            this.cleanupSession();
            localStorage.removeItem('active_live_session');
            this.sessionState.set('lobby');
            this.mediaWarning.set("La séance a été terminée par l'organisateur.");
            this.cd.detectChanges();
            break;

          case 'force-video-off':
            this.enableVideo = false;
            if (this.localStream) {
              this.localStream.getVideoTracks().forEach((track: MediaStreamTrack) => {
                track.enabled = false;
              });
            }
            this.mediaWarning.set("Votre caméra a été coupée par l'organisateur.");
            this.broadcastMediaState();
            this.cd.detectChanges();
            break;

          case 'restrict-camera':
            this.cameraRestricted = payload.restricted;
            if (payload.restricted) {
              this.enableVideo = false;
              if (this.localStream) {
                this.localStream.getVideoTracks().forEach((track: MediaStreamTrack) => {
                  track.enabled = false;
                });
              }
              this.mediaWarning.set("L'organisateur a désactivé les caméras pour les participants.");
            } else {
              this.mediaWarning.set("L'organisateur a réautorisé les caméras pour les participants.");
            }
            this.broadcastMediaState();
            this.cd.detectChanges();
            break;

          case 'restrict-mic':
            this.micRestricted = payload.restricted;
            if (payload.restricted) {
              this.enableAudio = false;
              if (this.localStream) {
                this.localStream.getAudioTracks().forEach((track: MediaStreamTrack) => {
                  track.enabled = false;
                });
              }
              this.mediaWarning.set("L'organisateur a désactivé les micros pour les participants.");
            } else {
              this.mediaWarning.set("L'organisateur a réautorisé les micros pour les participants.");
            }
            this.broadcastMediaState();
            this.cd.detectChanges();
            break;

          case 'peer-joined':
            // New client joined, send introduction so they know who we are
            this.sendSignalingMessage('introduce', senderId, { 
              displayName: this.displayName || 'Invité',
              isHandRaised: this.isHandRaised,
              isRoomLocked: this.isRoomLocked,
              chatRestricted: this.chatRestricted,
              screenShareRestricted: this.screenShareRestricted,
              cameraRestricted: this.cameraRestricted,
              micRestricted: this.micRestricted,
              isCameraOn: this.enableVideo || this.isScreenSharing,
              isMicOn: this.enableAudio,
              isProf: this.isProf()
            });
            // Initiator setup (smaller ID initiates to resolve glare)
            if (this.clientId < senderId) {
              await this.initiatePeerConnection(senderId, payload?.displayName || 'Peer');
            }
            break;

          case 'introduce':
            // Store peer name info
            if (payload && payload.displayName) {
              const peer = this.peers.get(senderId);
              if (peer) {
                peer.displayName = payload.displayName;
                peer.isHandRaised = payload.isHandRaised || false;
                peer.isCameraOn = payload.isCameraOn !== false;
                peer.isMicOn = payload.isMicOn !== false;
                peer.isProf = payload.isProf || false;
                this.updatePeerListSignal();
              } else {
                // Pre-register peer entry with a MediaStream to show in list immediately
                this.peers.set(senderId, {
                  connection: null as any,
                  stream: new MediaStream(),
                  displayName: payload.displayName,
                  isHandRaised: payload.isHandRaised || false,
                  isCameraOn: payload.isCameraOn !== false,
                  isMicOn: payload.isMicOn !== false,
                  isProf: payload.isProf || false
                });
                this.updatePeerListSignal();
              }

              // Apply host restrictions if sent (only for students/guests)
              if (!this.isProf()) {
                if (payload.chatRestricted !== undefined) {
                  this.chatRestricted = payload.chatRestricted;
                }
                if (payload.screenShareRestricted !== undefined) {
                  this.screenShareRestricted = payload.screenShareRestricted;
                  if (this.screenShareRestricted && this.isScreenSharing) {
                    this.stopScreenShare();
                  }
                }
                if (payload.cameraRestricted !== undefined) {
                  this.cameraRestricted = payload.cameraRestricted;
                  if (this.cameraRestricted) {
                    this.enableVideo = false;
                    if (this.localStream) {
                      this.localStream.getVideoTracks().forEach((track: MediaStreamTrack) => track.enabled = false);
                    }
                  }
                }
                if (payload.micRestricted !== undefined) {
                  this.micRestricted = payload.micRestricted;
                  if (this.micRestricted) {
                    this.enableAudio = false;
                    if (this.localStream) {
                      this.localStream.getAudioTracks().forEach((track: MediaStreamTrack) => track.enabled = false);
                    }
                  }
                }
              }
              if (payload.isRoomLocked !== undefined) {
                this.isRoomLocked = payload.isRoomLocked;
              }
            }
            break;

          case 'track-toggle':
            if (payload) {
              const peer = this.peers.get(senderId);
              if (peer) {
                if (payload.video !== undefined) {
                  peer.isCameraOn = payload.video;
                }
                if (payload.audio !== undefined) {
                  peer.isMicOn = payload.audio;
                }
                this.updatePeerListSignal();
              }
            }
            break;

          case 'offer':
            await this.handleOfferMessage(senderId, payload);
            break;

          case 'answer':
            await this.handleAnswerMessage(senderId, payload);
            break;

          case 'ice-candidate':
            await this.handleIceCandidateMessage(senderId, payload);
            break;

          case 'peer-left':
            this.removePeer(senderId);
            break;
        }
      };

      this.ws.onerror = (err) => {
        console.error('Signaling WebSocket error:', err);
      };

      this.ws.onclose = () => {
        console.log('Signaling WebSocket closed.');
      };

      // 3. Connect to Socket.io Quiz Server
      this.initializeSocketIoConnection();

    } catch (err) {
      console.error('Failed to acquire media devices or connect to websocket:', err);
      this.cleanupSession();
    }
  }

  private sendSignalingMessage(type: string, targetId: string | null, payload: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type,
        targetId,
        payload
      }));
    }
  }

  private async initiatePeerConnection(peerId: string, peerName: string): Promise<void> {
    const peerConnection = new RTCPeerConnection(this.rtcConfig);
    
    // Reuse existing stream if pre-registered to keep video element bindings intact
    const existing = this.peers.get(peerId);
    const peerStream = existing && existing.stream ? existing.stream : new MediaStream();
    const isHandRaised = existing ? existing.isHandRaised : false;
    const isCameraOn = existing ? existing.isCameraOn : true;
    const isMicOn = existing ? existing.isMicOn : true;

    // Store peer structure
    this.peers.set(peerId, {
      connection: peerConnection,
      stream: peerStream,
      displayName: peerName,
      isHandRaised,
      isCameraOn,
      isMicOn
    });

    // Add local tracks to peer connection
    this.addLocalTracksToConnection(peerConnection);

    // Handle remote tracks joining
    peerConnection.ontrack = (event) => {
      if (!peerStream.getTracks().includes(event.track)) {
        peerStream.addTrack(event.track);
      }
      this.updatePeerListSignal();
    };

    // Gather and send ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage('ice-candidate', peerId, event.candidate);
      }
    };

    // Create SDP offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    this.sendSignalingMessage('offer', peerId, offer);

    this.updatePeerListSignal();
  }

  private async handleOfferMessage(peerId: string, sdpOffer: RTCSessionDescriptionInit): Promise<void> {
    // Reuse existing stream if pre-registered to keep video element bindings intact
    const existing = this.peers.get(peerId);
    const peerStream = existing && existing.stream ? existing.stream : new MediaStream();
    const peerName = existing ? existing.displayName : 'Participant';
    const isHandRaised = existing ? existing.isHandRaised : false;
    const isCameraOn = existing ? existing.isCameraOn : true;
    const isMicOn = existing ? existing.isMicOn : true;

    // Reuse existing connection for renegotiation, create new one only if needed
    let peerConnection: RTCPeerConnection;
    if (existing && existing.connection && existing.connection.signalingState !== 'closed') {
      peerConnection = existing.connection;
    } else {
      peerConnection = new RTCPeerConnection(this.rtcConfig);

      // Add local tracks only for new connections
      this.addLocalTracksToConnection(peerConnection);

      // Receive remote tracks
      peerConnection.ontrack = (event) => {
        if (!peerStream.getTracks().includes(event.track)) {
          peerStream.addTrack(event.track);
        }
        this.updatePeerListSignal();
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignalingMessage('ice-candidate', peerId, event.candidate);
        }
      };
    }

    this.peers.set(peerId, {
      connection: peerConnection,
      stream: peerStream,
      displayName: peerName,
      isHandRaised,
      isCameraOn,
      isMicOn
    });

    // Set remote offer & generate answer
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdpOffer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    this.sendSignalingMessage('answer', peerId, answer);

    this.updatePeerListSignal();
  }

  private async handleAnswerMessage(peerId: string, sdpAnswer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peers.get(peerId);
    if (peer && peer.connection) {
      await peer.connection.setRemoteDescription(new RTCSessionDescription(sdpAnswer));
    }
  }

  private async handleIceCandidateMessage(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.peers.get(peerId);
    if (peer && peer.connection) {
      try {
        await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding ICE candidate:', e);
      }
    }
  }

  private createDummyVideoTrack(): MediaStreamTrack {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const stream = (canvas as any).captureStream ? (canvas as any).captureStream(1) : null;
    if (stream && stream.getVideoTracks().length > 0) {
      const track = stream.getVideoTracks()[0];
      track.enabled = false;
      return track;
    }
    return null as any;
  }

  private addLocalTracksToConnection(peerConnection: RTCPeerConnection): void {
    const audioTrack = this.localStream ? this.localStream.getAudioTracks()[0] : null;
    const cameraVideoTrack = this.localStream ? this.localStream.getVideoTracks()[0] : null;

    let videoTrack = this.isScreenSharing && this.screenStream
      ? this.screenStream.getVideoTracks()[0]
      : cameraVideoTrack;

    if (!videoTrack) {
      videoTrack = this.createDummyVideoTrack();
    }

    // Always use a placeholder stream for addTrack if localStream is null
    const refStream = this.localStream || new MediaStream();

    if (audioTrack) {
      peerConnection.addTrack(audioTrack, refStream);
    }
    if (videoTrack) {
      peerConnection.addTrack(videoTrack, refStream);
    }
  }

  private removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      if (peer.connection) {
        peer.connection.close();
      }
      this.peers.delete(peerId);
      this.updatePeerListSignal();
    }
  }

  private updatePeerListSignal(): void {
    const list: PeerDetail[] = [];
    this.peers.forEach((val, key) => {
      list.push({
        id: key,
        displayName: val.displayName,
        stream: val.stream,
        isHandRaised: val.isHandRaised,
        isCameraOn: val.isCameraOn,
        isMicOn: val.isMicOn,
        isProf: val.isProf
      });
    });
    this.peerList.set(list);
    this.cd.detectChanges();
  }

  hasVideo(stream: MediaStream | null): boolean {
    if (!stream) return false;
    const tracks = stream.getVideoTracks();
    return tracks.length > 0 && tracks[0].enabled && tracks[0].readyState === 'live';
  }

  broadcastMediaState(): void {
    this.sendSignalingMessage('track-toggle', null, { 
      video: this.enableVideo || this.isScreenSharing, 
      audio: this.enableAudio 
    });
  }

  async toggleMic(): Promise<void> {
    if (this.micRestricted && !this.enableAudio && !this.isProf()) {
      this.mediaWarning.set("Le microphone a été bloqué par l'organisateur.");
      this.cd.detectChanges();
      return;
    }
    
    const targetState = !this.enableAudio;
    
    if (targetState) {
      let audioTrack = this.localStream ? this.localStream.getAudioTracks()[0] : null;
      
      if (!audioTrack || audioTrack.readyState === 'ended') {
        try {
          const userMedia = await navigator.mediaDevices.getUserMedia({ audio: true });
          const newTrack = userMedia.getAudioTracks()[0];
          
          if (!this.localStream) {
            this.localStream = new MediaStream();
          }
          
          this.localStream.getAudioTracks().forEach(t => this.localStream!.removeTrack(t));
          this.localStream.addTrack(newTrack);
          audioTrack = newTrack;
        } catch (err) {
          console.error("Failed to acquire microphone:", err);
          this.mediaWarning.set("Impossible d'accéder au microphone. Veuillez vérifier les permissions.");
          this.cd.detectChanges();
          return;
        }
      }
      
      if (audioTrack) {
        audioTrack.enabled = true;
        
        // Replace the audio track on all peer connections so remote peers hear the mic
        for (const [peerId, peer] of this.peers.entries()) {
          if (peer.connection) {
            const senders = peer.connection.getSenders();
            let audioSender = senders.find(s => s.track && s.track.kind === 'audio');
            if (!audioSender) {
              audioSender = senders.find(s => !s.track);
            }
            if (audioSender) {
              await audioSender.replaceTrack(audioTrack);
            } else {
              // No audio sender exists — add the track and renegotiate
              peer.connection.addTrack(audioTrack, this.localStream!);
              try {
                const offer = await peer.connection.createOffer();
                await peer.connection.setLocalDescription(offer);
                this.sendSignalingMessage('offer', peerId, offer);
              } catch (e) {
                console.error('Renegotiation failed after adding audio track:', e);
              }
            }
          }
        }
      }
    } else {
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
    }
    
    this.enableAudio = targetState;
    this.broadcastMediaState();
    this.cd.detectChanges();
  }

  async toggleVideo(): Promise<void> {
    if (this.cameraRestricted && !this.enableVideo && !this.isProf()) {
      this.mediaWarning.set("La caméra a été bloquée par l'organisateur.");
      this.cd.detectChanges();
      return;
    }
    
    const targetState = !this.enableVideo;
    
    if (targetState) {
      let cameraTrack = this.localStream ? this.localStream.getVideoTracks()[0] : null;
      
      if (!cameraTrack || cameraTrack.readyState === 'ended') {
        try {
          const userMedia = await navigator.mediaDevices.getUserMedia({ video: true });
          const newTrack = userMedia.getVideoTracks()[0];
          
          if (!this.localStream) {
            this.localStream = new MediaStream();
          }
          
          this.localStream.getVideoTracks().forEach(t => this.localStream!.removeTrack(t));
          this.localStream.addTrack(newTrack);
          cameraTrack = newTrack;
          
          const localVideoElement = document.getElementById('localVideo') as HTMLVideoElement;
          if (localVideoElement) {
            localVideoElement.srcObject = this.localStream;
          }
        } catch (err) {
          console.error("Failed to acquire camera:", err);
          this.mediaWarning.set("Impossible d'accéder à la caméra. Veuillez vérifier les permissions.");
          this.cd.detectChanges();
          return;
        }
      }
      
      if (cameraTrack) {
        cameraTrack.enabled = true;
        
        // Replace the video track on all peer connections so remote peers see the camera
        for (const [peerId, peer] of this.peers.entries()) {
          if (peer.connection) {
            const senders = peer.connection.getSenders();
            let videoSender = senders.find(s => s.track && s.track.kind === 'video');
            if (!videoSender) {
              // Also check for senders with no track (dummy placeholder)
              videoSender = senders.find(s => !s.track);
            }
            if (videoSender) {
              await videoSender.replaceTrack(cameraTrack);
            } else {
              // No video sender exists at all — add the track and renegotiate
              // so the remote peer learns about the new video track
              peer.connection.addTrack(cameraTrack, this.localStream!);
              try {
                const offer = await peer.connection.createOffer();
                await peer.connection.setLocalDescription(offer);
                this.sendSignalingMessage('offer', peerId, offer);
              } catch (e) {
                console.error('Renegotiation failed after adding video track:', e);
              }
            }
          }
        }
      }
    } else {
      if (this.localStream) {
        this.localStream.getVideoTracks().forEach(track => {
          track.enabled = false;
        });
      }
    }
    
    this.enableVideo = targetState;
    this.broadcastMediaState();
    this.cd.detectChanges();
  }

  async toggleScreenShare(): Promise<void> {
    if (this.screenShareRestricted && !this.isScreenSharing && !this.isProf()) {
      this.mediaWarning.set("Le partage d'écran a été bloqué par l'organisateur.");
      this.cd.detectChanges();
      return;
    }
    if (this.isScreenSharing) {
      this.stopScreenShare();
    } else {
      await this.startScreenShare();
    }
  }

  async startScreenShare(): Promise<void> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false // Video-only display capture to prevent local feedback loops
      });

      this.isScreenSharing = true;
      this.cd.detectChanges();

      const screenTrack = this.screenStream.getVideoTracks()[0];

      // Update local preview
      const localVideoElement = document.getElementById('localVideo') as HTMLVideoElement;
      if (localVideoElement) {
        localVideoElement.srcObject = this.screenStream;
      }

      // Replace video track in all active peer connections
      this.peers.forEach(peer => {
        if (peer.connection) {
          const senders = peer.connection.getSenders();
          // Find video sender: check track kind, or fall back to sender without a track
          let videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (!videoSender) {
            videoSender = senders.find(s => !s.track);
          }
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          } else {
            // No sender at all — add the track directly
            peer.connection.addTrack(screenTrack);
          }
        }
      });

      this.broadcastMediaState();

      // Handle screen sharing ended via the browser's native bar
      screenTrack.onended = () => {
        this.stopScreenShare();
      };

    } catch (err) {
      console.error('Failed to start screen share:', err);
      this.isScreenSharing = false;
      this.cd.detectChanges();
    }
  }

  stopScreenShare(): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      this.screenStream = null;
    }

    this.isScreenSharing = false;
    this.cd.detectChanges();

    // Recover camera track
    const cameraTrack = this.localStream ? this.localStream.getVideoTracks()[0] : null;

    // Restore local preview
    const localVideoElement = document.getElementById('localVideo') as HTMLVideoElement;
    if (localVideoElement) {
      localVideoElement.srcObject = this.localStream;
    }

    // Replace track back in all active peer connections
    this.peers.forEach(peer => {
      if (peer.connection) {
        const senders = peer.connection.getSenders();
        let videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (!videoSender) {
          videoSender = senders.find(s => !s.track);
        }
        if (videoSender) {
          videoSender.replaceTrack(cameraTrack);
        }
      }
    });

    this.broadcastMediaState();
  }

  // ========== CLEANUP AND SHUTDOWN ==========

  private cleanupSession(): void {
    // Clear Host Controls state
    this.isRoomLocked = false;
    this.chatRestricted = false;
    this.screenShareRestricted = false;
    this.cameraRestricted = false;
    this.micRestricted = false;
    this.showHostPanel.set(false);

    // Clear Hand raising state
    this.isHandRaised = false;

    // Clear Chat Panel state
    this.chatMessages = [];
    this.unreadChatCount.set(0);
    this.showChatPanel.set(false);
    this.chatInput = '';

    // Stop screen sharing if active
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      this.screenStream = null;
    }
    this.isScreenSharing = false;

    // Stop local camera/mic
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close all peer connections
    this.peers.forEach(peer => {
      if (peer.connection) {
        peer.connection.close();
      }
    });
    this.peers.clear();
    this.peerList.set([]);

    // Close websocket connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Close Socket.io connection
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.resetQuizStateCompletely();
  }

  endSession(): void {
    this.cleanupSession();
    localStorage.removeItem('active_live_session');
    localStorage.removeItem('live_session_guest_name');
    this.sessionState.set('lobby');
    this.cd.detectChanges();
  }

  leaveSessionOnly(): void {
    this.openConfirmModal(
      "Quitter la séance",
      "Voulez-vous quitter la session ? Elle restera active pour les étudiants.",
      () => {
        this.cleanupSession();
        localStorage.removeItem('active_live_session');
        localStorage.removeItem('live_session_guest_name');
        this.sessionState.set('lobby');
        this.cd.detectChanges();
      }
    );
  }

  endSessionForEveryone(): void {
    this.openConfirmModal(
      "Terminer pour tous",
      "Voulez-vous vraiment terminer la séance pour tous les participants ?",
      () => {
        this.endCallForEveryone();
      }
    );
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.shareLink()).then(() => {
      this.copied.set(true);
      setTimeout(() => {
        this.copied.set(false);
        this.cd.detectChanges();
      }, 2000);
      this.cd.detectChanges();
    });
  }

  loadScheduledMeetings(): void {
    this.http.get<any[]>(`${environment.apiUrl}/api/live/schedule`).subscribe({
      next: (data) => {
        this.scheduledMeetings = data;
        this.cd.detectChanges();
      },
      error: (err) => console.error('Failed to load scheduled meetings:', err)
    });
  }

  async scheduleMeeting(): Promise<void> {
    if (!this.newMeetingTitle.trim() || !this.newMeetingTime) {
      this.mediaWarning.set('Veuillez remplir le titre et la date/heure de la séance.');
      this.cd.detectChanges();
      return;
    }

    const room = this.generateRoomId();

    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/api/live/schedule`, {
          title: this.newMeetingTitle.trim(),
          scheduled_time: new Date(this.newMeetingTime).toISOString(),
          duration_minutes: this.newMeetingDuration,
          room_id: room
        })
      );
      
      this.newMeetingTitle = '';
      this.newMeetingTime = '';
      this.newMeetingDuration = 60;
      this.showScheduleForm.set(false);
      this.mediaWarning.set('');
      this.loadScheduledMeetings();
    } catch (err: any) {
      console.error('Failed to schedule meeting:', err);
      this.mediaWarning.set(err.error?.detail || 'Erreur serveur: impossible de planifier la séance.');
      this.cd.detectChanges();
    }
  }

  cancelScheduledMeeting(id: number): void {
    this.http.delete(`${environment.apiUrl}/api/live/schedule/${id}`).subscribe({
      next: () => {
        this.loadScheduledMeetings();
      },
      error: (err) => console.error('Failed to cancel scheduled meeting:', err)
    });
  }

  openEmailModal(meeting: any): void {
    this.emailTargetMeeting.set(meeting);
    this.singleRecipientInput.set('');
    this.recipientList.set([]);
    this.emailSendStatus.set(null);
    this.csvImportMessage.set('');
    this.showEmailModal.set(true);
  }

  closeEmailModal(): void {
    this.showEmailModal.set(false);
    this.emailTargetMeeting.set(null);
    this.singleRecipientInput.set('');
    this.recipientList.set([]);
    this.emailSendStatus.set(null);
    this.csvImportMessage.set('');
  }

  addSingleRecipient(): void {
    const val = this.singleRecipientInput().trim();
    if (!val) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      this.emailSendStatus.set({ success: false, message: `"${val}" n'est pas une adresse email valide.` });
      return;
    }

    const currentList = this.recipientList();
    if (currentList.includes(val)) {
      this.emailSendStatus.set({ success: false, message: `L'adresse "${val}" est déjà dans la liste.` });
      return;
    }

    this.recipientList.set([...currentList, val]);
    this.singleRecipientInput.set('');
    this.emailSendStatus.set(null);
  }

  removeRecipient(index: number): void {
    const currentList = [...this.recipientList()];
    currentList.splice(index, 1);
    this.recipientList.set(currentList);
  }

  updateRecipient(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newVal = input.value.trim();
    const currentList = [...this.recipientList()];
    currentList[index] = newVal;
    this.recipientList.set(currentList);
  }

  clearAllRecipients(): void {
    this.recipientList.set([]);
    this.csvImportMessage.set('');
  }

  onCsvFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const content = e.target.result as string;
      // Extract all email addresses using regex
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const foundEmails = content.match(emailRegex) || [];

      if (foundEmails.length === 0) {
        this.csvImportMessage.set('Aucune adresse email valide trouvée dans le fichier CSV.');
        return;
      }

      const existing = this.recipientList();
      const newEmails = foundEmails.map(e => e.trim().toLowerCase());
      const merged = Array.from(new Set([...existing, ...newEmails]));

      this.recipientList.set(merged);
      const addedCount = merged.length - existing.length;
      this.csvImportMessage.set(`${foundEmails.length} email(s) scanné(s) (${addedCount} nouveau(x) ajouté(s)).`);
      
      // Reset file input value
      event.target.value = '';
    };

    reader.readAsText(file);
  }

  sendInvitationEmail(): void {
    const meeting = this.emailTargetMeeting();
    
    // Auto add single input if user typed but didn't press Add
    if (this.singleRecipientInput().trim()) {
      this.addSingleRecipient();
    }

    const list = this.recipientList().map(e => e.trim()).filter(e => e.length > 0);

    if (!meeting) return;

    if (list.length === 0) {
      this.emailSendStatus.set({ success: false, message: 'Veuillez ajouter au moins une adresse email destinataire.' });
      return;
    }

    this.isSendingEmail.set(true);
    this.emailSendStatus.set(null);

    const payload = {
      recipient_emails: list,
      frontend_url: window.location.origin
    };

    this.http.post(`${environment.apiUrl}/api/live/schedule/${meeting.id}/share-email`, payload).subscribe({
      next: (res: any) => {
        this.isSendingEmail.set(false);
        this.emailSendStatus.set({
          success: true,
          message: res.message || `Invitation envoyée avec succès par email SMTP à ${list.length} destinataire(s)`
        });
        setTimeout(() => {
          if (this.showEmailModal()) {
            this.closeEmailModal();
          }
        }, 2800);
      },
      error: (err: any) => {
        this.isSendingEmail.set(false);
        const detail = err.error?.detail || "Erreur lors de l'envoi des emails via SMTP.";
        this.emailSendStatus.set({ success: false, message: detail });
      }
    });
  }

  async startScheduledMeeting(meeting: any): Promise<void> {
    this.roomId.set(meeting.room_id);
    this.sessionName = meeting.title;
    this.shareLink.set(this.buildShareLink(meeting.room_id));

    try {
      // Create session in live sessions database table (activate it)
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/api/live/session`, {
          room_id: meeting.room_id,
          name: meeting.title
        })
      );
    } catch (err: any) {
      console.error('Failed to start scheduled session in database:', err);
      this.mediaWarning.set(err.error?.detail || 'Erreur serveur: impossible d\'activer la séance planifiée.');
      this.cd.detectChanges();
      return;
    }

    // Save active session metadata to localStorage
    localStorage.setItem('active_live_session', JSON.stringify({
      roomId: meeting.room_id,
      name: meeting.title,
      shareLink: this.buildShareLink(meeting.room_id)
    }));

    await this.initializeWebRTCSession();
  }

  toggleChat(): void {
    const isOpening = !this.showChatPanel();
    this.showChatPanel.set(isOpening);
    if (isOpening) {
      this.unreadChatCount.set(0);
      this.scrollToBottom();
    }
    this.cd.detectChanges();
  }

  sendChatMessage(): void {
    if (!this.chatInput.trim()) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const payload = {
      senderName: this.displayName || 'Participant',
      text: this.chatInput.trim(),
      time
    };

    // Send via websocket
    this.sendSignalingMessage('chat', null, payload);

    // Add locally
    this.chatMessages.push({
      senderName: payload.senderName,
      text: payload.text,
      time: payload.time,
      isMe: true
    });

    this.chatInput = '';
    this.cd.detectChanges();
    this.scrollToBottom();
  }

  handleChatMessage(senderId: string, payload: any): void {
    if (!payload) return;

    this.chatMessages.push({
      senderName: payload.senderName || 'Participant',
      text: payload.text || '',
      time: payload.time || '',
      isMe: false
    });

    if (!this.showChatPanel()) {
      this.unreadChatCount.update(count => count + 1);
    }

    this.cd.detectChanges();
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    setTimeout(() => {
      const container = document.getElementById('chatMessagesContainer');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 50);
  }

  toggleHandRaise(): void {
    this.isHandRaised = !this.isHandRaised;
    // Broadcast to everyone in the room
    this.sendSignalingMessage('raise-hand', null, { raised: this.isHandRaised });
    this.cd.detectChanges();
  }

  handleRaiseHand(senderId: string, raised: boolean): void {
    const peer = this.peers.get(senderId);
    if (peer) {
      peer.isHandRaised = raised;
      this.updatePeerListSignal();
    }
  }

  toggleLockRoom(): void {
    const nextLockState = !this.isRoomLocked;
    const room = this.roomId();
    if (!room) return;

    this.http.post(`${environment.apiUrl}/api/live/session/${room}/lock`, { locked: nextLockState }).subscribe({
      next: () => {
        this.isRoomLocked = nextLockState;
        // Broadcast lock status
        this.sendSignalingMessage('room-locked', null, { locked: this.isRoomLocked });
        this.mediaWarning.set(this.isRoomLocked ? "Séance verrouillée avec succès." : "Séance déverrouillée avec succès.");
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Failed to lock room:', err);
        this.mediaWarning.set("Erreur serveur: impossible de modifier le verrouillage de la séance.");
        this.cd.detectChanges();
      }
    });
  }

  muteParticipant(peerId: string): void {
    this.sendSignalingMessage('force-mute', peerId, null);
  }

  muteAllParticipants(): void {
    this.sendSignalingMessage('force-mute', null, null);
    this.mediaWarning.set("Demande de coupure micro envoyée à tous les participants.");
    this.cd.detectChanges();
  }

  kickParticipant(peerId: string): void {
    this.sendSignalingMessage('kick-participant', peerId, null);
  }

  toggleChatRestriction(restrict: boolean): void {
    this.chatRestricted = restrict;
    this.sendSignalingMessage('restrict-chat', null, { restricted: restrict });
    this.mediaWarning.set(restrict ? "Chat désactivé pour les étudiants." : "Chat activé pour les étudiants.");
    this.cd.detectChanges();
  }

  toggleScreenShareRestriction(restrict: boolean): void {
    this.screenShareRestricted = restrict;
    this.sendSignalingMessage('restrict-screen', null, { restricted: restrict });
    this.mediaWarning.set(restrict ? "Partage d'écran désactivé pour les étudiants." : "Partage d'écran activé pour les étudiants.");
    this.cd.detectChanges();
  }

  muteParticipantCamera(peerId: string): void {
    this.sendSignalingMessage('force-video-off', peerId, null);
  }

  toggleCameraRestriction(restrict: boolean): void {
    this.cameraRestricted = restrict;
    this.sendSignalingMessage('restrict-camera', null, { restricted: restrict });
    this.mediaWarning.set(restrict ? "Caméras désactivées pour les étudiants." : "Caméras activées pour les étudiants.");
    this.cd.detectChanges();
  }

  toggleMicRestriction(restrict: boolean): void {
    this.micRestricted = restrict;
    this.sendSignalingMessage('restrict-mic', null, { restricted: restrict });
    this.mediaWarning.set(restrict ? "Microphones désactivés pour les étudiants." : "Microphones activés pour les étudiants.");
    this.cd.detectChanges();
  }

  endCallForEveryone(): void {
    const room = this.roomId();
    if (room) {
      // Mark as inactive in DB
      this.http.post(`${environment.apiUrl}/api/live/session/${room}/end`, {}).subscribe({
        next: () => console.log('Session marked as inactive in DB.'),
        error: (err) => console.error('Failed to end session in DB:', err)
      });

      // Send broadcast exit signal to everyone
      this.sendSignalingMessage('end-call-everyone', null, null);
    }
    this.cleanupSession();
    localStorage.removeItem('active_live_session');
    this.sessionState.set('lobby');
    this.cd.detectChanges();
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'À l\'instant';
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    return `Il y a ${diffH}h`;
  }

  openConfirmModal(title: string, message: string, callback: () => void): void {
    this.confirmModalTitle = title;
    this.confirmModalMessage = message;
    this.confirmCallback = callback;
    this.showConfirmModal = true;
    this.cd.detectChanges();
  }

  acceptConfirm(): void {
    if (this.confirmCallback) {
      this.confirmCallback();
    }
    this.closeConfirmModal();
  }

  cancelConfirm(): void {
    this.closeConfirmModal();
  }

  private closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.confirmCallback = null;
    this.cd.detectChanges();
  }

  // ==========================================
  // REAL-TIME QUIZ GAMEPLAY METHODS
  // ==========================================

  toggleQuizPanel(): void {
    this.showQuizPanel.set(!this.showQuizPanel());
    this.cd.detectChanges();
  }

  loadModulesList(): void {
    this.http.get<any[]>(`${environment.apiUrl}/api/modules/history`).subscribe({
      next: (list) => {
        this.modulesList.set(list);
        this.cd.detectChanges();
      },
      error: (err) => console.error('Failed to load modules:', err)
    });
  }

  private initializeSocketIoConnection(): void {
    this.resetQuizStateCompletely();
    const currentUser = this.authService.getCurrentUser();
    const isProf = currentUser?.role === 'prof';

    this.socket = io(environment.apiUrl, {
      path: '/socket.io',
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      console.log('Socket.io connected:', this.socket?.id);
      
      if (isProf) {
        this.socket?.emit('session:create', {
          prof_id: currentUser.id,
          module_id: this.selectedModuleId,
          mode: 'competitif',
          code_session: this.roomId()
        }, (res: any) => {
          if (res.status === 'success') {
            this.socketSessionId = res.session_id;
            console.log('Quiz session registered on socket.io:', res);
          }
        });
      } else {
        const randArray = new Uint32Array(1);
        if (typeof window !== 'undefined' && window.crypto) {
          window.crypto.getRandomValues(randArray);
        }
        const pseudoNum = randArray[0] ? (randArray[0] % 100) : Math.floor(Math.random() * 100);
        const pseudo = this.displayName || 'Étudiant_' + pseudoNum;
        this.socket?.emit('session:join', {
          code_session: this.roomId(),
          pseudo: pseudo
        }, (res: any) => {
          if (res.status === 'success') {
            console.log('Joined quiz session successfully:', res);
          } else {
            console.error('Failed to join quiz session:', res.message);
          }
        });
      }
    });

    this.socket.on('session:participants_list', (list: any[]) => {
      this.quizParticipants.set(list);
      this.cd.detectChanges();
    });

    this.socket.on('session:module_updated', (data: any) => {
      this.selectedModuleId = data.module_id;
      this.cd.detectChanges();
    });

    this.socket.on('quiz:launched', (data: any) => {
      this.quizState.set('waiting');
      this.showQuizPanel.set(true);
      this.cd.detectChanges();
    });

    this.socket.on('quiz:question', (data: any) => {
      if (this.quizTimerInterval) clearInterval(this.quizTimerInterval);

      this.quizState.set('active_question');
      this.showQuizPanel.set(true);

      // Fallback to Vrai/Faux for True/False questions or empty options
      let opts = data.options;
      if (!opts || opts.length === 0 || data.type === 'vrai_faux') {
        opts = ['Vrai', 'Faux'];
      }

      this.activeQuestion.set({
        ...data,
        options: opts
      });
      this.selectedAnswer.set(null);
      this.hasSubmittedAnswer.set(false);
      this.answerResult.set(null);
      this.pendingAnswerResult.set(null);
      this.quizTimer.set(data.duree_secondes);

      this.quizTimerInterval = setInterval(() => {
        const current = this.quizTimer();
        if (current > 0) {
          this.quizTimer.set(current - 1);
        } else {
          clearInterval(this.quizTimerInterval);
          if (this.isProf()) {
            this.onProfessorTimerEnd();
          } else {
            this.onStudentTimerEnd();
          }
        }
        this.cd.detectChanges();
      }, 1000);

      this.cd.detectChanges();
    });

    this.socket.on('quiz:answer_result', (data: any) => {
      this.pendingAnswerResult.set(data);
      this.cd.detectChanges();
    });

    this.socket.on('participant:score_updated', (data: any) => {
      const current = this.quizParticipants();
      const updated = current.map(p => {
        if (p.id === data.participant_id) {
          return { ...p, score_total: data.score_total };
        }
        return p;
      });
      updated.sort((a, b) => b.score_total - a.score_total);
      this.quizParticipants.set(updated);
      this.cd.detectChanges();
    });

    this.socket.on('quiz:leaderboard', (data: any[]) => {
      this.quizLeaderboard.set(data);
      this.quizState.set('leaderboard');
      this.cd.detectChanges();
    });

    this.socket.on('session:ended', (data: any) => {
      this.quizState.set('ended');
      this.cleanupQuizState();
      this.cd.detectChanges();
    });
  }

  private cleanupQuizState(): void {
    if (this.quizTimerInterval) clearInterval(this.quizTimerInterval);
    this.quizTimerInterval = null;
    this.activeQuestion.set(null);
    this.selectedAnswer.set(null);
    this.hasSubmittedAnswer.set(false);
    this.answerResult.set(null);
    this.pendingAnswerResult.set(null);
    this.clearAutoProgressionTimeouts();
  }

  resetQuizStateCompletely(): void {
    this.cleanupQuizState();
    this.quizState.set('inactive');
    this.showQuizPanel.set(false);
    this.quizParticipants.set([]);
    this.quizLeaderboard.set([]);
    this.quizDebriefing.set([]);
    this.quizAnimateur.set('');
    this.quizParticipantRules.set('');
    this.quizTitle.set('');
    this.activeQuestionIndex.set(0);
    this.isGeneratingQuiz.set(false);
  }

  clearAutoProgressionTimeouts(): void {
    if (this.autoProgressionTimeout1) clearTimeout(this.autoProgressionTimeout1);
    if (this.autoProgressionTimeout2) clearTimeout(this.autoProgressionTimeout2);
    this.autoProgressionTimeout1 = null;
    this.autoProgressionTimeout2 = null;
  }

  onStudentTimerEnd(): void {
    // If they didn't submit an answer, submit a blank one
    if (!this.hasSubmittedAnswer()) {
      this.hasSubmittedAnswer.set(true);
      this.socket?.emit('quiz:submit_answer', {
        question_id: this.activeQuestion()?.question_id,
        reponse: ''
      });
    }

    // Reveal result immediately (don't wait!)
    if (this.pendingAnswerResult()) {
      this.answerResult.set(this.pendingAnswerResult());
    } else {
      this.answerResult.set({
        est_correcte: false,
        points_obtenus: 0,
        temps_reponse_ms: 0
      });
    }
    this.cd.detectChanges();
  }

  onProfessorTimerEnd(): void {
    this.clearAutoProgressionTimeouts();

    // Wait 3 seconds for late answers/grading to complete, then go straight to next question
    this.autoProgressionTimeout1 = setTimeout(() => {
      this.sendNextQuestionToRoom();
    }, 3000);
  }

  launchQuizForSelectedModule(): void {
    if (!this.selectedModuleId) return;

    this.isGeneratingQuiz.set(true);
    this.cd.detectChanges();

    const payload = {
      nb_questions: 5,
      duree_par_question: 30,
      mode: 'competitif',
      question_types: ['qcm', 'vrai_faux'],
      force: false
    };

    this.http.post<any>(`${environment.apiUrl}/api/modules/history/${this.selectedModuleId}/quiz`, payload).subscribe({
      next: (quiz) => {
        this.currentQuiz = quiz;
        this.quizTitle.set(quiz.titre_quiz);
        this.quizDebriefing.set(quiz.grille_debriefing.criteres);
        this.quizAnimateur.set(quiz.fiche_animateur);
        this.quizParticipantRules.set(quiz.fiche_participant);
        this.activeQuestionIndex.set(0);
        this.isGeneratingQuiz.set(false);

        if (this.socketSessionId) {
          this.socket?.emit('quiz:launch', {
            session_id: this.socketSessionId,
            quiz_id: this.selectedModuleId
          }, (res: any) => {
            if (res.status === 'success') {
              this.sendNextQuestionToRoom();
            }
          });
        }
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Quiz launch failed:', err);
        this.isGeneratingQuiz.set(false);
        this.cd.detectChanges();
      }
    });
  }

  sendNextQuestionToRoom(): void {
    this.clearAutoProgressionTimeouts();
    if (!this.currentQuiz || !this.socketSessionId) return;

    const questions = this.currentQuiz.questions;
    const index = this.activeQuestionIndex();

    if (index >= questions.length) {
      this.quizState.set('ended');
      this.http.post(`${environment.apiUrl}/api/quiz-sessions/${this.socketSessionId}/end`, {}).subscribe();
      this.cd.detectChanges();
      return;
    }

    const q = questions[index];
    this.socket?.emit('quiz:next_question', {
      session_id: this.socketSessionId,
      question_id: q.id,
      enonce: q.enonce,
      options: q.options || [],
      bonne_reponse: q.bonne_reponse,
      duree_secondes: q.duree_secondes || 30,
      type: q.type || 'qcm'
    }, (res: any) => {
      if (res.status !== 'success') {
        console.error('Failed to emit next question:', res.message);
      }
    });

    this.activeQuestionIndex.set(index + 1);
    this.cd.detectChanges();
  }

  showLeaderboardInRoom(): void {
    this.clearAutoProgressionTimeouts();
    if (!this.socketSessionId) return;
    this.socket?.emit('quiz:show_leaderboard', {
      session_id: this.socketSessionId
    });
  }

  submitAnswer(option: string): void {
    if (this.hasSubmittedAnswer()) return;

    this.selectedAnswer.set(option);
    this.hasSubmittedAnswer.set(true);

    const activeQ = this.activeQuestion();
    if (!activeQ) return;

    this.socket?.emit('quiz:submit_answer', {
      question_id: activeQ.question_id,
      reponse: option
    });
    this.cd.detectChanges();
  }

  getSelfScore(): number {
    const me = this.quizParticipants().find(p => p.pseudo === this.displayName);
    return me ? me.score_total : 0;
  }
}
