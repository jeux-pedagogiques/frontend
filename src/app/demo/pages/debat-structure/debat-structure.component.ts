import { ChangeDetectorRef, Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ShareService } from 'src/app/theme/shared/service/share.service';
import { environment } from 'src/environments/environment';
import { io, Socket } from 'socket.io-client';

interface DebatData {
  id: number;
  module_id?: number;
  module_title?: string;
  problematique: string;
  camp_pour: string[];
  camp_contre: string[];
  roles: { nom_role: string; description?: string; missions?: string[] }[];
  questions_relance: string[];
  duree_intervention_secondes?: number;
}

interface RoomParticipant {
  id: number;
  pseudo: string;
  is_active?: boolean;
  socket_id?: string;
}

type HostState = 'select' | 'generating' | 'result' | 'lobby' | 'live' | 'ended';
type JoinState = 'join' | 'waiting' | 'role' | 'ended';

import { AudioAlertService } from 'src/app/theme/shared/service/audio-alert.service';

@Component({
  selector: 'app-debat-structure',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './debat-structure.component.html',
  styleUrls: ['./debat-structure.component.scss']
})
export class DebatStructureComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private cd = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private shareService = inject(ShareService);
  private route = inject(ActivatedRoute);
  public audioAlertService = inject(AudioAlertService);

  private apiUrl = `${environment.apiUrl}/api`;

  // ─── Mode: prof (host) ou étudiant (join) ───
  isProf = true;
  viewMode = signal<'host' | 'join'>('host');

  // ─── Génération (prof) ───
  hostState = signal<HostState>('select');
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  analyses = signal<any[]>([]);
  selectedAnalysis = signal<any | null>(null);
  viewingAnalysis = signal<any | null>(null);

  // Formulaire prof
  selectedModel = signal<string>('bai/glm-5.3-flash');
  nbArguments = 3;
  dureeIntervention = 120;

  // Débat généré
  debat = signal<DebatData | null>(null);

  // Session live (prof)
  sessionId: number | null = null;
  codeSession = signal<string>('');
  debatEnCours = signal<any | null>(null);
  participants = signal<any[]>([]);
  prisesDeParole = signal<any[]>([]);
  activeSpeaker = signal<any | null>(null);
  syntheseNotes = signal<any[]>([]);

  // ─── Session socket (host) ───
  private socket: Socket | null = null;
  roomParticipants = signal<RoomParticipant[]>([]);
  joinUrl = signal('');
  shareLink = signal('');
  shareCopied = signal(false);

  // ─── Live ───
  launched = signal<any | null>(null);
  campsByClient: Record<string, { camp: string; role: string; pseudo: string }> = {};
  currentIntervention = signal<any | null>(null);
  timerRemaining = signal(0);
  private timerInterval: any = null;
  interventionLog = signal<any[]>([]);
  observerNotes = signal<any[]>([]);
  synthese = signal<any | null>(null);

  // ─── Étudiant (join) ───
  joinState = signal<JoinState>('join');
  joinCode = '';
  joinPseudo = '';
  myParticipantId: number | null = null;
  myRole = signal<any | null>(null);
  noteText = '';
  noteSent = signal(false);

  // ─── Helpers template ───
  roleLabels: Record<string, string> = {
    avocat: 'Avocat (camp Pour)',
    avocat_du_diable: "Avocat du diable (camp Contre)",
    moderateur: 'Modérateur',
    observateur_rapporteur: 'Observateur rapporteur'
  };

  constructor() {
    this.isProf = true;
    this.viewMode.set('host');
  }

  ngOnInit(): void {
    this.isProf = true;
    const code = this.route.snapshot.queryParamMap.get('code');
    if (code) {
      this.viewMode.set('join');
      this.joinCode = code;
      this.joinPseudo = this.defaultPseudo();
    } else {
      this.viewMode.set('host');
    }
    this.loadAnalyses();
  }

  ngOnDestroy(): void {
    this.clearTimer();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private defaultPseudo(): string {
    const user = this.authService.getCurrentUser();
    if (user?.first_name || user?.last_name) {
      return user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : (user.first_name || user.last_name || user.username);
    }
    if (user?.username) return user.username;
    const saved = localStorage.getItem('debat_guest_name');
    if (saved) return saved;
    return `Étudiant_${Math.floor(1000 + Math.random() * 9000)}`;
  }

  switchViewMode(mode: 'host' | 'join'): void {
    if (mode === 'join') {
      this.joinPseudo = this.defaultPseudo();
    } else {
      this.loadAnalyses();
    }
    this.viewMode.set(mode);
  }

  // ──────────────────────────────────────────────
  //  GÉNÉRATION
  // ──────────────────────────────────────────────

  loadAnalyses(): void {
    this.isLoading.set(true);
    this.http.get<any[]>(`${this.apiUrl}/modules/history`).subscribe({
      next: (data) => {
        this.analyses.set(data || []);
        this.isLoading.set(false);
        this.cd.detectChanges();
      },
      error: () => {
        this.errorMessage.set('Erreur lors du chargement des modules.');
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  selectAnalysis(a: any): void {
    this.selectedAnalysis.set(a);
    this.cd.detectChanges();
  }

  openOverlay(a: any): void {
    this.viewingAnalysis.set(a);
  }

  closeOverlay(): void {
    this.viewingAnalysis.set(null);
  }

  generateDebat(): void {
    const analysis = this.selectedAnalysis();
    if (!analysis) return;
    this.hostState.set('generating');
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.http.post<any>(`${this.apiUrl}/debat/generate`, {
      module_id: analysis.id,
      nb_arguments_par_camp: this.nbArguments,
      duree_intervention_secondes: this.dureeIntervention
    }).subscribe({
      next: (data) => {
        this.debat.set(data);
        this.hostState.set('result');
        this.isLoading.set(false);
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Erreur lors de la génération du débat.');
        this.hostState.set('select');
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  backToSelect(): void {
    this.hostState.set('select');
    this.debat.set(null);
    this.errorMessage.set('');
  }

  getRoleDescription(nomRole: string): string {
    const role = this.debat()?.roles?.find(r => r.nom_role === nomRole);
    return role?.description || '';
  }

  getRoleMissions(nomRole: string): string[] {
    const role = this.debat()?.roles?.find(r => r.nom_role === nomRole);
    return role?.missions || [];
  }

  // ──────────────────────────────────────────────
  //  SESSION / LANCEMENT (host)
  // ──────────────────────────────────────────────

  connectHostSocket(): void {
    if (this.socket) return;
    this.socket = io(environment.apiUrl, { path: '/socket.io', transports: ['websocket'] });

    this.socket.on('connect', () => {
      const user = this.authService.getCurrentUser();
      this.socket?.emit('session:create', { prof_id: user?.id, module_id: this.debat()?.module_id }, (res: any) => {
        if (res?.status === 'success') {
          this.sessionId = res.session_id;
          this.codeSession.set(res.code_session);
          this.joinUrl.set(`${window.location.origin}/debat-structure?code=${res.code_session}`);
          this.hostState.set('lobby');
          this.cd.detectChanges();
        } else {
          this.errorMessage.set(res?.message || 'Erreur lors de la création de la session.');
          this.cd.detectChanges();
        }
      });
    });

    this.socket.on('session:participants_list', (list: any[]) => {
      this.roomParticipants.set((list || []).filter((p: any) => p.pseudo));
      this.cd.detectChanges();
    });

    this.socket.on('debat:launched', (payload: any) => {
      this.launched.set(payload);
      const camps: Record<string, { camp: string; role: string; pseudo: string }> = {};
      for (const p of payload?.participants || []) {
        camps[String(p.client_id)] = { camp: p.camp, role: p.role, pseudo: p.participant_pseudo };
      }
      this.campsByClient = camps;
      this.hostState.set('live');
      this.cd.detectChanges();
    });

    this.socket.on('debat:intervention_started', (payload: any) => this.handleInterventionStarted(payload));
    this.socket.on('debat:intervention_ended', (payload: any) => this.handleInterventionEnded(payload));
    this.socket.on('debat:observer_note', (payload: any) => {
      this.observerNotes.update((list) => [...list, payload]);
      this.cd.detectChanges();
    });
    this.socket.on('debat:synthese', (payload: any) => {
      this.synthese.set(payload.synthese);
      this.finishHostEnd(payload.synthese);
    });
  }

  launchDebat(): void {
    const d = this.debat();
    if (!d || !this.socket) return;

    const participants = this.roomParticipants()
      .filter(p => p.is_active !== false)
      .map(p => ({ id: p.id, pseudo: p.pseudo, socket_id: p.socket_id }));

    this.socket.emit('debat:launch', {
      debat_id: d.id,
      session_code: this.codeSession(),
      session_id: this.sessionId,
      participants,
      duree_intervention_secondes: this.dureeIntervention
    }, (res: any) => {
      if (res?.status !== 'success') {
        this.errorMessage.set(res?.message || 'Erreur lors du lancement du débat.');
        this.cd.detectChanges();
      }
    });
  }

  // ──────────────────────────────────────────────
  //  TOURS DE PAROLE (host)
  // ──────────────────────────────────────────────

  participantCamp(clientId: number): string {
    return this.campsByClient[String(clientId)]?.camp || 'neutre';
  }

  participantRole(clientId: number): string {
    return this.campsByClient[String(clientId)]?.role || '';
  }

  startIntervention(p: RoomParticipant): void {
    const d = this.debat();
    if (!d || !this.socket) return;
    this.socket.emit('debat:start_intervention', {
      debat_id: d.id,
      participant_id: p.id,
      pseudo: p.pseudo,
      camp: this.participantCamp(p.id),
      duree_max: this.dureeIntervention,
      session_code: this.codeSession()
    }, (res: any) => {
      if (res?.status !== 'success') {
        this.errorMessage.set(res?.message || 'Erreur au démarrage du tour.');
        this.cd.detectChanges();
      }
    });
  }

  endIntervention(contenu?: string): void {
    const d = this.debat();
    if (!d || !this.socket) return;
    this.socket.emit('debat:end_intervention', {
      debat_id: d.id,
      contenu: contenu || '',
      session_code: this.codeSession()
    }, (res: any) => {
      if (res?.status !== 'success') {
        this.errorMessage.set(res?.message || "Erreur à la fin du tour.");
        this.cd.detectChanges();
      }
    });
  }

  endDebate(): void {
    const d = this.debat();
    if (!d || !this.socket) return;
    if (!confirm('Terminer le débat et générer la synthèse ?')) return;
    this.socket.emit('debat:end', {
      debat_id: d.id,
      session_code: this.codeSession()
    }, (res: any) => {
      if (res?.status !== 'success') {
        this.errorMessage.set(res?.message || 'Erreur à la fin du débat.');
        this.cd.detectChanges();
      }
    });
  }

  private handleInterventionStarted(payload: any): void {
    this.clearTimer();
    this.currentIntervention.set(payload);
    const max = payload.duree_max || this.dureeIntervention;
    this.timerRemaining.set(max);
    this.timerInterval = setInterval(() => {
      this.timerRemaining.update((t) => {
        const next = t > 0 ? t - 1 : 0;
        if (next === 10) {
          this.audioAlertService.playWarningAlert("Attention : il reste 10 secondes de temps de parole !");
        } else if (next === 0 && t > 0) {
          this.audioAlertService.playTimesUpAlert("Temps de parole écoulé !");
        }
        return next;
      });
      this.cd.detectChanges();
    }, 1000);
    this.cd.detectChanges();
  }

  private handleInterventionEnded(payload: any): void {
    this.clearTimer();
    this.timerRemaining.set(0);
    this.currentIntervention.set(null);
    this.interventionLog.update((log) => [...log, payload]);
    this.cd.detectChanges();
  }

  private finishHostEnd(synthese: any): void {
    this.clearTimer();
    this.currentIntervention.set(null);
    this.hostState.set('ended');
    if (this.sessionId) {
      this.http.get<any>(`${this.apiUrl}/debat/${this.sessionId}/notes`).subscribe({
        next: (res) => {
          this.syntheseNotes.set(res.notes || []);
          this.cd.detectChanges();
        },
        error: () => {}
      });
    }
    this.cd.detectChanges();
  }

  shareGame(): void {
    const d = this.debat();
    if (!d) return;
    this.shareService.createShare('debat', d.id).subscribe({
      next: (res) => {
        const url = `${window.location.origin}/play/debat/${res.share_token}`;
        this.shareLink.set(url);
        navigator.clipboard.writeText(url).then(() => {
          this.shareCopied.set(true);
          setTimeout(() => this.shareCopied.set(false), 3000);
        });
      },
      error: () => this.errorMessage.set('Erreur lors de la création du lien de partage')
    });
  }

  // ──────────────────────────────────────────────
  //  ÉTUDIANT (join)
  // ──────────────────────────────────────────────

  connectStudentSocket(): void {
    if (this.socket) return;
    if (!this.joinCode.trim() || !this.joinPseudo.trim()) {
      this.errorMessage.set('Veuillez saisir le code de session et votre pseudo.');
      return;
    }
    this.socket = io(environment.apiUrl, { path: '/socket.io', transports: ['websocket'] });

    this.socket.on('connect', () => {
      this.socket?.emit('session:join', {
        code_session: this.joinCode.trim(),
        pseudo: this.joinPseudo.trim()
      }, (res: any) => {
        if (res?.status === 'success') {
          this.myParticipantId = res.participant_id;
          this.joinState.set('waiting');
          this.errorMessage.set('');
          this.cd.detectChanges();
        } else {
          this.errorMessage.set(res?.message || "Impossible de rejoindre la session.");
          this.cd.detectChanges();
        }
      });
    });

    this.socket.on('debat:your_role', (payload: any) => {
      this.myRole.set(payload);
      this.launched.set({ ...(this.launched() || {}), debat_id: payload.debat_id });
      this.joinState.set('role');
      this.cd.detectChanges();
    });

    this.socket.on('debat:launched', (payload: any) => {
      this.launched.set(payload);
      this.dureeIntervention = payload.duree_intervention_secondes || this.dureeIntervention;
      this.cd.detectChanges();
    });

    this.socket.on('debat:intervention_started', (payload: any) => this.handleInterventionStarted(payload));
    this.socket.on('debat:intervention_ended', (payload: any) => this.handleInterventionEnded(payload));

    this.socket.on('debat:synthese', (payload: any) => {
      this.synthese.set(payload.synthese);
      this.joinState.set('ended');
      this.cd.detectChanges();
    });
  }

  submitNote(): void {
    if (!this.noteText.trim()) return;
    const d = this.launched();
    this.socket?.emit('debat:add_observer_note', {
      debat_id: d?.debat_id,
      participant_id: this.myRole()?.participant_id,
      pseudo: this.joinPseudo.trim(),
      note_texte: this.noteText.trim()
    }, (res: any) => {
      if (res?.status === 'success') {
        this.noteSent.set(true);
        this.cd.detectChanges();
      } else {
        this.errorMessage.set(res?.message || "Erreur lors de l'envoi de la note.");
        this.cd.detectChanges();
      }
    });
  }

  resetNote(): void {
    this.noteText = '';
    this.noteSent.set(false);
  }

  // ──────────────────────────────────────────────
  //  Helpers
  // ──────────────────────────────────────────────

  isObserver(): boolean {
    return this.myRole()?.role === 'observateur_rapporteur';
  }

  roleLabel(): string {
    return this.roleLabels[this.myRole()?.role] || this.myRole()?.role || '';
  }

  campLabel(camp: string): string {
    if (camp === 'pour') return 'Camp POUR';
    if (camp === 'contre') return 'Camp CONTRE';
    return 'Neutre';
  }

  getMyCampArguments(): string[] {
    const role = this.myRole();
    const d = this.launched();
    if (!role || !d) return [];
    if (role.camp === 'pour') return d.camp_pour || [];
    if (role.camp === 'contre') return d.camp_contre || [];
    return [];
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  copyText(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.shareCopied.set(true);
      setTimeout(() => this.shareCopied.set(false), 3000);
    });
  }

  private clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}
