import { Component, OnInit, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NgbPaginationModule, NgbDropdownModule, NgbModalModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { environment } from 'src/environments/environment';
import { RamCacheService } from 'src/app/theme/shared/service/ram-cache.service';
import { ShareService } from 'src/app/theme/shared/service/share.service';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    RouterModule,
    NgbPaginationModule,
    NgbDropdownModule,
    NgbModalModule
  ],
  templateUrl: './library.component.html',
  styleUrls: ['./library.component.scss']
})
export class LibraryComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private modalService = inject(NgbModal);
  private ramCache = inject(RamCacheService);
  private shareService = inject(ShareService);

  items = signal<any[]>([]);
  totalItems = signal(0);
  currentPage = signal(1);
  pageSize = signal(12);
  isLoading = signal(false);
  searchQuery = signal('');
  selectedGameType = signal<string | null>(null);
  selectedCardId = signal<number | null>(null);
  selectedModuleId = signal<number | null>(null);
  selectedBloomLevels = signal<string[]>([]);
  showArchived = signal(false);
  sortOrder = signal<'desc' | 'asc'>('desc');
  modules = signal<any[]>([]);
  regenerateConsignes = signal('');
  regeneratingItem = signal<any | null>(null);
  isRegenerating = signal(false);
  deletingItem = signal<any | null>(null);

  selectedConsultGame = signal<any | null>(null);
  isConsultLoading = signal(false);
  activeConsultTab = signal<string>('content');
  currentCardIndex = signal(0);
  isCardFlipped = signal(false);

  gameTypes = [
    {value: 'quiz', label: 'Quiz', icon: 'feather icon-help-circle', color: '#C51414'},
    {value: 'escape_room', label: 'Escape Room', icon: 'feather icon-lock', color: '#ef4444'},
    {value: 'pitching', label: 'Pitching', icon: 'feather icon-mic', color: '#f97316'},
    {value: 'flashcards', label: 'Flashcards', icon: 'feather icon-layers', color: '#22c55e'},
    {value: 'cas_etude', label: 'Étude de cas', icon: 'feather icon-briefcase', color: '#9f1010'},
    {value: 'storytelling', label: 'Storytelling', icon: 'feather icon-feather', color: '#dc2626'},
    {value: 'debat', label: 'Débat Structuré', icon: 'feather icon-users', color: '#6366f1'},
    {value: 'negociation', label: 'Négociation', icon: 'feather icon-shuffle', color: '#8b5cf6'},
    {value: 'mindmap', label: 'Mindmap', icon: 'feather icon-share-2', color: '#0ea5e9'},
    {value: 'atelier_feedback', label: 'Atelier Feedback', icon: 'feather icon-message-circle', color: '#10b981'}
  ];

  bloomLevels = [
    {value: 'memoriser', label: 'Mémoriser', color: '#ef4444', emoji: '🧠'},
    {value: 'comprendre', label: 'Comprendre', color: '#f97316', emoji: '💡'},
    {value: 'appliquer', label: 'Appliquer', color: '#eab308', emoji: '🔧'},
    {value: 'analyser', label: 'Analyser', color: '#22c55e', emoji: '🔬'},
    {value: 'evaluer', label: 'Évaluer', color: '#3b82f6', emoji: '⚖️'},
    {value: 'creer', label: 'Créer', color: '#9f1010', emoji: '🎨'}
  ];

  hexToRgba(hex: string, alpha: number): string {
    if (!hex || !hex.startsWith('#')) return `rgba(100, 116, 139, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private searchTimeout: any;

  ngOnInit() {
    this.loadModules();
    this.loadItems();
  }

  loadModules() {
    this.http.get<any[]>(`${environment.apiUrl}/api/modules/history`).subscribe({
      next: (data) => {
        this.modules.set(data);
      },
      error: (err) => console.error('Error loading modules', err)
    });
  }

  loadItems() {
    const params: any = {
      page: this.currentPage(),
      page_size: this.pageSize(),
      sort_order: this.sortOrder(),
      archived: this.showArchived()
    };
    
    if (this.selectedModuleId() !== null) {
      params.module_id = this.selectedModuleId();
    }
    if (this.selectedGameType()) {
      params.game_type = this.selectedGameType();
    }
    if (this.searchQuery()) {
      params.search = this.searchQuery();
    }
    if (this.selectedBloomLevels().length > 0) {
      params.bloom_level = this.selectedBloomLevels().join(',');
    }

    const cacheKey = `library_${JSON.stringify(params)}`;
    const cached = this.ramCache.get<any>(cacheKey);
    if (cached) {
      this.items.set(cached.items || []);
      this.totalItems.set(cached.total || 0);
      this.isLoading.set(false);
    } else {
      this.isLoading.set(true);
    }

    this.http.get<any>(`${environment.apiUrl}/api/library`, { params }).subscribe({
      next: (response) => {
        this.items.set(response.items || []);
        this.totalItems.set(response.total || 0);
        this.ramCache.set(cacheKey, response);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading library items', err);
        this.isLoading.set(false);
      }
    });
  }

  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.searchQuery.set(input.value);
      this.currentPage.set(1);
      this.loadItems();
    }, 300);
  }

  toggleGameType(type: string) {
    if (this.selectedGameType() === type) {
      this.selectedGameType.set(null);
    } else {
      this.selectedGameType.set(type);
    }
    this.currentPage.set(1);
    this.loadItems();
  }

  toggleSelectCard(id: number, event?: Event): void {
    if (event) {
      // Don't toggle selection if user clicked directly on an input or button inside
      const target = event.target as HTMLElement;
      if (target.closest('button') || target.closest('a') || target.closest('input')) {
        return;
      }
    }
    this.selectedCardId.update((current) => (current === id ? null : id));
  }

  toggleBloomLevel(level: string) {
    const current = [...this.selectedBloomLevels()];
    const index = current.indexOf(level);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(level);
    }
    this.selectedBloomLevels.set(current);
    this.currentPage.set(1);
    this.loadItems();
  }

  selectModule(moduleId: number | null) {
    this.selectedModuleId.set(moduleId);
    this.currentPage.set(1);
    this.loadItems();
  }

  toggleSortOrder() {
    this.sortOrder.set(this.sortOrder() === 'desc' ? 'asc' : 'desc');
    this.loadItems();
  }

  toggleArchived() {
    this.showArchived.set(!this.showArchived());
    this.currentPage.set(1);
    this.loadItems();
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.loadItems();
  }

  duplicateGame(item: any) {
    this.http.post(`${environment.apiUrl}/api/library/${item.game_type}/${item.game_id}/duplicate`, {}).subscribe({
      next: () => this.loadItems(),
      error: (err) => console.error('Error duplicating game', err)
    });
  }

  openRegenerateModal(item: any, modal: any) {
    this.regeneratingItem.set(item);
    this.regenerateConsignes.set('');
    this.modalService.open(modal, { centered: true });
  }

  confirmRegenerate(modal: any) {
    const item = this.regeneratingItem();
    if (!item) return;

    this.isRegenerating.set(true);
    this.http.patch(`${environment.apiUrl}/api/library/${item.game_type}/${item.game_id}/regenerate`, {
      consignes: this.regenerateConsignes()
    }).subscribe({
      next: () => {
        this.isRegenerating.set(false);
        modal.close();
        this.loadItems();
      },
      error: (err) => {
        console.error('Error regenerating game', err);
        this.isRegenerating.set(false);
      }
    });
  }

  archiveGame(item: any) {
    this.http.patch(`${environment.apiUrl}/api/library/${item.game_type}/${item.game_id}/archive`, {
      archived: !item.archived
    }).subscribe({
      next: () => this.loadItems(),
      error: (err) => console.error('Error toggling archive', err)
    });
  }

  cleanTitle(title: string | null | undefined): string {
    if (!title) return 'Sans titre';
    return title.replace(/(\s*\(copie\))+/gi, ' (copie)').trim();
  }

  openDeleteModal(item: any, modal: any) {
    this.deletingItem.set(item);
    this.modalService.open(modal, { centered: true });
  }

  confirmDelete(modal: any) {
    const item = this.deletingItem();
    if (!item) return;

    this.http.delete(`${environment.apiUrl}/api/library/${item.game_type}/${item.game_id}`).subscribe({
      next: () => {
        this.deletingItem.set(null);
        modal.close();
        this.ramCache.clear();
        this.loadItems();
      },
      error: (err) => {
        console.error('Error deleting game', err);
        modal.close();
      }
    });
  }

  getGameTypeInfo(type: string) {
    return this.gameTypes.find(g => g.value === type) || { icon: '', label: type, color: '#ccc' };
  }

  getBloomInfo(level: string) {
    return this.bloomLevels.find(b => b.value === level) || { emoji: '', label: level, color: '#ccc' };
  }

  getModuleName(id: number | null): string {
    if (!id) return 'Tous les modules';
    const mod = this.modules().find(m => m.id === id);
    return mod ? mod.module_title : 'Tous les modules';
  }

  consultGame(item: any, modal: any) {
    this.selectedConsultGame.set(null);
    this.isConsultLoading.set(true);
    this.activeConsultTab.set('content');
    this.currentCardIndex.set(0);
    this.isCardFlipped.set(false);

    this.modalService.open(modal, { size: 'xl', scrollable: true, centered: true });

    this.http.get<any>(`${environment.apiUrl}/api/library/${item.game_type}/${item.game_id}`).subscribe({
      next: (data) => {
        this.selectedConsultGame.set(data);
        this.isConsultLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching game detail', err);
        this.isConsultLoading.set(false);
      }
    });
  }

  nextCard() {
    const game = this.selectedConsultGame();
    if (game && game.cartes && this.currentCardIndex() < game.cartes.length - 1) {
      this.isCardFlipped.set(false);
      this.currentCardIndex.set(this.currentCardIndex() + 1);
    }
  }

  prevCard() {
    if (this.currentCardIndex() > 0) {
      this.isCardFlipped.set(false);
      this.currentCardIndex.set(this.currentCardIndex() - 1);
    }
  }

  flipCard() {
    this.isCardFlipped.set(!this.isCardFlipped());
  }

  // ─── Share & Results ───
  shareLink = signal('');
  shareCopied = signal(false);
  shareResults = signal<any[]>([]);
  showResults = signal(false);

  // SMTP Email Modal for Games in Library
  showGameEmailModal = signal(false);
  emailTargetGame = signal<any>(null);
  gameSingleRecipientInput = signal('');
  gameRecipientList = signal<string[]>([]);
  isSendingGameEmail = signal(false);
  gameEmailSendStatus = signal<{ success?: boolean; message?: string } | null>(null);
  gameCsvImportMessage = signal('');

  openGameEmailModal(item: any): void {
    this.emailTargetGame.set(item);
    this.gameSingleRecipientInput.set('');
    this.gameRecipientList.set([]);
    this.gameEmailSendStatus.set(null);
    this.gameCsvImportMessage.set('');
    this.showGameEmailModal.set(true);
  }

  closeGameEmailModal(): void {
    this.showGameEmailModal.set(false);
    this.emailTargetGame.set(null);
    this.gameSingleRecipientInput.set('');
    this.gameRecipientList.set([]);
    this.gameEmailSendStatus.set(null);
    this.gameCsvImportMessage.set('');
  }

  addGameSingleRecipient(): void {
    const val = this.gameSingleRecipientInput().trim();
    if (!val) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      this.gameEmailSendStatus.set({ success: false, message: `"${val}" n'est pas une adresse email valide.` });
      return;
    }

    const currentList = this.gameRecipientList();
    if (currentList.includes(val)) {
      this.gameEmailSendStatus.set({ success: false, message: `L'adresse "${val}" est déjà dans la liste.` });
      return;
    }

    this.gameRecipientList.set([...currentList, val]);
    this.gameSingleRecipientInput.set('');
    this.gameEmailSendStatus.set(null);
  }

  removeGameRecipient(index: number): void {
    const currentList = [...this.gameRecipientList()];
    currentList.splice(index, 1);
    this.gameRecipientList.set(currentList);
  }

  updateGameRecipient(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newVal = input.value.trim();
    const currentList = [...this.gameRecipientList()];
    currentList[index] = newVal;
    this.gameRecipientList.set(currentList);
  }

  clearAllGameRecipients(): void {
    this.gameRecipientList.set([]);
    this.gameCsvImportMessage.set('');
  }

  onGameCsvFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const content = e.target.result as string;
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const foundEmails = content.match(emailRegex) || [];

      if (foundEmails.length === 0) {
        this.gameCsvImportMessage.set('Aucune adresse email valide trouvée dans le fichier CSV.');
        return;
      }

      const existing = this.gameRecipientList();
      const newEmails = foundEmails.map(e => e.trim().toLowerCase());
      const merged = Array.from(new Set([...existing, ...newEmails]));

      this.gameRecipientList.set(merged);
      const addedCount = merged.length - existing.length;
      this.gameCsvImportMessage.set(`${foundEmails.length} email(s) scanné(s) (${addedCount} nouveau(x) ajouté(s)).`);
      
      event.target.value = '';
    };

    reader.readAsText(file);
  }

  sendGameInvitationEmail(): void {
    const item = this.emailTargetGame();
    if (!item) return;

    if (this.gameSingleRecipientInput().trim()) {
      this.addGameSingleRecipient();
    }

    const list = this.gameRecipientList().map(e => e.trim()).filter(e => e.length > 0);

    if (list.length === 0) {
      this.gameEmailSendStatus.set({ success: false, message: 'Veuillez ajouter au moins une adresse email destinataire.' });
      return;
    }

    this.isSendingGameEmail.set(true);
    this.gameEmailSendStatus.set(null);

    this.shareService.sendShareEmail(item.game_type, item.game_id, list).subscribe({
      next: (res: any) => {
        this.isSendingGameEmail.set(false);
        this.gameEmailSendStatus.set({
          success: true,
          message: res.message || `Invitation au jeu envoyée avec succès à ${list.length} destinataire(s)`
        });
        setTimeout(() => {
          if (this.showGameEmailModal()) {
            this.closeGameEmailModal();
          }
        }, 2800);
      },
      error: (err: any) => {
        this.isSendingGameEmail.set(false);
        const detail = err.error?.detail || "Erreur lors de l'envoi des emails via SMTP.";
        this.gameEmailSendStatus.set({ success: false, message: detail });
      }
    });
  }

  shareGame(item: any): void {
    if (!item) return;
    const gameType = item.game_type;
    const gameId = item.game_id;
    this.shareService.createShare(gameType, gameId).subscribe({
      next: (res) => {
        const url = `${window.location.origin}/play/${gameType}/${res.share_token}`;
        this.shareLink.set(url);
        navigator.clipboard.writeText(url).then(() => {
          this.shareCopied.set(true);
          setTimeout(() => this.shareCopied.set(false), 3000);
        });
      },
      error: (err) => console.error('Error sharing game', err)
    });
  }

  copyShareLink(): void {
    if (!this.shareLink()) return;
    navigator.clipboard.writeText(this.shareLink()).then(() => {
      this.shareCopied.set(true);
      setTimeout(() => this.shareCopied.set(false), 3000);
    });
  }

  closeShareLink(): void {
    this.shareLink.set('');
    this.shareCopied.set(false);
  }

  // ─── Results Pop-up & CSV/PDF Exports ───
  selectedResultsGame = signal<any | null>(null);
  isResultsLoading = signal(false);

  viewResults(item: any, modal?: any): void {
    if (!item) return;
    this.selectedResultsGame.set(item);
    this.shareResults.set([]);
    this.isResultsLoading.set(true);

    if (modal) {
      this.modalService.open(modal, { size: 'lg', centered: true });
    }

    const gameType = item.game_type;
    const gameId = item.game_id;
    this.shareService.getResults(gameType, gameId).subscribe({
      next: (res) => {
        this.shareResults.set(res.results || []);
        this.isResultsLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching results', err);
        this.isResultsLoading.set(false);
      }
    });
  }

  exportResultsCSV(): void {
    const results = this.shareResults();
    const game = this.selectedResultsGame();
    if (!results || results.length === 0) return;

    const rawTitle = game?.titre || game?.title || 'jeu';
    const title = this.cleanTitle(rawTitle);

    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'Etudiant,Score,Score Max,Temps (secondes),Date de fin\n';

    results.forEach((r: any) => {
      const name = `"${(r.student_name || '').replace(/"/g, '""')}"`;
      const score = r.score ?? 0;
      const maxScore = r.max_score ?? 0;
      const time = r.completion_time_seconds ?? 0;
      const date = r.completed_at ? new Date(r.completed_at).toLocaleString('fr-FR') : '';
      csv += `${name},${score},${maxScore},${time},"${date}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Resultats_${title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportResultsPDF(): void {
    const results = this.shareResults();
    const game = this.selectedResultsGame();
    if (!results || results.length === 0) return;

    const rawTitle = game?.titre || game?.title || 'Jeu éducatif';
    const title = this.cleanTitle(rawTitle);
    const moduleName = game?.module_title || 'ESPRIT Module';

    let printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    let rowsHtml = '';
    results.forEach((r: any, index: number) => {
      const timeMin = r.completion_time_seconds ? Math.floor(r.completion_time_seconds / 60) + ' min ' + (r.completion_time_seconds % 60) + 's' : '-';
      const dateStr = r.completed_at ? new Date(r.completed_at).toLocaleString('fr-FR') : '-';
      rowsHtml += `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${r.student_name || 'Étudiant'}</strong></td>
          <td><span class="score-badge">${r.score} / ${r.max_score}</span></td>
          <td>${timeMin}</td>
          <td>${dateStr}</td>
        </tr>
      `;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport de Résultats - ${title}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #C51414; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { margin: 0; color: #C51414; font-size: 22px; }
          .header p { margin: 5px 0 0 0; color: #64748b; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background: #f8fafc; color: #475569; text-align: left; padding: 12px; font-size: 13px; border-bottom: 2px solid #e2e8f0; }
          td { padding: 12px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
          .score-badge { background: #fdecec; color: #c51414; font-weight: bold; padding: 4px 10px; border-radius: 99px; font-size: 13px; }
          .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Rapport des Résultats des Étudiants</h1>
            <p>Jeu : <strong>${title}</strong> (${moduleName})</p>
          </div>
          <div>
            <small>Généré le ${new Date().toLocaleDateString('fr-FR')}</small>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Nom de l'Étudiant</th>
              <th>Score</th>
              <th>Temps Passé</th>
              <th>Date de Réalisation</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="footer">
          ESPRIT Smart Learning Platform — Rapport Officiel
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }
}
