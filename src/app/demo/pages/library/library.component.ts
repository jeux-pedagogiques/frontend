import { Component, OnInit, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NgbPaginationModule, NgbDropdownModule, NgbModalModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { environment } from 'src/environments/environment';

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

  items = signal<any[]>([]);
  totalItems = signal(0);
  currentPage = signal(1);
  pageSize = signal(12);
  isLoading = signal(false);
  searchQuery = signal('');
  selectedGameType = signal<string | null>(null);
  selectedModuleId = signal<number | null>(null);
  selectedBloomLevels = signal<string[]>([]);
  showArchived = signal(false);
  sortOrder = signal<'desc' | 'asc'>('desc');
  modules = signal<any[]>([]);
  regenerateConsignes = signal('');
  regeneratingItem = signal<any | null>(null);
  isRegenerating = signal(false);

  selectedConsultGame = signal<any | null>(null);
  isConsultLoading = signal(false);
  activeConsultTab = signal<string>('content');
  currentCardIndex = signal(0);
  isCardFlipped = signal(false);

  gameTypes = [
    {value: 'quiz', label: 'Quiz', icon: 'feather icon-help-circle', color: '#6366f1'},
    {value: 'escape_room', label: 'Escape Room', icon: 'feather icon-lock', color: '#ef4444'},
    {value: 'pitching', label: 'Pitching', icon: 'feather icon-mic', color: '#f97316'},
    {value: 'flashcards', label: 'Flashcards', icon: 'feather icon-layers', color: '#22c55e'}
  ];

  bloomLevels = [
    {value: 'memoriser', label: 'Mémoriser', color: '#ef4444', emoji: '🧠'},
    {value: 'comprendre', label: 'Comprendre', color: '#f97316', emoji: '💡'},
    {value: 'appliquer', label: 'Appliquer', color: '#eab308', emoji: '🔧'},
    {value: 'analyser', label: 'Analyser', color: '#22c55e', emoji: '🔬'},
    {value: 'evaluer', label: 'Évaluer', color: '#3b82f6', emoji: '⚖️'},
    {value: 'creer', label: 'Créer', color: '#8b5cf6', emoji: '🎨'}
  ];

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
    this.isLoading.set(true);
    let params: any = {
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

    this.http.get<any>(`${environment.apiUrl}/api/library`, { params }).subscribe({
      next: (response) => {
        this.items.set(response.items || []);
        this.totalItems.set(response.total || 0);
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
}
