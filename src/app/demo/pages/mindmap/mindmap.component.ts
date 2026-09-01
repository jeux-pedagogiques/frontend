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
  learning_outcomes?: any[];
  created_at?: string;
}

interface SuggestedBranch {
  titre: string;
  description: string;
  questions_guidantes: string[];
}

interface MindMapData {
  id?: number;
  concept_central: string;
  branches_suggerees: SuggestedBranch[];
  module_title?: string;
}

interface MindMapNodeItem {
  id: number;
  parent_node_id?: number | null;
  titre: string;
  equipe_id?: number;
  cree_par_participant_id?: string;
}

@Component({
  selector: 'app-mindmap',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, RouterModule],
  templateUrl: './mindmap.component.html',
  styleUrls: ['./mindmap.component.scss']
})
export class MindMapComponent implements OnInit {
  private http = inject(HttpClient);
  private cd = inject(ChangeDetectorRef);
  private shareService = inject(ShareService);

  pageState = signal<'select' | 'generating' | 'result' | 'history'>('select');
  isLoading = signal(false);
  isGenerating = signal(false);
  isLoadingHistory = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  historyList = signal<any[]>([]);
  historySearch = '';

  analyses = signal<ModuleAnalysis[]>([]);
  selectedAnalysis = signal<ModuleAnalysis | null>(null);
  selectedNodeId = signal<number | null>(null);

  nbBranches = 4;
  selectedModel = signal('bai/glm-5.3-flash');
  mindmapResult = signal<MindMapData | null>(null);

  // Student nodes / preview
  nodes = signal<MindMapNodeItem[]>([]);
  newNodeTitle = '';
  selectedParentNodeId: number | null = null;

  shareLink = signal('');
  shareCopied = signal(false);
  completenessData = signal<any | null>(null);
  showCompleteness = signal(false);

  private apiUrl = `${environment.apiUrl}/api`;

  ngOnInit(): void {
    this.loadAnalyses();
    this.loadHistory(false);
  }

  loadHistory(switchState = true): void {
    if (switchState) {
      this.pageState.set('history');
    }
    this.isLoadingHistory.set(true);
    this.http.get<any[]>(`${this.apiUrl}/mindmap/history`).subscribe({
      next: (data) => {
        this.historyList.set(data || []);
        this.isLoadingHistory.set(false);
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Erreur chargement historique mindmaps:', err);
        this.isLoadingHistory.set(false);
        this.cd.detectChanges();
      }
    });
  }

  loadSavedMindmap(item: any): void {
    this.mindmapResult.set({
      id: item.id,
      concept_central: item.concept_central,
      branches_suggerees: item.branches_suggerees || [],
      module_title: item.module_title
    });
    this.pageState.set('result');
    this.showCompleteness.set(false);
    this.shareLink.set('');

    // Fetch existing nodes
    this.http.get<any>(`${this.apiUrl}/mindmap/${item.id}/export`).subscribe({
      next: (res) => {
        this.nodes.set(res.nodes || []);
        this.cd.detectChanges();
      },
      error: () => {
        this.nodes.set([]);
      }
    });
  }

  deleteMindmap(id: number, event: Event): void {
    event.stopPropagation();
    if (!confirm('Voulez-vous vraiment supprimer cette carte mentale ?')) return;

    this.http.delete(`${this.apiUrl}/mindmap/${id}`).subscribe({
      next: () => {
        this.historyList.update(prev => prev.filter(m => m.id !== id));
        this.successMessage.set('Carte mentale supprimée avec succès.');
        if (this.mindmapResult()?.id === id) {
          this.mindmapResult.set(null);
          this.pageState.set('history');
        }
        this.cd.detectChanges();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Erreur lors de la suppression.');
        this.cd.detectChanges();
      }
    });
  }

  formatDate(d?: string): string {
    if (!d) return '';
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  }

  loadAnalyses(): void {
    this.isLoading.set(true);
    this.http.get<ModuleAnalysis[]>(`${this.apiUrl}/modules/history`).subscribe({
      next: (data) => {
        const normalized = (data || []).map(a => ({
          ...a,
          learning_outcomes: Array.isArray(a.learning_outcomes) ? a.learning_outcomes : [],
          key_concepts: Array.isArray(a.key_concepts) ? a.key_concepts : [],
          keywords: Array.isArray(a.keywords) ? a.keywords : []
        }));
        this.analyses.set(normalized);
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

  generateMindMap(): void {
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
      nb_branches: this.nbBranches,
      model: this.selectedModel(),
    };

    this.http.post<any>(`${this.apiUrl}/mindmap/generate`, body).subscribe({
      next: (res) => {
        this.mindmapResult.set({
          id: res.id,
          concept_central: res.concept_central,
          branches_suggerees: res.branches_suggerees || [],
          module_title: analysis.module_title
        });
        this.isGenerating.set(false);
        this.pageState.set('result');
        this.cd.detectChanges();
      },
      error: (err) => {
        this.isGenerating.set(false);
        this.pageState.set('select');
        this.errorMessage.set(err.error?.detail || "Erreur lors de la génération de la carte mentale.");
        this.cd.detectChanges();
      }
    });
  }

  addCustomNode(): void {
    if (!this.newNodeTitle.trim() || !this.mindmapResult()?.id) return;
    const newNode: MindMapNodeItem = {
      id: Date.now(),
      parent_node_id: this.selectedParentNodeId,
      titre: this.newNodeTitle.trim(),
      cree_par_participant_id: 'Professeur'
    };
    this.nodes.update((prev) => [...prev, newNode]);
    this.newNodeTitle = '';
    this.selectedParentNodeId = null;
  }

  toggleSelectNode(nodeId: number): void {
    this.selectedNodeId.update((current) => (current === nodeId ? null : nodeId));
  }

  removeNode(nodeId: number): void {
    this.nodes.update((prev) => prev.filter((n) => n.id !== nodeId && n.parent_node_id !== nodeId));
  }

  backToSelect(): void {
    this.pageState.set('select');
    this.mindmapResult.set(null);
    this.nodes.set([]);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.shareLink.set('');
    this.showCompleteness.set(false);
  }

  shareGame(): void {
    const mm = this.mindmapResult();
    if (!mm || !mm.id) return;
    this.shareService.createShare('mindmap', mm.id).subscribe({
      next: (res) => {
        const url = `${window.location.origin}/play/mindmap/${res.share_token}`;
        this.shareLink.set(url);
        navigator.clipboard.writeText(url).then(() => {
          this.shareCopied.set(true);
          setTimeout(() => this.shareCopied.set(false), 3000);
        });
      },
      error: () => this.errorMessage.set('Erreur lors de la création du lien de partage'),
    });
  }

  viewCompleteness(): void {
    const mm = this.mindmapResult();
    if (!mm || !mm.id) return;
    this.http.get<any>(`${this.apiUrl}/mindmap/1/completeness?mindmap_id=${mm.id}`).subscribe({
      next: (res) => {
        this.completenessData.set(res);
        this.showCompleteness.set(true);
      },
      error: () => this.errorMessage.set('Erreur lors de l’évaluation de complétude.'),
    });
  }
}
