import { Component, OnInit, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ShareService } from 'src/app/theme/shared/service/share.service';
import { AudioAlertService } from 'src/app/theme/shared/service/audio-alert.service';
import { environment } from 'src/environments/environment';

interface NarrativeStep {
  etape: number;
  titre: string;
  description: string;
  consigne: string;
  temps_minutes: number;
}

interface NarrativeRole {
  nom_role: string;
  description: string;
  missions: string[];
}

interface EvaluationCriterion {
  critere: string;
  description: string;
  bareme: string;
}

interface StorytellingData {
  id?: number;
  module_id?: number;
  module_title?: string;
  titre: string;
  contexte_depart: string;
  mots_cles_obligatoires: string[];
  etapes_narratives: NarrativeStep[];
  roles_narratifs: NarrativeRole[];
  fiche_animateur?: {
    objectifs_pedagogiques: string[];
    deroulement_pas_a_pas: string[];
    conseils_animation: string[];
  };
  fiche_participant?: {
    regles_du_jeu: string[];
    conseils_redaction: string[];
  };
  criteres_evaluation?: EvaluationCriterion[];
  created_at?: string;
}

@Component({
  selector: 'app-storytelling',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, RouterModule],
  templateUrl: './storytelling.component.html',
  styleUrls: ['./storytelling.component.scss']
})
export class StorytellingComponent implements OnInit {
  private http = inject(HttpClient);
  private cd = inject(ChangeDetectorRef);
  private shareService = inject(ShareService);
  public audioAlertService = inject(AudioAlertService);

  private apiUrl = `${environment.apiUrl}/api`;

  // Views: 'select' | 'generating' | 'result' | 'history'
  pageState = signal<'select' | 'generating' | 'result' | 'history'>('select');
  activeTab = signal<'amorce' | 'etapes' | 'fiches' | 'debriefing' | 'contributions'>('amorce');

  // Module Analysis List
  analyses = signal<any[]>([]);
  selectedAnalysis = signal<any | null>(null);
  viewingAnalysis = signal<any | null>(null);

  // History & Consultation
  historyList = signal<StorytellingData[]>([]);
  historySearch = signal<string>('');

  // Configuration Parameters
  nbEtapes = 4;
  dureeMinutes = 20;
  difficulteCreative = 'standard';
  selectedModel = signal('bai/glm-5.3-flash');

  availableModels = [
    { value: 'bai/glm-5.3-flash', label: 'BAI GLM 5.3 Flash (Recommandé - Raisonnement & Récit)', provider: 'BAI' },
    { value: 'bai/deepseek-v4-flash', label: 'BAI DeepSeek V4 Flash (Scénario & Logique)', provider: 'BAI' },
    { value: 'bai/qwen3.8-flash', label: 'BAI Qwen 3.8 Flash (Alibaba Rapide)', provider: 'BAI' },
    { value: 'gemini-2.5-flash', label: 'Google Gemini 2.5 Flash (Rapide & Précis)', provider: 'Google' },
    { value: 'gemini-2.5-pro', label: 'Google Gemini 2.5 Pro (Haute Intelligence & Créativité)', provider: 'Google' },
    { value: 'groq/llama-3.1-70b-versatile', label: 'Groq Llama 3.1 70B (0.2s - Ultra Rapide)', provider: 'Groq' },
    { value: 'groq/llama-3.1-8b-instant', label: 'Groq Llama 3.1 8B (Instantané)', provider: 'Groq' },
    { value: 'github/gpt-4o', label: 'GitHub GPT-4o (Azure High Intel)', provider: 'GitHub' },
    { value: 'github/Llama-3.3-70B-Instruct', label: 'GitHub Llama 3.3 70B (GitHub Models)', provider: 'GitHub' },
    { value: 'openrouter/openai/gpt-4o-mini', label: 'OpenRouter GPT-4o Mini (Rapide)', provider: 'OpenRouter' }
  ];

  bloomLabels: Record<string, string> = {
    'memoriser': 'Mémoriser',
    'comprendre': 'Comprendre',
    'appliquer': 'Appliquer',
    'analyser': 'Analyser',
    'evaluer': 'Évaluer',
    'creer': 'Créer'
  };

  bloomColors: Record<string, string> = {
    'memoriser': '#ef4444',
    'comprendre': '#f97316',
    'appliquer': '#eab308',
    'analyser': '#22c55e',
    'evaluer': '#3b82f6',
    'creer': '#9f1010'
  };

  // Generated Data
  storytelling = signal<StorytellingData | null>(null);
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  // Share modal & email
  shareLink = signal('');
  shareCopied = signal(false);
  showShareModal = signal(false);
  shareModalTab = signal<'link' | 'email'>('link');
  emailInput = signal('');
  isSendingEmail = signal(false);
  emailSuccessMessage = signal('');
  emailErrorMessage = signal('');

  // Live contributions
  contributions = signal<any[]>([]);
  isLoadingContribs = signal(false);

  // AI Evaluation
  evaluationResult = signal<any | null>(null);
  isEvaluating = signal(false);

  ngOnInit(): void {
    this.loadAnalyses();
    this.loadHistory();
  }

  loadAnalyses(): void {
    this.isLoading.set(true);
    this.http.get<any[]>(`${this.apiUrl}/modules/history`).subscribe({
      next: (data) => {
        const normalized = (data || []).map(a => ({
          ...a,
          learning_outcomes: Array.isArray(a.learning_outcomes) ? a.learning_outcomes : [],
          key_concepts: Array.isArray(a.key_concepts) ? a.key_concepts : [],
          keywords: Array.isArray(a.keywords) ? a.keywords : []
        }));
        this.analyses.set(normalized);
        this.isLoading.set(false);
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Error loading module analyses:', err);
        this.isLoading.set(false);
        this.cd.detectChanges();
      }
    });
  }

  loadHistory(): void {
    this.http.get<StorytellingData[]>(`${this.apiUrl}/storytelling/history`).subscribe({
      next: (stories) => {
        this.historyList.set(stories || []);
        this.cd.detectChanges();
      },
      error: () => {}
    });
  }

  switchToHistory(): void {
    this.pageState.set('history');
    this.loadHistory();
  }

  backToSelect(): void {
    this.pageState.set('select');
  }

  selectAnalysis(analysis: any): void {
    this.selectedAnalysis.set(analysis);
    this.pageState.set('select');
    this.cd.detectChanges();
    setTimeout(() => {
      const el = document.querySelector('.config-panel-sticky');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }

  openOverlay(analysis: any): void {
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
    return this.bloomColors[level] || '#C51414';
  }

  consultStory(story: StorytellingData): void {
    this.storytelling.set(story);
    this.pageState.set('result');
    this.activeTab.set('amorce');
    this.cd.detectChanges();
  }

  deleteStory(storyId: number | undefined, event: Event): void {
    event.stopPropagation();
    if (!storyId) return;
    if (!confirm('Voulez-vous vraiment supprimer cet atelier de storytelling ?')) return;

    this.http.delete(`${this.apiUrl}/storytelling/${storyId}`).subscribe({
      next: () => {
        this.successMessage.set('Atelier de storytelling supprimé.');
        this.loadHistory();
        if (this.storytelling()?.id === storyId) {
          this.storytelling.set(null);
          this.pageState.set('select');
        }
      },
      error: () => {
        this.errorMessage.set('Erreur lors de la suppression du storytelling.');
      }
    });
  }

  generateStorytelling(): void {
    const analysis = this.selectedAnalysis();
    if (!analysis) {
      this.errorMessage.set('Veuillez sélectionner un module analysé.');
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');
    this.pageState.set('generating');
    this.isLoading.set(true);

    const payload = {
      module_id: analysis.id,
      nb_etapes: this.nbEtapes,
      duree_minutes: this.dureeMinutes,
      difficulte_creative: this.difficulteCreative,
      model: this.selectedModel()
    };

    this.http.post<StorytellingData>(`${this.apiUrl}/storytelling/generate`, payload).subscribe({
      next: (res) => {
        this.storytelling.set(res);
        this.isLoading.set(false);
        this.pageState.set('result');
        this.activeTab.set('amorce');
        this.successMessage.set('Atelier de Storytelling Collaboratif généré avec succès !');
        this.audioAlertService.triggerLiveAnnouncement('Atelier de Storytelling généré avec succès.');
        this.loadHistory();
        this.cd.detectChanges();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.pageState.set('select');
        this.errorMessage.set(err.error?.detail || 'Erreur lors de la génération du Storytelling.');
        this.audioAlertService.triggerLiveAnnouncement('Erreur lors de la génération du Storytelling.');
        this.cd.detectChanges();
      }
    });
  }

  shareGame(): void {
    const story = this.storytelling();
    if (!story || !story.id) return;

    this.shareService.createShare('storytelling', story.id).subscribe({
      next: (res) => {
        const url = `${window.location.origin}/#/play/storytelling/${res.share_token}`;
        this.shareLink.set(url);
        this.showShareModal.set(true);
        navigator.clipboard.writeText(url).then(() => {
          this.shareCopied.set(true);
          setTimeout(() => this.shareCopied.set(false), 3000);
        });
      },
      error: () => {
        this.errorMessage.set('Erreur lors de la génération du lien de partage.');
      }
    });
  }

  copyShareUrl(): void {
    if (!this.shareLink()) return;
    navigator.clipboard.writeText(this.shareLink()).then(() => {
      this.shareCopied.set(true);
      setTimeout(() => this.shareCopied.set(false), 3000);
    });
  }

  closeShareModal(): void {
    this.showShareModal.set(false);
    this.emailSuccessMessage.set('');
    this.emailErrorMessage.set('');
  }

  sendInvitationEmails(): void {
    const raw = this.emailInput().trim();
    if (!raw) {
      this.emailErrorMessage.set('Veuillez saisir au moins une adresse email.');
      return;
    }

    const emails = raw
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes('@'));

    if (emails.length === 0) {
      this.emailErrorMessage.set('Aucune adresse email valide détectée.');
      return;
    }

    const story = this.storytelling();
    if (!story || !story.id) return;

    this.isSendingEmail.set(true);
    this.emailErrorMessage.set('');
    this.emailSuccessMessage.set('');

    this.shareService.sendShareEmail('storytelling', story.id, emails).subscribe({
      next: () => {
        this.isSendingEmail.set(false);
        this.emailSuccessMessage.set(`Invitations envoyées avec succès à ${emails.length} étudiant(s) !`);
        this.emailInput.set('');
        this.cd.detectChanges();
      },
      error: (err) => {
        this.isSendingEmail.set(false);
        this.emailErrorMessage.set(err.error?.detail || "Erreur lors de l'envoi des emails.");
        this.cd.detectChanges();
      }
    });
  }

  loadContributions(): void {
    const story = this.storytelling();
    if (!story || !story.id) return;

    this.isLoadingContribs.set(true);
    this.http.get<any[]>(`${this.apiUrl}/storytelling/${story.id}/contributions`).subscribe({
      next: (data) => {
        this.contributions.set(data || []);
        this.isLoadingContribs.set(false);
      },
      error: () => {
        this.isLoadingContribs.set(false);
      }
    });
  }

  evaluateConsolidatedStory(): void {
    const story = this.storytelling();
    if (!story || !story.id) return;

    const fullText = this.contributions()
      .map((c) => `[Étape ${c.etape_index + 1} - ${c.pseudo}] ${c.texte_contribution}`)
      .join('\n\n');

    if (!fullText.trim()) {
      this.errorMessage.set('Aucune contribution trouvée pour évaluer l\'histoire.');
      return;
    }

    this.isEvaluating.set(true);
    this.errorMessage.set('');

    this.http.post<any>(`${this.apiUrl}/storytelling/${story.id}/evaluate`, {
      texte_complet: fullText,
      mots_cles_obligatoires: story.mots_cles_obligatoires,
      model: this.selectedModel()
    }).subscribe({
      next: (res) => {
        this.evaluationResult.set(res);
        this.isEvaluating.set(false);
        this.audioAlertService.triggerLiveAnnouncement('Évaluation de l\'histoire terminée.');
      },
      error: (err) => {
        this.isEvaluating.set(false);
        this.errorMessage.set(err.error?.detail || 'Erreur lors de l\'évaluation IA.');
        this.audioAlertService.triggerLiveAnnouncement('Erreur lors de l\'évaluation de l\'histoire.');
      }
    });
  }

  resetConfig(): void {
    this.pageState.set('select');
    this.selectedAnalysis.set(null);
    this.storytelling.set(null);
    this.evaluationResult.set(null);
    this.contributions.set([]);
  }
}
