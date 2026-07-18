import { ChangeDetectorRef, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { environment } from 'src/environments/environment';

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
  imports: [CommonModule, FormsModule, SharedModule, RouterModule],
  templateUrl: './pitching-challenge.component.html',
  styleUrls: ['./pitching-challenge.component.scss']
})
export class PitchingChallengeComponent implements OnInit {
  private http = inject(HttpClient);
  private cd = inject(ChangeDetectorRef);

  pageState = signal<'select' | 'generating' | 'result'>('select');
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  analyses = signal<ModuleAnalysis[]>([]);
  selectedAnalysis = signal<ModuleAnalysis | null>(null);
  viewingAnalysis = signal<ModuleAnalysis | null>(null);

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
    'creer': '#8b5cf6'
  };

  ngOnInit(): void {
    this.loadAnalyses();
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

  generateChallenge(): void {
    const analysis = this.selectedAnalysis();
    if (!analysis) return;

    this.pageState.set('generating');
    this.isLoading.set(true);
    this.errorMessage.set('');

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

  backToSelect(): void {
    this.pageState.set('select');
    this.pitchingResult.set(null);
    this.errorMessage.set('');
  }
}
