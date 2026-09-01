import { ChangeDetectorRef, Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ShareService } from 'src/app/theme/shared/service/share.service';
import { AudioAlertService } from 'src/app/theme/shared/service/audio-alert.service';
import { environment } from 'src/environments/environment';
import { io, Socket } from 'socket.io-client';

interface Critere {
  nom: string;
  description: string;
  ponderation?: number;
}

interface StructureGrille {
  note_min: number;
  note_max: number;
  sections: string[];
  consignes?: string;
}

interface AtelierData {
  id: number;
  module_id?: number;
  titre: string;
  criteres: Critere[];
  structure_grille: StructureGrille;
  anonyme: boolean;
}


interface PresentationItem {
  id: number;
  session_id?: number;
  atelier_feedback_id: number;
  participant_ou_groupe_id: string;
  nom_presentateur: string;
  ordre_passage: number;
  statut: string;
}

type HostState = 'select' | 'generating' | 'result' | 'lobby' | 'live' | 'aggregated' | 'history';
type JoinState = 'join' | 'waiting' | 'fill_feedback' | 'view_results';

@Component({
  selector: 'app-atelier-feedback',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, RouterModule],
  templateUrl: './atelier-feedback.component.html',
  styleUrls: ['./atelier-feedback.component.scss']
})
export class AtelierFeedbackComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private cd = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private shareService = inject(ShareService);
  private route = inject(ActivatedRoute);
  public audioAlertService = inject(AudioAlertService);

  private apiUrl = environment.apiUrl;

  // View modes: 'host' (prof) or 'join' (student/peer)
  isProf = true;
  viewMode = signal<'host' | 'join'>('host');

  // Prof State
  hostState = signal<HostState>('select');
  isLoading = signal(false);
  isLoadingModules = signal(false);
  isLoadingHistory = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  analyses = signal<any[]>([]);
  historyList = signal<any[]>([]);
  historySearch = '';
  selectedAnalysis = signal<any | null>(null);
  viewingAnalysis = signal<any | null>(null);

  nbCriteres = 4;
  anonyme = true;
  selectedModel = signal('bai/glm-5.3-flash');

  atelier = signal<AtelierData | null>(null);

  // Presenters & Live Session
  sessionCode = signal<string>('');
  presentations = signal<PresentationItem[]>([]);
  newPresenterName = '';
  activePresentation = signal<PresentationItem | null>(null);
  feedbackCount = signal<number>(0);

  // Aggregated Results
  aggregatedData = signal<any | null>(null);

  // Student State
  joinState = signal<JoinState>('join');
  joinCode = '';
  studentPseudo = '';

  // Peer Form Inputs
  evalNotes: Record<string, number> = {};
  evalPointsPositifs = '';
  evalAxesAmelioration = '';
  evalNoteSynthese = 4.0;

  bloomLabels: Record<string, string> = {
    'memoriser': 'Mémoriser',
    'comprendre': 'Comprendre',
    'appliquer': 'Appliquer',
    'analyser': 'Analyser',
    'evaluer': 'Évaluer',
    'creer': 'Créer'
  };

  bloomColors: Record<string, string> = {
    'memoriser': '#ef4444',
    'comprendre': '#f97316',
    'appliquer': '#eab308',
    'analyser': '#22c55e',
    'evaluer': '#3b82f6',
    'creer': '#9f1010'
  };

  getBloomLabel(level: string): string {
    return this.bloomLabels[level?.toLowerCase()] || level || 'Acquis';
  }

  getBloomColor(level: string): string {
    return this.bloomColors[level?.toLowerCase()] || '#64748b';
  }

  private socket: Socket | null = null;

  ngOnInit(): void {
    this.isProf = true;
    this.viewMode.set('host');

    // Check query params for join code
    this.route.queryParams.subscribe((params) => {
      if (params['code']) {
        this.joinCode = params['code'];
        this.viewMode.set('join');
      } else {
        this.viewMode.set('host');
      }
    });

    this.loadAnalyses();
    this.loadHistory();
  }

  ngOnDestroy(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  switchToHost(): void {
    this.viewMode.set('host');
    this.hostState.set('select');
    this.loadAnalyses();
  }

  switchViewMode(mode: 'host' | 'join'): void {
    this.viewMode.set(mode);
    if (mode === 'host') {
      this.hostState.set('select');
      this.loadAnalyses();
    }
  }

  switchToHistory(): void {
    this.viewMode.set('host');
    this.hostState.set('history');
    this.loadHistory();
  }

  loadHistory(): void {
    this.isLoadingHistory.set(true);
    this.http.get<any[]>(`${this.apiUrl}/atelier-feedback/history`).subscribe({
      next: (data) => {
        this.historyList.set(data || []);
        this.isLoadingHistory.set(false);
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Erreur chargement historique ateliers:', err);
        this.isLoadingHistory.set(false);
        this.cd.detectChanges();
      }
    });
  }

  consultAtelier(id: number): void {
    this.isLoading.set(true);
    this.http.get<any>(`${this.apiUrl}/atelier-feedback/detail/${id}`).subscribe({
      next: (data) => {
        this.atelier.set({
          id: data.id,
          module_id: data.module_id,
          titre: data.titre,
          criteres: data.criteres,
          structure_grille: data.structure_grille,
          anonyme: data.anonyme
        });
        this.hostState.set('result');
        this.isLoading.set(false);
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set('Impossible de charger cet atelier.');
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  deleteAtelier(id: number, event: Event): void {
    event.stopPropagation();
    if (!confirm('Voulez-vous vraiment supprimer cet atelier de feedback ?')) {
      return;
    }
    this.http.delete(`${this.apiUrl}/atelier-feedback/${id}`).subscribe({
      next: () => {
        this.successMessage.set('Atelier supprimé avec succès.');
        this.loadHistory();
      },
      error: (err) => {
        this.errorMessage.set('Erreur lors de la suppression.');
      }
    });
  }

  get filteredHistory(): any[] {
    if (!this.historySearch.trim()) return this.historyList();
    const q = this.historySearch.toLowerCase();
    return this.historyList().filter((item) =>
      (item.titre && item.titre.toLowerCase().includes(q)) ||
      (item.module_title && item.module_title.toLowerCase().includes(q))
    );
  }

  // ─── PROF: Load Modules & Generate Grid ───
  loadAnalyses(): void {
    this.isLoadingModules.set(true);
    this.http.get<any[]>(`${this.apiUrl}/api/modules/history`).subscribe({
      next: (data) => {
        this.analyses.set(data || []);
        this.isLoadingModules.set(false);
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load modules', err);
        this.isLoadingModules.set(false);
        this.errorMessage.set('Erreur lors du chargement des fiches de cours.');
        this.cd.detectChanges();
      }
    });
  }

  selectAnalysis(analysis: any): void {
    this.selectedAnalysis.set(analysis);
  }

  generateAtelierGrid(): void {
    if (!this.selectedAnalysis()) return;
    this.hostState.set('generating');
    this.isLoading.set(true);
    this.errorMessage.set('');

    const body = {
      module_id: this.selectedAnalysis()!.id,
      titre: `Atelier Feedback — ${this.selectedAnalysis()!.module_title}`,
      anonyme: this.anonyme,
      nb_criteres: this.nbCriteres,
      model: this.selectedModel()
    };

    this.http.post<AtelierData>(`${this.apiUrl}/atelier-feedback/generate`, body).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.atelier.set(res);
        this.hostState.set('result');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.detail || 'Erreur lors de la génération de la grille.');
        this.hostState.set('select');
      }
    });
  }

  addPresenter(): void {
    if (!this.newPresenterName.trim()) return;
    const current = this.presentations();
    const item: PresentationItem = {
      id: 0,
      atelier_feedback_id: this.atelier()?.id || 0,
      participant_ou_groupe_id: `g_${current.length + 1}`,
      nom_presentateur: this.newPresenterName.trim(),
      ordre_passage: current.length + 1,
      statut: 'en_attente'
    };
    this.presentations.set([...current, item]);
    this.newPresenterName = '';
  }

  removePresenter(index: number): void {
    const list = [...this.presentations()];
    list.splice(index, 1);
    this.presentations.set(list);
  }

  openLobby(): void {
    // Generate 6-digit session code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.sessionCode.set(code);
    this.initSocket(code);
    this.hostState.set('lobby');
  }

  launchAtelierSession(): void {
    if (!this.socket || !this.atelier()) return;

    this.socket.emit('atelier:launch', {
      session_code: this.sessionCode(),
      atelier_feedback_id: this.atelier()!.id,
      presentations: this.presentations()
    }, (res: any) => {
      if (res?.status === 'success') {
        const presList = res.atelier.presentations || [];
        this.presentations.set(presList);
        this.hostState.set('live');
        if (presList.length > 0) {
          this.startPresentation(presList[0].id);
        }
      }
    });
  }

  startPresentation(presentationId: number): void {
    if (!this.socket) return;
    this.socket.emit('atelier:start_presentation', {
      session_code: this.sessionCode(),
      presentation_id: presentationId
    }, (res: any) => {
      if (res?.status === 'success') {
        this.activePresentation.set(res.presentation);
        this.feedbackCount.set(0);
        this.aggregatedData.set(null);
      }
    });
  }

  triggerAggregatedResults(): void {
    if (!this.socket || !this.activePresentation()) return;
    this.socket.emit('atelier:show_aggregated', {
      session_code: this.sessionCode(),
      presentation_id: this.activePresentation()!.id
    }, (res: any) => {
      if (res?.status === 'success') {
        this.aggregatedData.set(res.aggregated);
        this.hostState.set('aggregated');
      }
    });
  }

  exportPDF(): void {
    if (!this.activePresentation()) return;
    const presId = this.activePresentation()!.id;
    const sessionCode = this.sessionCode() || '0';
    const url = `${this.apiUrl}/atelier-feedback/${sessionCode}/export-pdf/${presId}`;
    window.open(url, '_blank');
  }

  // ─── STUDENT: Join & Submit ───
  joinSession(): void {
    if (!this.joinCode || !this.studentPseudo) {
      this.errorMessage.set('Veuillez saisir un code de session et votre pseudo.');
      return;
    }
    this.errorMessage.set('');
    this.sessionCode.set(this.joinCode);
    this.initSocket(this.joinCode);
  }

  submitFeedbackForm(): void {
    if (!this.socket || !this.activePresentation()) return;

    this.socket.emit('atelier:submit_feedback', {
      session_code: this.sessionCode(),
      presentation_id: this.activePresentation()!.id,
      evaluateur_id: this.studentPseudo,
      notes_par_critere: this.evalNotes,
      points_positifs: this.evalPointsPositifs,
      axes_amelioration: this.evalAxesAmelioration,
      note_synthese: this.evalNoteSynthese
    }, (res: any) => {
      if (res?.status === 'success') {
        this.successMessage.set('Feedback transmis avec succès !');
        this.joinState.set('waiting');
      }
    });
  }

  // ─── Socket.IO Initialization ───
  private initSocket(code: string): void {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(this.apiUrl, {
      path: '/socket.io',
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      if (!this.isProf) {
        this.socket?.emit('session:join', {
          code_session: code,
          pseudo: this.studentPseudo
        }, (res: any) => {
          if (res?.status === 'success') {
            this.joinState.set('waiting');
          } else {
            this.errorMessage.set(res?.message || 'Impossible de rejoindre la session.');
          }
        });
      }
    });

    this.socket.on('atelier:launched', (data: any) => {
      if (data.criteres) {
        this.atelier.set({
          id: data.atelier_feedback_id,
          titre: data.titre,
          criteres: data.criteres,
          structure_grille: data.structure_grille,
          anonyme: data.anonyme
        });
        // Reset evaluation notes form
        this.evalNotes = {};
        for (const c of data.criteres) {
          this.evalNotes[c.nom] = 4.0;
        }
      }
    });

    this.socket.on('atelier:presentation_started', (data: any) => {
      this.activePresentation.set(data);
      this.successMessage.set('');
      if (!this.isProf) {
        this.joinState.set('fill_feedback');
      }
    });

    this.socket.on('atelier:feedback_count_updated', (data: any) => {
      if (data.presentation_id === this.activePresentation()?.id) {
        this.feedbackCount.set(data.total_feedbacks);
      }
    });

    this.socket.on('atelier:aggregated_results', (data: any) => {
      this.aggregatedData.set(data);
      if (this.isProf) {
        this.hostState.set('aggregated');
      } else {
        this.joinState.set('view_results');
      }
    });
  }

  shareSession(): void {
    const url = `${window.location.origin}/atelier-feedback?code=${this.sessionCode()}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      this.successMessage.set('Lien de la session copié dans le presse-papier !');
    }
  }

}
