import { ChangeDetectorRef, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { environment } from 'src/environments/environment';

interface ModuleAnalysis {
  id: number;
  module_title: string;
  learning_outcomes: { id: number; description: string; bloom_level: string }[];
  key_concepts: string[];
  keywords: string[];
  module_summary?: string | null;
  created_at?: string;
}

interface FlashcardSetResponse {
  id: number;
  module_id: number;
  module_title: string | null;
  titre: string;
  nb_cartes: number;
  created_at: string;
}

interface FlashcardResponse {
  id: number;
  set_id: number;
  recto: string;
  verso: string;
  aa_source: string;
  niveau_bloom: string;
  ordre: number;
}

interface FlashcardSessionResponse {
  set_id: number;
  titre: string;
  module_title: string | null;
  cartes: FlashcardResponse[];
  total_cartes: number;
  cartes_a_revoir: number;
}

interface FlashcardStatsResponse {
  set_id: number;
  total_reviews: number;
  bien_su_count: number;
  mal_su_count: number;
  taux_memorisation: number;
  stats_par_aa: { aa_source: string; total: number; bien_su: number; mal_su: number; taux: number }[];
}

@Component({
  selector: 'app-flashcards',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, RouterModule],
  templateUrl: './flashcards.component.html',
  styleUrls: ['./flashcards.component.scss']
})
export class FlashcardsComponent implements OnInit {
  private http = inject(HttpClient);
  private cd = inject(ChangeDetectorRef);

  pageState = signal<'select' | 'generating' | 'result' | 'session' | 'history'>('select');
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  analyses = signal<ModuleAnalysis[]>([]);
  selectedAnalysis = signal<ModuleAnalysis | null>(null);
  viewingAnalysis = signal<ModuleAnalysis | null>(null);

  nbCartes = 20;
  participantName = '';

  generatedSet = signal<FlashcardSetResponse | null>(null);

  // Session state
  sessionData = signal<FlashcardSessionResponse | null>(null);
  currentCardIndex = signal(0);
  isFlipped = signal(false);
  sessionComplete = signal(false);
  bienCount = signal(0);
  malCount = signal(0);

  // History
  historyList = signal<FlashcardSetResponse[]>([]);

  // Stats
  stats = signal<FlashcardStatsResponse | null>(null);

  // Bloom levels
  bloomLevels: Record<string, { label: string; color: string; icon: string }> = {
    'memoriser': { label: 'Mémoriser', color: '#ef4444', icon: '🧠' },
    'comprendre': { label: 'Comprendre', color: '#f97316', icon: '💡' },
    'appliquer': { label: 'Appliquer', color: '#eab308', icon: '⚙️' },
    'analyser': { label: 'Analyser', color: '#22c55e', icon: '🔍' },
    'evaluer': { label: 'Évaluer', color: '#3b82f6', icon: '⚖️' },
    'creer': { label: 'Créer', color: '#8b5cf6', icon: '🎨' }
  };

  private apiUrl = `${environment.apiUrl}/api`;

  ngOnInit(): void {
    this.loadAnalyses();
  }

  loadAnalyses(): void {
    this.http.get<ModuleAnalysis[]>(`${this.apiUrl}/modules/history`).subscribe({
      next: (data) => {
        this.analyses.set(data);
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Erreur lors du chargement des analyses.');
        this.cd.detectChanges();
      }
    });
  }

  selectAnalysis(analysis: ModuleAnalysis): void {
    this.selectedAnalysis.set(analysis);
    this.clearMessages();
  }

  viewAnalysis(analysis: ModuleAnalysis, event: Event): void {
    event.stopPropagation();
    this.viewingAnalysis.set(analysis);
  }

  closeAnalysisDetail(): void {
    this.viewingAnalysis.set(null);
  }

  useAnalysisFromDetail(): void {
    const analysis = this.viewingAnalysis();
    if (analysis) {
      this.selectedAnalysis.set(analysis);
      this.viewingAnalysis.set(null);
    }
  }

  clearMessages(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  getBloomInfo(level: string): { label: string; color: string; icon: string } {
    return this.bloomLevels[level] || { label: level, color: '#6b7280', icon: '📌' };
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  // ========== GENERATE ==========

  generateFlashcards(): void {
    const analysis = this.selectedAnalysis();
    if (!analysis) {
      this.errorMessage.set("Veuillez sélectionner une fiche module analysée.");
      return;
    }

    this.pageState.set('generating');
    this.isLoading.set(true);
    this.clearMessages();
    this.cd.detectChanges();

    const payload = {
      module_id: analysis.id,
      nb_cartes: this.nbCartes,
    };

    this.http.post<FlashcardSetResponse>(`${this.apiUrl}/flashcards/generate`, payload).subscribe({
      next: (result) => {
        this.generatedSet.set(result);
        this.isLoading.set(false);
        this.loadSetCards(result.id);
        this.successMessage.set("Flashcards générées avec succès !");
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || "Erreur lors de la génération des flashcards.");
        this.pageState.set('select');
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  // ========== SESSION ==========

  loadSetCards(setId: number): void {
    const name = this.participantName.trim() || 'Professeur';
    this.http.get<FlashcardSessionResponse>(
      `${this.apiUrl}/flashcards/${setId}/session`,
      { params: { participant_name: name, nb_cartes: this.nbCartes.toString() } }
    ).subscribe({
      next: (data) => {
        this.sessionData.set(data);
        this.currentCardIndex.set(0);
        this.isFlipped.set(false);
        this.sessionComplete.set(false);
        this.bienCount.set(0);
        this.malCount.set(0);
        this.pageState.set('session');
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || "Erreur lors du chargement des cartes.");
        this.cd.detectChanges();
      }
    });
  }

  flipCard(): void {
    this.isFlipped.set(!this.isFlipped());
  }

  reviewCard(statut: 'bien_su' | 'mal_su'): void {
    const session = this.sessionData();
    const cards = session?.cartes;
    if (!cards) return;

    const card = cards[this.currentCardIndex()];
    if (!card) return;

    const name = this.participantName.trim() || 'Professeur';

    this.http.post(`${this.apiUrl}/flashcards/${card.id}/review`, {
      statut: statut,
      participant_name: name,
    }).subscribe({
      next: () => {
        if (statut === 'bien_su') {
          this.bienCount.set(this.bienCount() + 1);
        } else {
          this.malCount.set(this.malCount() + 1);
        }

        const nextIdx = this.currentCardIndex() + 1;
        if (nextIdx < cards.length) {
          this.currentCardIndex.set(nextIdx);
          this.isFlipped.set(false);
        } else {
          this.sessionComplete.set(true);
          this.loadStats(session.set_id);
        }
        this.cd.detectChanges();
      },
      error: () => {
        // Still advance the card on error
        const nextIdx = this.currentCardIndex() + 1;
        if (nextIdx < cards.length) {
          this.currentCardIndex.set(nextIdx);
          this.isFlipped.set(false);
        } else {
          this.sessionComplete.set(true);
        }
        this.cd.detectChanges();
      }
    });
  }

  // ========== STATS ==========

  loadStats(setId: number): void {
    this.http.get<FlashcardStatsResponse>(`${this.apiUrl}/flashcards/${setId}/stats`).subscribe({
      next: (data) => {
        this.stats.set(data);
        this.cd.detectChanges();
      },
      error: () => {}
    });
  }

  // ========== HISTORY ==========

  loadHistory(): void {
    this.pageState.set('history');
    this.isLoading.set(true);
    this.clearMessages();

    this.http.get<FlashcardSetResponse[]>(`${this.apiUrl}/flashcards/sets`).subscribe({
      next: (data) => {
        this.historyList.set(data);
        this.isLoading.set(false);
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || "Erreur lors du chargement de l'historique.");
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  viewSetFromHistory(set: FlashcardSetResponse): void {
    this.generatedSet.set(set);
    this.loadSetCards(set.id);
  }

  deleteSet(id: number, event: Event): void {
    event.stopPropagation();
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce jeu de flashcards ?')) return;

    this.http.delete(`${this.apiUrl}/flashcards/${id}`).subscribe({
      next: () => {
        this.historyList.set(this.historyList().filter(s => s.id !== id));
        this.successMessage.set('Jeu de flashcards supprimé.');
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Erreur lors de la suppression.');
        this.cd.detectChanges();
      }
    });
  }

  // ========== NAVIGATION ==========

  backToSelect(): void {
    this.pageState.set('select');
    this.generatedSet.set(null);
    this.sessionData.set(null);
    this.stats.set(null);
    this.selectedAnalysis.set(null);
    this.clearMessages();
  }

  backToSelectFromSession(): void {
    this.pageState.set('select');
    this.sessionData.set(null);
    this.stats.set(null);
    this.clearMessages();
  }

  backToHistory(): void {
    this.pageState.set('history');
    this.loadHistory();
  }

  startNewSession(): void {
    const set = this.generatedSet();
    if (set) {
      this.loadSetCards(set.id);
    }
  }

  // ========== TEMPLATE HELPERS ==========

  getCurrentCard(): FlashcardResponse | null {
    const session = this.sessionData();
    if (!session) return null;
    return session.cartes[this.currentCardIndex()] || null;
  }

  getProgressPercent(): number {
    const session = this.sessionData();
    if (!session || session.cartes.length === 0) return 0;
    return ((this.currentCardIndex() + 1) / session.cartes.length) * 100;
  }

  getTotalCards(): number {
    return this.sessionData()?.cartes.length || 0;
  }
}
