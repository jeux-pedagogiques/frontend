import { ChangeDetectorRef, Component, inject, signal, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { environment } from 'src/environments/environment';
import { ShareService } from 'src/app/theme/shared/service/share.service';

interface LearningOutcome {
  id: number;
  description: string;
  bloom_level: string;
  bloom_justification: string;
}

interface ModuleAnalysis {
  id: number;
  module_title: string;
  learning_outcomes: LearningOutcome[];
  key_concepts: string[];
  keywords: string[];
  central_notions?: string[];
  created_at?: string;
}

interface CritereVote {
  critere: string;
  description: string;
}

interface PitchingData {
  titre_challenge: string;
  sujet_principal: string;
  sujets_par_equipe: string[] | null;
  aa_cibles: string[];
  criteres_vote: CritereVote[];
  grille_feedback: {
    points_positifs: string;
    axes_amelioration: string;
    note_synthese: string;
  };
  questions_debriefing: string[];
  fiche_animateur: string;
  fiche_participant: string;
  module_title?: string;
}

@Component({
  selector: 'app-pitching-challenge',
  standalone: true,
  imports: [FormsModule, SharedModule, RouterModule],
  templateUrl: './pitching-challenge.component.html',
  styleUrls: ['./pitching-challenge.component.scss']
})
export class PitchingChallengeComponent implements OnInit {
  private http = inject(HttpClient);
  private cd = inject(ChangeDetectorRef);
  private shareService = inject(ShareService);

  pageState = signal<'select' | 'generating' | 'result' | 'history'>('select');
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  analyses = signal<ModuleAnalysis[]>([]);
  selectedAnalysis = signal<ModuleAnalysis | null>(null);
  viewingAnalysis = signal<ModuleAnalysis | null>(null);

  // History & Consultation
  historyList = signal<any[]>([]);
  historySearch = signal<string>('');

  nbEquipes = 4;
  dureePreparation = 10;
  dureePitch = 3;
  dureeFeedback = 5;

  pitchingResult = signal<PitchingData | null>(null);
  moduleTitle = signal<string>('');

  activeTab = signal<'sujet' | 'criteres' | 'feedback' | 'debriefing' | 'fiches'>('sujet');

  private apiUrl = `${environment.apiUrl}/api`;

  bloomLabels: Record<string, string> = {
    'memoriser': 'Memoriser',
    'comprendre': 'Comprendre',
    'appliquer': 'Appliquer',
    'analyser': 'Analyser',
    'evaluer': 'Evaluer',
    'creer': 'Creer'
  };

  bloomColors: Record<string, string> = {
    'memoriser': '#ef4444',
    'comprendre': '#f97316',
    'appliquer': '#eab308',
    'analyser': '#22c55e',
    'evaluer': '#3b82f6',
    'creer': '#9f1010'
  };

  ngOnInit(): void {
    this.loadAnalyses();
    this.loadSavedSessions();
  }

  loadAnalyses(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.http.get<any[]>(`${this.apiUrl}/modules/history`).subscribe({
      next: (data) => {
        const mapped: ModuleAnalysis[] = data.map((d: any) => ({
          id: d.id,
          module_title: d.module_title,
          learning_outcomes: d.learning_outcomes || [],
          key_concepts: d.key_concepts || [],
          keywords: d.keywords || [],
          central_notions: d.central_notions || [],
          created_at: d.created_at
        }));
        this.analyses.set(mapped);
        this.isLoading.set(false);
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Erreur lors du chargement des modules.');
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  loadSavedSessions(): void {
    this.http.get<any[]>(`${this.apiUrl}/pitching/sessions`).subscribe({
      next: (data) => {
        this.historyList.set(data || []);
        this.cd.detectChanges();
      },
      error: () => {}
    });
  }

  switchToHistory(): void {
    this.pageState.set('history');
    this.loadSavedSessions();
  }

  consultSession(sessionId: number): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.http.get<any>(`${this.apiUrl}/pitching/sessions/${sessionId}`).subscribe({
      next: (res) => {
        this.pitchingResult.set(res.data);
        this.confirmedId.set(res.id);
        this.isConfirmed.set(true);
        this.moduleTitle.set(res.module_title || res.titre);
        this.pageState.set('result');
        this.isLoading.set(false);
        this.activeTab.set('sujet');
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Erreur lors de la consultation du pitching challenge.');
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  deleteSession(sessionId: number, event: Event): void {
    event.stopPropagation();
    if (!confirm('Voulez-vous vraiment supprimer ce pitching challenge ?')) return;

    this.http.delete(`${this.apiUrl}/pitching/sessions/${sessionId}`).subscribe({
      next: () => {
        this.successMessage.set('Pitching challenge supprimé.');
        this.loadSavedSessions();
      },
      error: () => this.errorMessage.set('Erreur lors de la suppression du pitching challenge.')
    });
  }

  selectAnalysis(analysis: ModuleAnalysis): void {
    this.selectedAnalysis.set(analysis);
    this.pageState.set('select');
    this.cd.detectChanges();
  }

  openOverlay(analysis: ModuleAnalysis): void {
    this.viewingAnalysis.set(analysis);
  }

  closeOverlay(): void {
    this.viewingAnalysis.set(null);
  }

  useAnalysisFromOverlay(): void {
    const a = this.viewingAnalysis();
    if (a) {
      this.selectAnalysis(a);
      this.closeOverlay();
    }
  }

  getBloomLabel(level: string): string {
    return this.bloomLabels[level] || level;
  }

  getBloomColor(level: string): string {
    return this.bloomColors[level] || '#6b7280';
  }

  isConfirmed = signal(false);
  isSaving = signal(false);

  generateChallenge(): void {
    const analysis = this.selectedAnalysis();
    if (!analysis) return;

    this.pageState.set('generating');
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isConfirmed.set(false);

    const body = {
      module_id: analysis.id,
      nb_equipes: this.nbEquipes,
      duree_preparation: this.dureePreparation,
      duree_pitch: this.dureePitch,
      duree_feedback: this.dureeFeedback
    };

    this.http.post<PitchingData>(`${this.apiUrl}/pitching/generate`, body).subscribe({
      next: (data) => {
        this.pitchingResult.set(data);
        this.moduleTitle.set(data.module_title || analysis.module_title);
        this.pageState.set('result');
        this.isLoading.set(false);
        this.activeTab.set('sujet');
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Erreur lors de la generation du pitching challenge.');
        this.pageState.set('select');
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  confirmAndSave(): void {
    const result = this.pitchingResult();
    const analysis = this.selectedAnalysis();
    if (!result || !analysis) return;

    this.isSaving.set(true);
    this.errorMessage.set('');

    const body = {
      module_id: analysis.id,
      titre_challenge: result.titre_challenge,
      sujet_principal: result.sujet_principal,
      sujets_par_equipe: result.sujets_par_equipe || [],
      aa_cibles: result.aa_cibles || [],
      criteres_vote: result.criteres_vote || [],
      grille_feedback: result.grille_feedback || {},
      questions_debriefing: result.questions_debriefing || [],
      fiche_animateur: result.fiche_animateur || '',
      fiche_participant: result.fiche_participant || ''
    };

    this.http.post<any>(`${this.apiUrl}/pitching/confirm`, body).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.isConfirmed.set(true);
        this.confirmedId.set(res.id);
        this.successMessage.set('Challenge confirmé et enregistré avec succès dans votre bibliothèque !');
        this.cd.detectChanges();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err.error?.detail || 'Erreur lors de la sauvegarde du challenge.');
        this.cd.detectChanges();
      }
    });
  }

  updateTitle(val: string): void {
    const current = this.pitchingResult();
    if (current) {
      this.pitchingResult.set({ ...current, titre_challenge: val });
    }
  }

  updateSujetPrincipal(val: string): void {
    const current = this.pitchingResult();
    if (current) {
      this.pitchingResult.set({ ...current, sujet_principal: val });
    }
  }

  updateSujetEquipe(index: number, val: string): void {
    const current = this.pitchingResult();
    if (current && current.sujets_par_equipe) {
      const updatedList = [...current.sujets_par_equipe];
      updatedList[index] = val;
      this.pitchingResult.set({ ...current, sujets_par_equipe: updatedList });
    }
  }

  backToSelect(): void {
    this.pageState.set('select');
    this.pitchingResult.set(null);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isConfirmed.set(false);
    this.confirmedId.set(null);
  }

  // ─── Share & Results ───
  confirmedId = signal<number | null>(null);
  shareLink = signal('');
  shareCopied = signal(false);
  shareResults = signal<any[]>([]);
  showResults = signal(false);

  shareGame(): void {
    const id = this.confirmedId();
    if (!id) return;
    this.shareService.createShare('pitching', id).subscribe({
      next: (res) => {
        const url = `${window.location.origin}/play/pitching/${res.share_token}`;
        this.shareLink.set(url);
        navigator.clipboard.writeText(url).then(() => {
          this.shareCopied.set(true);
          setTimeout(() => this.shareCopied.set(false), 3000);
        });
      },
      error: () => this.errorMessage.set('Erreur lors de la création du lien de partage'),
    });
  }

  viewResults(): void {
    const id = this.confirmedId();
    if (!id) return;
    this.shareService.getResults('pitching', id).subscribe({
      next: (res) => {
        this.shareResults.set(res.results);
        this.showResults.set(true);
      },
      error: () => this.errorMessage.set('Erreur lors du chargement des résultats'),
    });
  }
}
