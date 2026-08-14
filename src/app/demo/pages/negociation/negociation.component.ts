import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { AudioAlertService } from 'src/app/theme/shared/service/audio-alert.service';
import { environment } from 'src/environments/environment';
import { io, Socket } from 'socket.io-client';

interface CharacterCard {
  groupe_id?: number;
  nom_groupe?: string;
  nom_personnage: string;
  role_description: string;
  objectifs_secrets: string;
  arguments_cles: string[];
  lignes_rouges_et_compromis: string;
}

interface MilestonePoint {
  etape: number;
  temps_pourcentage: number;
  titre: string;
  instruction: string;
}

interface DebriefingCriterion {
  nom_critere: string;
  description: string;
  questions_reflexion: string[];
}

@Component({
  selector: 'app-negociation',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './negociation.component.html',
  styleUrls: ['./negociation.component.scss']
})
export class NegociationComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private cd = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  public audioAlertService = inject(AudioAlertService);

  private apiUrl = `${environment.apiUrl}/api`;

  // Mode: prof (host)
  isProf = true;
  viewMode = signal<'host'>('host');

  // Generation state
  hostState = signal<'select' | 'generating' | 'result' | 'lobby' | 'live' | 'ended'>('select');

  analyses = signal<any[]>([]);
  selectedAnalysis = signal<any | null>(null);
  selectedModel = signal<string>('gemini-3.6-flash');

  // Form parameters
  nbPersonnages = 2;
  timerDuration = 600; // 10 minutes default

  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  // Generated scenario
  generatedNegociation = signal<any | null>(null);

  // Live session & Socket.io
  private socket: Socket | null = null;
  sessionId: number | null = null;
  codeSession = signal('');
  roomParticipants = signal<any[]>([]);

  // Public scenario context
  scenarioContext = signal<{
    titre: string;
    contexte_scenario: string;
    points_passage: MilestonePoint[];
    groupes?: any[];
  } | null>(null);

  // Milestone progression
  currentMilestone = signal<MilestonePoint | null>(null);

  // Debriefing
  debriefingData = signal<{
    criteres_debriefing: DebriefingCriterion[];
    accords_groupes: any[];
  } | null>(null);

  // Timer
  timerRemaining = signal(0);
  private timerInterval: any = null;

  ngOnInit(): void {
    this.loadAnalyses();
  }

  ngOnDestroy(): void {
    this.clearTimer();
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  selectAnalysis(item: any): void {
    if (this.selectedAnalysis()?.id === item.id) {
      this.selectedAnalysis.set(null);
    } else {
      this.selectedAnalysis.set(item);
    }
    this.clearMessages();
  }

  backToSelect(): void {
    this.hostState.set('select');
    this.clearMessages();
  }

  triggerMilestone(milestone: MilestonePoint): void {
    if (!this.codeSession()) return;
    this.socket?.emit('negociation:passage_point', {
      session_code: this.codeSession(),
      etape: milestone.etape,
      titre: milestone.titre,
      instruction: milestone.instruction
    });
  }

  loadAnalyses(): void {
    this.isLoading.set(true);
    this.http.get<any[]>(`${this.apiUrl}/modules/history`).subscribe({
      next: (data) => {
        this.analyses.set(data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Erreur lors du chargement des modules.');
        this.isLoading.set(false);
      }
    });
  }

  generateScenario(): void {
    const analysis = this.selectedAnalysis();
    if (!analysis) {
      this.errorMessage.set('Veuillez sélectionner un module analysé.');
      return;
    }

    this.hostState.set('generating');
    this.isLoading.set(true);
    this.clearMessages();

    const payload = {
      analysis_id: analysis.id,
      nb_personnages: this.nbPersonnages,
      model: this.selectedModel()
    };

    this.http.post<any>(`${this.apiUrl}/negociation/generate`, payload).subscribe({
      next: (res) => {
        this.generatedNegociation.set(res);
        this.hostState.set('result');
        this.isLoading.set(false);
        this.successMessage.set('Simulation de Négociation générée avec succès !');
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Erreur lors de la génération de la négociation.');
        this.hostState.set('select');
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  createSession(): void {
    const scenario = this.generatedNegociation();
    if (!scenario) return;

    this.initSocket();
    const user = this.authService.getCurrentUser();

    this.socket?.emit('session:create', {
      prof_id: user?.id || 1,
      module_id: scenario.module_id,
      mode: 'negociation'
    }, (res: any) => {
      if (res?.status === 'success') {
        this.codeSession.set(res.code_session);
        this.sessionId = res.session_id;
        this.hostState.set('lobby');
        this.cd.detectChanges();
      }
    });
  }

  launchNegociation(): void {
    const scenario = this.generatedNegociation();
    if (!scenario || !this.codeSession()) return;

    this.socket?.emit('negociation:launch', {
      negociation_id: scenario.id,
      session_code: this.codeSession()
    }, (res: any) => {
      if (res?.status === 'success') {
        this.hostState.set('live');
        this.startTimer(this.timerDuration);
        this.cd.detectChanges();
      } else {
        this.errorMessage.set(res?.message || 'Erreur lors du lancement de la négociation.');
      }
    });
  }

  endNegociation(): void {
    const scenario = this.generatedNegociation();
    this.socket?.emit('negociation:end', {
      session_code: this.codeSession(),
      negociation_id: scenario?.id || 1
    });
  }

  private initSocket(): void {
    if (this.socket) return;

    this.socket = io(environment.apiUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    this.socket.on('session:participants_list', (participants: any[]) => {
      this.roomParticipants.set(participants);
      this.cd.detectChanges();
    });

    this.socket.on('negociation:launched', (data: any) => {
      this.scenarioContext.set(data);
      this.hostState.set('live');
      this.startTimer(this.timerDuration);
      this.cd.detectChanges();
    });

    this.socket.on('negociation:milestone', (milestone: MilestonePoint) => {
      this.currentMilestone.set(milestone);
      this.audioAlertService.playWarningAlert(`Jalon de négociation : ${milestone.titre}`);
      this.cd.detectChanges();
    });

    this.socket.on('negociation:debriefing', (debriefing: any) => {
      this.debriefingData.set(debriefing);
      this.hostState.set('ended');
      this.audioAlertService.playTimesUpAlert('Négociation terminée ! Place au débriefing.');
      this.cd.detectChanges();
    });
  }

  private startTimer(seconds: number): void {
    this.clearTimer();
    this.timerRemaining.set(seconds);
    this.timerInterval = setInterval(() => {
      this.timerRemaining.update((t) => {
        const next = t > 0 ? t - 1 : 0;
        if (next === 10) {
          this.audioAlertService.playWarningAlert('Attention : il reste 10 secondes de négociation !');
        } else if (next === 0 && t > 0) {
          this.audioAlertService.playTimesUpAlert('Fin du temps de négociation !');
        }
        return next;
      });
      this.cd.detectChanges();
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  clearMessages(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  formatTime(totalSec: number): string {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
