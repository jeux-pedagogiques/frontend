import { ChangeDetectorRef, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { environment } from 'src/environments/environment';
import { ShareService } from 'src/app/theme/shared/service/share.service';

interface ModuleAnalysis {
  id: number;
  module_title: string;
  key_concepts: string[];
  keywords: string[];
  created_at?: string;
}

interface RoleInfo {
  nom_role: string;
  objectifs: string;
  infos_privees: string;
  contraintes_secretes: string;
}

interface QuestionDecision {
  id: string;
  titre: string;
  description: string;
  choix_possibles?: string[];
}

interface CritereEval {
  critere: string;
  description: string;
  poids: number;
}

interface CasEtudeData {
  id?: number;
  titre: string;
  contexte_scenario: string;
  format_restitution: string;
  roles: RoleInfo[];
  questions_decisions: QuestionDecision[];
  grille_evaluation: CritereEval[];
  module_title?: string;
}

@Component({
  selector: 'app-cas-etude',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, RouterModule],
  templateUrl: './cas-etude.component.html',
  styleUrls: ['./cas-etude.component.scss']
})
export class CasEtudeComponent implements OnInit {
  private http = inject(HttpClient);
  private cd = inject(ChangeDetectorRef);
  private shareService = inject(ShareService);

  pageState = signal<'select' | 'generating' | 'result'>('select');
  isLoading = signal(false);
  isGenerating = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  analyses = signal<ModuleAnalysis[]>([]);
  selectedAnalysis = signal<ModuleAnalysis | null>(null);

  nbRoles = 3;
  formatRestitution = 'oral';

  casResult = signal<CasEtudeData | null>(null);
  activeTab = signal<'scenario' | 'roles' | 'questions' | 'grille'>('scenario');

  shareLink = signal('');
  shareCopied = signal(false);
  shareResults = signal<any[]>([]);
  showResults = signal(false);

  private apiUrl = `${environment.apiUrl}/api`;

  ngOnInit(): void {
    this.loadAnalyses();
  }

  loadAnalyses(): void {
    this.isLoading.set(true);
    this.http.get<ModuleAnalysis[]>(`${this.apiUrl}/modules/history`).subscribe({
      next: (data) => {
        this.analyses.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Erreur lors du chargement des fiches de cours.');
        this.isLoading.set(false);
      }
    });
  }

  selectAnalysis(item: ModuleAnalysis): void {
    this.selectedAnalysis.set(item);
  }

  generateCasEtude(): void {
    const analysis = this.selectedAnalysis();
    if (!analysis) {
      this.errorMessage.set('Veuillez sélectionner un module.');
      return;
    }

    this.isGenerating.set(true);
    this.errorMessage.set('');
    this.pageState.set('generating');

    const body = {
      module_id: analysis.id,
      nb_roles: this.nbRoles,
      format_restitution: this.formatRestitution
    };

    this.http.post<any>(`${this.apiUrl}/cas-etude/generate`, body).subscribe({
      next: (res) => {
        this.casResult.set({
          id: res.id,
          titre: res.titre,
          contexte_scenario: res.contexte_scenario,
          format_restitution: res.format_restitution,
          roles: res.roles || [],
          questions_decisions: res.questions_decisions || [],
          grille_evaluation: res.grille_evaluation || [],
          module_title: analysis.module_title
        });
        this.isGenerating.set(false);
        this.pageState.set('result');
        this.cd.detectChanges();
      },
      error: (err) => {
        this.isGenerating.set(false);
        this.pageState.set('select');
        this.errorMessage.set(err.error?.detail || "Erreur lors de la génération de l'étude de cas.");
        this.cd.detectChanges();
      }
    });
  }

  backToSelect(): void {
    this.pageState.set('select');
    this.casResult.set(null);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.shareLink.set('');
    this.showResults.set(false);
  }

  shareGame(): void {
    const cas = this.casResult();
    if (!cas || !cas.id) return;
    this.shareService.createShare('cas_etude', cas.id).subscribe({
      next: (res) => {
        const url = `${window.location.origin}/play/cas_etude/${res.share_token}`;
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
    const cas = this.casResult();
    if (!cas || !cas.id) return;
    this.shareService.getResults('cas_etude', cas.id).subscribe({
      next: (res) => {
        this.shareResults.set(res.results);
        this.showResults.set(true);
      },
      error: () => this.errorMessage.set('Erreur lors du chargement des résultats'),
    });
  }
}
