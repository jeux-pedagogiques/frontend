import { ChangeDetectorRef, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { environment } from 'src/environments/environment';

interface ImportResult {
  title: string;
  content: string;
  source: string;
  file_name: string | null;
}

interface LearningOutcome {
  id: number;
  description: string;
  bloom_level: string;
  bloom_justification: string;
}

interface AnalysisResult {
  module_title: string;
  learning_outcomes: LearningOutcome[];
  key_concepts: string[];
  keywords: string[];
  central_notions: string[];
  estimated_duration: string | null;
  target_audience: string | null;
  module_summary: string | null;
}

@Component({
  selector: 'app-import-module',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './import-module.component.html',
  styleUrls: ['./import-module.component.scss']
})
export class ImportModuleComponent implements OnInit {
  private http = inject(HttpClient);
  private cd = inject(ChangeDetectorRef);

  // Page state: 'import' | 'analyzing' | 'validation'
  pageState = signal<'import' | 'analyzing' | 'validation'>('import');

  // State signals
  activeTab = signal<'upload' | 'editor'>('upload');
  isLoading = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  importResult = signal<ImportResult | null>(null);
  historyList = signal<any[]>([]);

  // Search & Pagination for Scan History
  searchQuery = signal('');
  currentPage = signal(1);
  pageSize = 5;

  // AI Analysis
  analysisResult = signal<AnalysisResult | null>(null);
  analysisError = signal('');

  // Quiz states
  loadedAnalysisId = signal<number | null>(null);
  quizQuestionsCount = 5;
  quizDurationPerQuestion = 30;
  quizMode = 'formatif';
  quizQuestionTypes = { qcm: true, vrai_faux: true, question_ouverte: false, association: false };
  isGeneratingQuiz = signal(false);
  generatedQuiz = signal<any | null>(null);
  quizActiveTab = signal<'questions' | 'animateur' | 'participant' | 'debriefing'>('questions');

  // File upload state
  selectedFile: File | null = null;
  isDragOver = signal(false);

  // Editor content
  editorContent = '';
  editorTitle = '';

  // Analysis Parameters
  sensitivity = 'standard';
  outputFormat = 'json';

  private apiUrl = `${environment.apiUrl}/api/modules`;

  // Bloom level labels and colors
  bloomLevels: Record<string, { label: string; color: string; icon: string }> = {
    'memoriser': { label: 'Mémoriser', color: '#ef4444', icon: '🧠' },
    'comprendre': { label: 'Comprendre', color: '#f97316', icon: '💡' },
    'appliquer': { label: 'Appliquer', color: '#eab308', icon: '⚙️' },
    'analyser': { label: 'Analyser', color: '#22c55e', icon: '🔍' },
    'evaluer': { label: 'Évaluer', color: '#3b82f6', icon: '⚖️' },
    'creer': { label: 'Créer', color: '#8b5cf6', icon: '🎨' }
  };

  ngOnInit(): void {
    this.loadHistory();
  }

  setActiveTab(tab: 'upload' | 'editor'): void {
    this.activeTab.set(tab);
    this.clearMessages();
  }

  clearMessages(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  // Filtered & Paginated History helpers
  filteredHistoryList(): any[] {
    const query = this.searchQuery().toLowerCase().trim();
    const list = this.historyList();
    if (!query) return list;
    return list.filter(item => 
      item.module_title?.toLowerCase().includes(query) ||
      item.id?.toString().includes(query) ||
      (item.module_summary && item.module_summary.toLowerCase().includes(query))
    );
  }

  paginatedHistoryList(): any[] {
    const list = this.filteredHistoryList();
    const start = (this.currentPage() - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  }

  totalPages(): number {
    return Math.ceil(this.filteredHistoryList().length / this.pageSize);
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }

  // ========== FILE UPLOAD ==========

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.handleFile(file);
    }
  }

  handleFile(file: File): void {
    const allowedExtensions = ['.pdf', '.docx', '.txt'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowedExtensions.includes(ext)) {
      this.errorMessage.set('Format non supporté. Veuillez utiliser un fichier PDF, Word (.docx) ou Texte (.txt).');
      this.selectedFile = null;
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.errorMessage.set('Le fichier est trop volumineux. Taille maximale : 10 MB.');
      this.selectedFile = null;
      return;
    }

    this.clearMessages();
    this.selectedFile = file;
  }

  removeFile(): void {
    this.selectedFile = null;
    this.clearMessages();
  }

  getFileIcon(): string {
    if (!this.selectedFile) return 'feather icon-file';
    const ext = this.selectedFile.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'feather icon-file-text';
      case 'docx': return 'feather icon-file';
      case 'txt': return 'feather icon-align-left';
      default: return 'feather icon-file';
    }
  }

  getFileSize(): string {
    if (!this.selectedFile) return '';
    const bytes = this.selectedFile.size;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  uploadFile(): void {
    if (!this.selectedFile) return;

    this.isLoading.set(true);
    this.clearMessages();

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    this.http.post<ImportResult>(`${this.apiUrl}/import/file`, formData).subscribe({
      next: (result) => {
        setTimeout(() => {
          this.importResult.set(result);
          this.isLoading.set(false);
          this.cd.detectChanges();
          // Automatically trigger AI analysis
          this.startAnalysis(result.content, result.title);
        });
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Erreur lors de l\'importation du fichier.');
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  // ========== EDITOR INPUT ==========

  submitEditorContent(): void {
    if (!this.editorContent.trim()) {
      this.errorMessage.set('Veuillez saisir du contenu dans l\'éditeur.');
      return;
    }

    this.isLoading.set(true);
    this.clearMessages();

    const payload = { content: this.editorContent, title: this.editorTitle || null };

    this.http.post<ImportResult>(`${this.apiUrl}/import/text`, payload).subscribe({
      next: (result) => {
        setTimeout(() => {
          this.importResult.set(result);
          this.isLoading.set(false);
          this.cd.detectChanges();
          this.startAnalysis(result.content, result.title);
        });
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Erreur lors de l\'importation du contenu.');
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }



  // ========== AI ANALYSIS ==========

  startAnalysis(content: string, title: string): void {
    this.pageState.set('analyzing');
    this.analysisError.set('');
    this.cd.detectChanges();

    const payload = { content, title };

    this.http.post<AnalysisResult>(`${this.apiUrl}/analyze`, payload).subscribe({
      next: (result) => {
        setTimeout(() => {
          this.analysisResult.set(result);
          this.pageState.set('validation');
          this.cd.detectChanges();
        });
      },
      error: (err) => {
        setTimeout(() => {
          this.analysisError.set(err.error?.detail || 'Erreur lors de l\'analyse IA. Veuillez réessayer.');
          this.pageState.set('import');
          this.errorMessage.set(this.analysisError());
          this.cd.detectChanges();
        });
      }
    });
  }

  retryAnalysis(): void {
    const result = this.importResult();
    if (result) {
      this.startAnalysis(result.content, result.title);
    }
  }

  getBloomInfo(level: string): { label: string; color: string; icon: string } {
    return this.bloomLevels[level] || { label: level, color: '#6b7280', icon: '📌' };
  }

  getBloomOrder(level: string): number {
    const order: Record<string, number> = {
      'memoriser': 1, 'comprendre': 2, 'appliquer': 3,
      'analyser': 4, 'evaluer': 5, 'creer': 6
    };
    return order[level] || 0;
  }

  // ========== VALIDATION ACTIONS ==========

  removeOutcome(index: number): void {
    const current = this.analysisResult();
    if (current) {
      const updated = { ...current };
      updated.learning_outcomes = [...updated.learning_outcomes];
      updated.learning_outcomes.splice(index, 1);
      this.analysisResult.set(updated);
    }
  }

  removeConcept(index: number): void {
    const current = this.analysisResult();
    if (current) {
      const updated = { ...current };
      updated.key_concepts = [...updated.key_concepts];
      updated.key_concepts.splice(index, 1);
      this.analysisResult.set(updated);
    }
  }

  removeKeyword(index: number): void {
    const current = this.analysisResult();
    if (current) {
      const updated = { ...current };
      updated.keywords = [...updated.keywords];
      updated.keywords.splice(index, 1);
      this.analysisResult.set(updated);
    }
  }

  // ========== HISTORY ==========

  loadHistory(): void {
    this.isLoading.set(true);
    this.http.get<any[]>(`${this.apiUrl}/history`).subscribe({
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

  deleteHistory(id: number, event: Event): void {
    event.stopPropagation();
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette fiche de l\'historique ?')) {
      return;
    }

    this.http.delete(`${this.apiUrl}/history/${id}`).subscribe({
      next: () => {
        this.historyList.set(this.historyList().filter(item => item.id !== id));
        this.successMessage.set('Fiche supprimée de l\'historique.');
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Erreur lors de la suppression.');
        this.cd.detectChanges();
      }
    });
  }

  loadResultFromHistory(item: any): void {
    this.loadedAnalysisId.set(item.id);
    this.generatedQuiz.set(item.quiz_data || null);
    this.importResult.set({
      title: item.module_title,
      content: item.original_content || '',
      source: 'history',
      file_name: null
    });
    this.analysisResult.set({
      module_title: item.module_title,
      learning_outcomes: item.learning_outcomes,
      key_concepts: item.key_concepts,
      keywords: item.keywords,
      central_notions: item.central_notions || [],
      estimated_duration: item.estimated_duration,
      target_audience: item.target_audience,
      module_summary: item.module_summary
    });
    this.pageState.set('validation');
    this.clearMessages();
    this.cd.detectChanges();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  confirmAnalysis(): void {
    const result = this.analysisResult();
    const importRes = this.importResult();
    if (!result) return;

    this.isLoading.set(true);
    this.clearMessages();

    const payload = {
      module_title: result.module_title,
      original_content: importRes?.content || '',
      learning_outcomes: result.learning_outcomes,
      key_concepts: result.key_concepts,
      keywords: result.keywords,
      central_notions: result.central_notions,
      estimated_duration: result.estimated_duration,
      target_audience: result.target_audience,
      module_summary: result.module_summary
    };

    this.http.post<any>(`${this.apiUrl}/history`, payload).subscribe({
      next: (savedEntry: any) => {
        this.isLoading.set(false);
        this.loadedAnalysisId.set(savedEntry.id);
        this.successMessage.set('Analyse confirmée et sauvegardée dans l\'historique ! Vous pouvez maintenant générer votre quiz ci-dessous.');
        this.loadHistory();
        this.cd.detectChanges();
        setTimeout(() => {
          const el = document.getElementById('quiz-generator-card');
          el?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.detail || 'Erreur lors de la sauvegarde de l\'analyse.');
        this.cd.detectChanges();
      }
    });
  }

  async generateQuiz(): Promise<void> {
    let id = this.loadedAnalysisId();
    if (!id && this.analysisResult()) {
      try {
        id = await this.autoSaveAnalysis();
      } catch (e) {
        return;
      }
    }

    if (!id) {
      this.errorMessage.set("Veuillez d'abord enregistrer ou charger une fiche module.");
      return;
    }

    this.isGeneratingQuiz.set(true);
    this.generatedQuiz.set(null);
    this.clearMessages();

    const types: string[] = [];
    if (this.quizQuestionTypes.qcm) types.push('qcm');
    if (this.quizQuestionTypes.vrai_faux) types.push('vrai_faux');
    if (this.quizQuestionTypes.question_ouverte) types.push('question_ouverte');
    if (this.quizQuestionTypes.association) types.push('association');

    if (types.length === 0) {
      this.errorMessage.set("Veuillez sélectionner au moins un type de question.");
      this.isGeneratingQuiz.set(false);
      return;
    }

    const payload = {
      nb_questions: this.quizQuestionsCount,
      duree_par_question: this.quizDurationPerQuestion,
      mode: this.quizMode,
      question_types: types,
      force: true
    };

    this.http.post<any>(`${this.apiUrl}/history/${id}/quiz`, payload).subscribe({
      next: (quiz) => {
        this.generatedQuiz.set(quiz);
        this.isGeneratingQuiz.set(false);
        this.successMessage.set("Quiz généré avec succès !");
        this.cd.detectChanges();
        setTimeout(() => {
          const el = document.getElementById('quiz-results-container');
          el?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || "Erreur lors de la génération du quiz.");
        this.isGeneratingQuiz.set(false);
        this.cd.detectChanges();
      }
    });
  }

  private autoSaveAnalysis(): Promise<number> {
    return new Promise((resolve, reject) => {
      const result = this.analysisResult();
      const importRes = this.importResult();
      if (!result) return reject('No analysis result');

      const payload = {
        module_title: result.module_title,
        original_content: importRes?.content || '',
        learning_outcomes: result.learning_outcomes,
        key_concepts: result.key_concepts,
        keywords: result.keywords,
        central_notions: result.central_notions,
        estimated_duration: result.estimated_duration,
        target_audience: result.target_audience,
        module_summary: result.module_summary
      };

      this.http.post<any>(`${this.apiUrl}/history`, payload).subscribe({
        next: (saved: any) => {
          this.loadedAnalysisId.set(saved.id);
          this.loadHistory();
          resolve(saved.id);
        },
        error: (err) => {
          this.errorMessage.set(err.error?.detail || 'Erreur lors de la sauvegarde de l\'analyse.');
          reject(err);
        }
      });
    });
  }

  backToImport(): void {
    this.pageState.set('import');
    this.importResult.set(null);
    this.analysisResult.set(null);
    this.loadedAnalysisId.set(null);
    this.generatedQuiz.set(null);
    this.selectedFile = null;
    this.editorContent = '';
    this.editorTitle = '';
    this.clearMessages();
  }
}
