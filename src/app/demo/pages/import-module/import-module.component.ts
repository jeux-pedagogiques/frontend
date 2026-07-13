import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
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
export class ImportModuleComponent {
  private http = inject(HttpClient);
  private cd = inject(ChangeDetectorRef);

  // Page state: 'import' | 'analyzing' | 'validation'
  pageState = signal<'import' | 'analyzing' | 'validation'>('import');

  // State signals
  activeTab = signal<'upload' | 'editor' | 'paste' | 'history'>('upload');
  isLoading = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  importResult = signal<ImportResult | null>(null);
  historyList = signal<any[]>([]);

  // AI Analysis
  analysisResult = signal<AnalysisResult | null>(null);
  analysisError = signal('');

  // File upload state
  selectedFile: File | null = null;
  isDragOver = signal(false);

  // Editor content
  editorContent = '';
  editorTitle = '';

  // Paste content
  pasteContent = '';
  pasteTitle = '';

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

  setActiveTab(tab: 'upload' | 'editor' | 'paste' | 'history'): void {
    this.activeTab.set(tab);
    this.clearMessages();
    if (tab === 'history') {
      this.loadHistory();
    }
  }

  clearMessages(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
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

  // ========== PASTE INPUT ==========

  submitPasteContent(): void {
    if (!this.pasteContent.trim()) {
      this.errorMessage.set('Veuillez coller du contenu.');
      return;
    }

    this.isLoading.set(true);
    this.clearMessages();

    const payload = { content: this.pasteContent, title: this.pasteTitle || null };

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
        this.errorMessage.set(err.error?.detail || 'Erreur lors de l\'importation du contenu collé.');
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
    this.cd.detectChanges();
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

    this.http.post(`${this.apiUrl}/history`, payload).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.successMessage.set('Analyse confirmée et sauvegardée dans l\'historique ! Prêt pour la génération du jeu.');
        this.cd.detectChanges();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.detail || 'Erreur lors de la sauvegarde de l\'analyse.');
        this.cd.detectChanges();
      }
    });
  }

  backToImport(): void {
    this.pageState.set('import');
    this.importResult.set(null);
    this.analysisResult.set(null);
    this.selectedFile = null;
    this.editorContent = '';
    this.editorTitle = '';
    this.pasteContent = '';
    this.pasteTitle = '';
    this.clearMessages();
  }
}
