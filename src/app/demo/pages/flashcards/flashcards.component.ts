import { ChangeDetectorRef, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { environment } from 'src/environments/environment';

import { RamCacheService } from 'src/app/theme/shared/service/ram-cache.service';
import { ShareService } from 'src/app/theme/shared/service/share.service';

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
  private ramCache = inject(RamCacheService);
  private shareService = inject(ShareService);

  pageState = signal<'select' | 'generating' | 'result' | 'session' | 'history' | 'consult'>('select');
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  analyses = signal<ModuleAnalysis[]>([]);
  isAnalysesLoading = signal(true);
  selectedAnalysis = signal<ModuleAnalysis | null>(null);
  viewingAnalysis = signal<ModuleAnalysis | null>(null);

  nbCartes = 20;
  selectedModel = signal('bai/glm-5.3-flash');
  participantName = '';

  generatedSet = signal<FlashcardSetResponse | null>(null);

  // Session state
  sessionData = signal<FlashcardSessionResponse | null>(null);
  currentCardIndex = signal(0);
  isFlipped = signal(false);
  sessionComplete = signal(false);
  bienCount = signal(0);
  malCount = signal(0);

  // History & Search
  historyList = signal<FlashcardSetResponse[]>([]);
  historySearch = signal('');

  // Consult state
  consultSet = signal<FlashcardSessionResponse | null>(null);
  consultCardIndex = signal(0);
  isConsultFlipped = signal(false);
  consultTab = signal<'cards' | 'table' | 'stats'>('cards');

  // Stats
  stats = signal<FlashcardStatsResponse | null>(null);

  // Bloom levels
  bloomLevels: Record<string, { label: string; color: string; icon: string }> = {
    'memoriser': { label: '[L1] Mémoriser', color: '#ef4444', icon: '🧠' },
    'comprendre': { label: '[L2] Comprendre', color: '#f97316', icon: '💡' },
    'appliquer': { label: '[L3] Appliquer', color: '#facc15', icon: '⚙️' },
    'analyser': { label: '[L4] Analyser', color: '#22c55e', icon: '🔍' },
    'evaluer': { label: '[L5] Évaluer', color: '#3b82f6', icon: '⚖️' },
    'creer': { label: '[L6] Créer', color: '#9f1010', icon: '🎨' }
  };

  private apiUrl = `${environment.apiUrl}/api`;

  ngOnInit(): void {
    this.loadAnalyses();
    this.loadHistoryList();
  }

  loadAnalyses(): void {
    const cached = this.ramCache.get<ModuleAnalysis[]>('module_analyses');
    if (cached) {
      this.analyses.set(cached);
      this.isAnalysesLoading.set(false);
    } else {
      this.isAnalysesLoading.set(true);
    }

    this.http.get<ModuleAnalysis[]>(`${this.apiUrl}/modules/history`).subscribe({
      next: (data) => {
        this.analyses.set(data);
        this.ramCache.set('module_analyses', data);
        this.isAnalysesLoading.set(false);
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Erreur lors du chargement des analyses.');
        this.isAnalysesLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  loadHistoryList(): void {
    const cached = this.ramCache.get<FlashcardSetResponse[]>('flashcard_sets');
    if (cached) {
      this.historyList.set(cached);
    }

    this.http.get<FlashcardSetResponse[]>(`${this.apiUrl}/flashcards/sets`).subscribe({
      next: (data) => {
        this.historyList.set(data);
        this.ramCache.set('flashcard_sets', data);
        this.cd.detectChanges();
      },
      error: () => {}
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
      model: this.selectedModel(),
    };

    this.http.post<FlashcardSetResponse>(`${this.apiUrl}/flashcards/generate`, payload).subscribe({
      next: (result) => {
        this.generatedSet.set(result);
        this.isLoading.set(false);
        this.loadSetCards(result.id);
        this.loadHistoryList();
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
    const cacheKey = `flashcard_session_${setId}_${name}_${this.nbCartes}`;

    const cached = this.ramCache.get<FlashcardSessionResponse>(cacheKey);
    if (cached) {
      this.sessionData.set(cached);
      this.currentCardIndex.set(0);
      this.isFlipped.set(false);
      this.sessionComplete.set(false);
      this.bienCount.set(0);
      this.malCount.set(0);
      this.pageState.set('session');
      this.cd.detectChanges();
      return;
    }

    // Switch page state instantly (0ms latency for smooth UI response)
    this.sessionData.set(null);
    this.currentCardIndex.set(0);
    this.isFlipped.set(false);
    this.sessionComplete.set(false);
    this.bienCount.set(0);
    this.malCount.set(0);
    this.pageState.set('session');
    this.isLoading.set(true);
    this.cd.detectChanges();

    this.http.get<FlashcardSessionResponse>(
      `${this.apiUrl}/flashcards/${setId}/session`,
      { params: { participant_name: name, nb_cartes: this.nbCartes.toString() } }
    ).subscribe({
      next: (data) => {
        this.sessionData.set(data);
        this.ramCache.set(cacheKey, data);
        this.isLoading.set(false);
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || "Erreur lors du chargement des cartes.");
        this.isLoading.set(false);
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

    // 1. INSTANT OPTIMISTIC UI ADVANCE (0ms latency for smooth experience)
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

    // 2. Asynchronous background network sync
    const name = this.participantName.trim() || 'Professeur';
    this.http.post(`${this.apiUrl}/flashcards/${card.id}/review`, {
      statut: statut,
      participant_name: name,
    }).subscribe({
      error: (err) => console.warn('Background card review sync warning:', err)
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

  // ========== HISTORY & CONSULTATION ==========

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

  getFilteredHistory(): FlashcardSetResponse[] {
    const q = this.historySearch().toLowerCase().trim();
    if (!q) return this.historyList();
    return this.historyList().filter(s =>
      (s.titre && s.titre.toLowerCase().includes(q)) ||
      (s.module_title && s.module_title.toLowerCase().includes(q))
    );
  }

  consultSetFromHistory(set: FlashcardSetResponse, event?: Event): void {
    if (event) event.stopPropagation();
    this.clearMessages();

    const cacheKey = `flashcard_consult_${set.id}`;
    const cached = this.ramCache.get<FlashcardSessionResponse>(cacheKey);
    if (cached) {
      this.consultSet.set(cached);
      this.consultCardIndex.set(0);
      this.isConsultFlipped.set(false);
      this.consultTab.set('cards');
      this.pageState.set('consult');
      this.loadStats(set.id);
      this.cd.detectChanges();
      return;
    }

    // Switch page state instantly (0ms latency for smooth UI response)
    this.consultSet.set(null);
    this.consultCardIndex.set(0);
    this.isConsultFlipped.set(false);
    this.consultTab.set('cards');
    this.pageState.set('consult');
    this.isLoading.set(true);
    this.cd.detectChanges();

    this.http.get<FlashcardSessionResponse>(`${this.apiUrl}/flashcards/${set.id}`).subscribe({
      next: (data) => {
        this.consultSet.set(data);
        this.ramCache.set(cacheKey, data);
        this.loadStats(set.id);
        this.isLoading.set(false);
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || "Erreur lors du chargement des détails du jeu.");
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  nextConsultCard(): void {
    const set = this.consultSet();
    if (set && this.consultCardIndex() < set.cartes.length - 1) {
      this.isConsultFlipped.set(false);
      this.consultCardIndex.set(this.consultCardIndex() + 1);
    }
  }

  prevConsultCard(): void {
    if (this.consultCardIndex() > 0) {
      this.isConsultFlipped.set(false);
      this.consultCardIndex.set(this.consultCardIndex() - 1);
    }
  }

  flipConsultCard(): void {
    this.isConsultFlipped.set(!this.isConsultFlipped());
  }

  getCurrentConsultCard(): FlashcardResponse | null {
    const set = this.consultSet();
    if (!set || set.cartes.length === 0) return null;
    return set.cartes[this.consultCardIndex()] || null;
  }

  startSessionFromConsult(): void {
    const set = this.consultSet();
    if (set) {
      this.generatedSet.set({
        id: set.set_id,
        module_id: 0,
        module_title: set.module_title,
        titre: set.titre,
        nb_cartes: set.total_cartes,
        created_at: new Date().toISOString()
      });
      this.loadSetCards(set.set_id);
    }
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

  // ─── Share & Results ───
  shareLink = signal('');
  shareCopied = signal(false);
  shareResults = signal<any[]>([]);
  showResults = signal(false);

  shareGame(setId: number): void {
    this.shareService.createShare('flashcards', setId).subscribe({
      next: (res) => {
        const url = `${window.location.origin}/play/flashcards/${res.share_token}`;
        this.shareLink.set(url);
        navigator.clipboard.writeText(url).then(() => {
          this.shareCopied.set(true);
          setTimeout(() => this.shareCopied.set(false), 3000);
        });
      },
      error: () => this.errorMessage.set('Erreur lors de la création du lien de partage'),
    });
  }

  viewResults(setId: number): void {
    this.shareService.getResults('flashcards', setId).subscribe({
      next: (res) => {
        this.shareResults.set(res.results);
        this.showResults.set(true);
      },
      error: () => this.errorMessage.set('Erreur lors du chargement des résultats'),
    });
  }
}

