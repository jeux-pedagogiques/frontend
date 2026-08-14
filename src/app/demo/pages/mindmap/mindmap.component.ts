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

  pageState = signal<'select' | 'generating' | 'result'>('select');
  isLoading = signal(false);
  isGenerating = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  analyses = signal<ModuleAnalysis[]>([]);
  selectedAnalysis = signal<ModuleAnalysis | null>(null);
  selectedNodeId = signal<number | null>(null);

  nbBranches = 4;
  selectedModel = signal('groq/llama-3.3-70b-versatile');
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
