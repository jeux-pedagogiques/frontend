import { ChangeDetectorRef, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  estimated_duration?: string | null;
  target_audience?: string | null;
  module_summary?: string | null;
  original_content?: string | null;
  quiz_data?: Record<string, unknown>;
  created_at?: string;
}

interface Enigme {
  id: string;
  ordre: number;
  aa_source: string;
  niveau_bloom: number;
  enonce: string;
  type_enigme: string;
  solution: string;
  indice_optionnel: string;
  penalite_indice: number;
  code_deverrouillage_suivant: string;
}

interface EscapeRoomData {
  titre_escape_room: string;
  scenario_intro: string;
  enigmes: Enigme[];
  resolution_finale: string;
  duree_estimee_minutes: number;
  fiche_animateur: string;
  fiche_participant: string;
  grille_evaluation: {
    criteres: string[];
    bareme_temps: string;
  };
}

interface EscapeRoomResponse {
  id: number;
  user_id: number;
  analysis_id: number | null;
  titre_escape_room: string;
  scenario_intro: string;
  duree_estimee_minutes: number;
  nb_enigmes: number;
  difficulte: string;
  mode: string;
  module_title: string | null;
  escape_room_data: EscapeRoomData;
  created_at: string;
}

@Component({
  selector: 'app-escape-room',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, RouterModule],
  templateUrl: './escape-room.component.html',
  styleUrls: ['./escape-room.component.scss']
})
export class EscapeRoomComponent implements OnInit {
  private http = inject(HttpClient);
  private cd = inject(ChangeDetectorRef);
  private shareService = inject(ShareService);

  // State
  pageState = signal<'select' | 'generating' | 'result' | 'quiz-result' | 'history'>('select');
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  // Module analyses list
  analyses = signal<ModuleAnalysis[]>([]);
  selectedAnalysis = signal<ModuleAnalysis | null>(null);
  viewingAnalysis = signal<ModuleAnalysis | null>(null);

  // Generation parameters
  nbEnigmes = 5;
  difficulte = 'moyen';
  mode = 'collaboratif';
  dureeTotale = 45;
  nbEquipes = 3;
  selectedModel = signal('bai/glm-5.3-flash');

  // Quiz generation parameters
  quizQuestionsCount = 5;
  quizDurationPerQuestion = 30;
  quizMode = 'formatif';
  quizQuestionTypes = { qcm: true, vrai_faux: true, question_ouverte: false, association: false };
  isGeneratingQuiz = signal(false);
  generatedQuiz = signal<any | null>(null);
  quizActiveTab = signal<'questions' | 'animateur' | 'participant' | 'debriefing'>('questions');
  quizParamsExpanded = signal(false);

  // Generated escape room
  generatedRoom = signal<EscapeRoomResponse | null>(null);

  // History
  historyList = signal<EscapeRoomResponse[]>([]);

  // Active tab in result view
  activeTab = signal<'scenario' | 'enigmes' | 'animateur' | 'participant' | 'evaluation'>('scenario');

  // Expanded enigmes for accordion
  expandedEnigme = signal<string | null>(null);

  private apiUrl = `${environment.apiUrl}/api`;

  // Bloom level display info
  bloomLevels: Record<string, { label: string; color: string; icon: string }> = {
    'memoriser': { label: '[L1] Mémoriser', color: '#ef4444', icon: '🧠' },
    'comprendre': { label: '[L2] Comprendre', color: '#f97316', icon: '💡' },
    'appliquer': { label: '[L3] Appliquer', color: '#facc15', icon: '⚙️' },
    'analyser': { label: '[L4] Analyser', color: '#22c55e', icon: '🔍' },
    'evaluer': { label: '[L5] Évaluer', color: '#3b82f6', icon: '⚖️' },
    'creer': { label: '[L6] Créer', color: '#9f1010', icon: '🎨' }
  };

  // Bloom level numeric mapping
  bloomNumeric: Record<number, string> = {
    1: 'memoriser', 2: 'comprendre', 3: 'appliquer',
    4: 'analyser', 5: 'evaluer', 6: 'creer'
  };

  ngOnInit(): void {
    this.loadAnalyses();
  }

  loadAnalyses(): void {
    this.http.get<ModuleAnalysis[]>(`${this.apiUrl}/modules/history`).subscribe({
      next: (data) => {
        const normalized = (data || []).map(a => ({
          ...a,
          learning_outcomes: Array.isArray(a.learning_outcomes) ? a.learning_outcomes : [],
          key_concepts: Array.isArray(a.key_concepts) ? a.key_concepts : [],
          keywords: Array.isArray(a.keywords) ? a.keywords : []
        }));
        this.analyses.set(normalized);
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
    this.pageState.set('select');
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
      this.pageState.set('select');
    }
  }

  clearMessages(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  getBloomInfo(level: string): { label: string; color: string; icon: string } {
    return this.bloomLevels[level] || { label: level, color: '#6b7280', icon: '📌' };
  }

  getBloomInfoByNumeric(num: number): { label: string; color: string; icon: string } {
    const level = this.bloomNumeric[num] || 'comprendre';
    return this.getBloomInfo(level);
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'code': return 'feather icon-code';
      case 'question': return 'feather icon-help-circle';
      case 'manipulation': return 'feather icon-hand';
      case 'association': return 'feather icon-link';
      default: return 'feather icon-circle';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'code': return 'Code';
      case 'question': return 'Question';
      case 'manipulation': return 'Manipulation';
      case 'association': return 'Association';
      default: return type;
    }
  }

  toggleEnigme(id: string): void {
    this.expandedEnigme.set(this.expandedEnigme() === id ? null : id);
  }

  generateEscapeRoom(): void {
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
      analysis_id: analysis.id,
      nb_enigmes: this.nbEnigmes,
      difficulte: this.difficulte,
      mode: this.mode,
      duree_totale: this.dureeTotale,
      nb_equipes: this.nbEquipes,
      model: this.selectedModel(),
    };

    this.http.post<EscapeRoomResponse>(`${this.apiUrl}/escape-rooms/generate`, payload).subscribe({
      next: (result) => {
        this.generatedRoom.set(result);
        this.pageState.set('result');
        this.isLoading.set(false);
        this.successMessage.set("Escape room généré avec succès !");
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || "Erreur lors de la génération de l'escape room.");
        this.pageState.set('select');
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  loadHistory(): void {
    this.pageState.set('history');
    this.isLoading.set(true);
    this.clearMessages();

    this.http.get<EscapeRoomResponse[]>(`${this.apiUrl}/escape-rooms/history`).subscribe({
      next: (data) => {
        this.historyList.set(data);
        this.isLoading.set(false);
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Erreur lors du chargement de l\'historique.');
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  viewRoom(room: EscapeRoomResponse): void {
    this.generatedRoom.set(room);
    this.pageState.set('result');
    this.cd.detectChanges();
  }

  deleteRoom(id: number, event: Event): void {
    event.stopPropagation();
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet escape room ?')) return;

    this.http.delete(`${this.apiUrl}/escape-rooms/${id}`).subscribe({
      next: () => {
        this.historyList.set(this.historyList().filter(r => r.id !== id));
        this.successMessage.set('Escape room supprimé.');
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Erreur lors de la suppression.');
        this.cd.detectChanges();
      }
    });
  }

  backToSelect(): void {
    this.pageState.set('select');
    this.generatedRoom.set(null);
    this.selectedAnalysis.set(null);
    this.clearMessages();
  }

  backToHistory(): void {
    this.pageState.set('history');
    this.loadHistory();
  }

  getDifficultyColor(diff: string): string {
    switch (diff) {
      case 'facile': return '#22c55e';
      case 'moyen': return '#eab308';
      case 'difficile': return '#ef4444';
      default: return '#6b7280';
    }
  }

  getDifficultyLabel(diff: string): string {
    switch (diff) {
      case 'facile': return 'Facile';
      case 'moyen': return 'Moyen';
      case 'difficile': return 'Difficile';
      default: return diff;
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  formatNewlines(text: string): string {
    if (!text) return '';
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    return escaped.replace(/\n/g, '<br>');
  }

  clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  // ========== QUIZ GENERATION ==========

  generateQuiz(): void {
    const analysis = this.selectedAnalysis();
    if (!analysis) {
      this.errorMessage.set("Veuillez sélectionner une fiche module analysée.");
      return;
    }

    const types: string[] = [];
    if (this.quizQuestionTypes.qcm) types.push('qcm');
    if (this.quizQuestionTypes.vrai_faux) types.push('vrai_faux');
    if (this.quizQuestionTypes.question_ouverte) types.push('question_ouverte');
    if (this.quizQuestionTypes.association) types.push('association');

    if (types.length === 0) {
      this.errorMessage.set("Veuillez sélectionner au moins un type de question.");
      return;
    }

    this.isGeneratingQuiz.set(true);
    this.generatedQuiz.set(null);
    this.clearMessages();
    this.cd.detectChanges();

    const payload = {
      nb_questions: this.quizQuestionsCount,
      duree_par_question: this.quizDurationPerQuestion,
      mode: this.quizMode,
      question_types: types,
      force: true
    };

    this.http.post<Record<string, unknown>>(`${this.apiUrl}/modules/history/${analysis.id}/quiz`, payload).subscribe({
      next: (quiz) => {
        this.generatedQuiz.set(quiz);
        this.isGeneratingQuiz.set(false);
        this.pageState.set('quiz-result');
        this.successMessage.set("Quiz généré avec succès !");
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || "Erreur lors de la génération du quiz.");
        this.isGeneratingQuiz.set(false);
        this.cd.detectChanges();
      }
    });
  }

  backToSelectFromQuiz(): void {
    this.pageState.set('select');
    this.generatedQuiz.set(null);
    this.clearMessages();
  }

  // ─── Share & Results ───
  shareLink = signal('');
  shareCopied = signal(false);
  shareResults = signal<any[]>([]);
  showResults = signal(false);

  shareGame(roomId: number): void {
    this.shareService.createShare('escape_room', roomId).subscribe({
      next: (res) => {
        const url = `${window.location.origin}/#/play/escape_room/${res.share_token}`;
        this.shareLink.set(url);
        navigator.clipboard.writeText(url).then(() => {
          this.shareCopied.set(true);
          setTimeout(() => this.shareCopied.set(false), 3000);
        });
      },
      error: () => this.errorMessage.set('Erreur lors de la création du lien de partage'),
    });
  }

  viewResults(roomId: number): void {
    this.shareService.getResults('escape_room', roomId).subscribe({
      next: (res) => {
        this.shareResults.set(res.results);
        this.showResults.set(true);
      },
      error: () => this.errorMessage.set('Erreur lors du chargement des résultats'),
    });
  }
}
